import { useState, useEffect } from "react";
import { useSearchParams, useParams } from "react-router-dom";
import CodeGraphViewer from "../components/CodeGraphViewer";
import LocalUploader from "../components/LocalUploader";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import JSZip from "jszip";
import { parseFilesIntoGraph } from "../lib/parser";
import { parseFilesWithPyodide } from "../lib/parser-pyodide";

const IGNORED_DIRS = new Set([
  'node_modules', '.git', '.github', 'dist', 'build', 'out', 'coverage', 
  '.next', '.nuxt', '__pycache__', 'venv', '.venv', 'env', '.env', '.tox',
  'eggs', 'target', '.gradle', '.idea', 'cmake-build-debug', 'bin', 'obj',
  'packages', 'vendor', 'Pods', '.build', 'DerivedData', '.dart_tool',
  '.vscode'
]);

const isPathIgnored = (path: string) => {
  const parts = path.split(/[\/\\]/);
  return parts.some(part => IGNORED_DIRS.has(part));
};

const sanitizePath = (pathStr: string, repoName?: string): string => {
  if (!pathStr) return '';
  
  // Normalize Windows slashes
  let p = pathStr.replace(/\\/g, '/');
  
  // If it's already relative, just return it
  if (p.startsWith('.') || (!p.startsWith('/') && !p.match(/^[a-zA-Z]:\//))) {
    return p.startsWith('./') ? p : './' + p;
  }
  
  // Detect if we can make it relative using the repoName
  if (repoName) {
    const parts = p.split('/');
    const repoIndex = parts.lastIndexOf(repoName);
    if (repoIndex !== -1) {
      return './' + parts.slice(repoIndex).join('/');
    }
  }
  
  // Generic cleanup for absolute paths
  const segments = p.split('/').filter(Boolean);
  if (segments.length > 3) {
    if (p.startsWith('/home/') || p.startsWith('/Users/') || p.includes('/runner/work/')) {
      return './' + segments.slice(-3).join('/');
    }
  }
  
  return p;
};

const Explore = () => {
  const [searchParams] = useSearchParams();
  const { owner, repo } = useParams();
  const [graphData, setGraphData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progressText, setProgressText] = useState("");
  const [progressValue, setProgressValue] = useState(0);

  // Connection parameters for "Playground" mode (CLI/Database)
  const backend = searchParams.get("backend") || "";
  const repoPath = searchParams.get("repo_path") || "";
  const cypherQuery = searchParams.get("cypher_query") || "";
  const bundleUrl = searchParams.get("bundle_url") || "";
  
  // Helper to fetch files using a sequential pool of robust CORS proxies
  const fetchWithFallbackProxies = async (url: string): Promise<Response> => {
    if (!url) throw new Error("URL is empty");
    
    // 1. Check raw githubusercontent.com to bypass proxy using jsDelivr CDN directly
    if (url.includes("raw.githubusercontent.com")) {
      const match = url.match(/raw\.githubusercontent\.com\/([^\/]+)\/([^\/]+)\/([^\/]+)\/(.+)$/);
      if (match) {
        const [_, ownerName, repoName, branch, filepath] = match;
        const jsdelivrUrl = `https://cdn.jsdelivr.net/gh/${ownerName}/${repoName}@${branch}/${filepath}`;
        try {
          const res = await fetch(jsdelivrUrl);
          if (res.ok) return res;
        } catch (e) {
          console.warn("jsDelivr CDN fetch failed, falling back to CORS proxies...", e);
        }
      }
    }

    const proxies = [
      // Proxy 1: corsproxy.io (Very fast, but sometimes blocks large zips)
      (u: string) => `https://corsproxy.io/?${encodeURIComponent(u)}`,
      // Proxy 2: allorigins.win (Extremely reliable for release assets & large archives)
      (u: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
      // Proxy 3: thingproxy.freeboard.io (Fallback proxy)
      (u: string) => `https://thingproxy.freeboard.io/fetch/${u}`
    ];

    let lastError: any = null;
    for (const proxy of proxies) {
      try {
        const proxiedUrl = proxy(url);
        console.log(`[Proxy] Attempting fetch: ${proxiedUrl}`);
        const res = await fetch(proxiedUrl);
        if (res.ok) return res;
        if (res.status === 403 || res.status === 429) {
          console.warn(`[Proxy] Status ${res.status} received. Trying next proxy...`);
          continue;
        }
        return res; // Return regular errors (like 404) directly to avoid looping
      } catch (err) {
        lastError = err;
        console.warn("[Proxy] Connection failed, trying next fallback proxy...", err);
      }
    }
    throw lastError || new Error("Failed to fetch via all available CORS proxies.");
  };

  // If owner and repo path parameters are present, auto-fetch and index the codebase!
  useEffect(() => {
    if (!owner || !repo) return;
    
    // Ignore static routes like "explore" getting caught as owner/repo
    if (owner.toLowerCase() === "explore") return;

    const autoFetchAndIndex = async () => {
      setLoading(true);
      setError(null);
      try {
        // Step 1: Query `/api/bundles` to see if a pre-indexed bundle exists for this repository
        setProgressText("Checking pre-indexed bundle registry...");
        setProgressValue(5);
        
        let bundleUrlToUse = "";
        try {
          const registryRes = await fetch(`/api/bundles?t=${Date.now()}`);
          if (registryRes.ok) {
            const registryData = await registryRes.json();
            const matchingBundle = registryData.bundles?.find(
              (b: any) => b.repo?.toLowerCase() === `${owner}/${repo}`.toLowerCase()
            );
            if (matchingBundle && matchingBundle.download_url) {
              bundleUrlToUse = matchingBundle.download_url;
              console.log("Pre-indexed bundle found in registry:", bundleUrlToUse);
            }
          }
        } catch (registryErr) {
          console.warn("Registry check failed, proceeding with live indexing fallback:", registryErr);
        }

        if (bundleUrlToUse) {
          // --- PRE-INDEXED GRAPH EXTRACTION PATH (FAST ROUTE) ---
          setProgressText("Pre-indexed bundle found! Downloading pre-indexed graph...");
          setProgressValue(20);
          
          const response = await fetchWithFallbackProxies(bundleUrlToUse);
          
          setProgressText("Unpacking pre-indexed bundle...");
          setProgressValue(50);
          const buffer = await response.arrayBuffer();
          const jszip = await JSZip.loadAsync(buffer);
          
          const nodesFile = jszip.file("nodes.jsonl");
          const edgesFile = jszip.file("edges.jsonl");
          
          if (!nodesFile || !edgesFile) {
            throw new Error("Invalid CGC bundle: nodes.jsonl and edges.jsonl are required.");
          }
          
          let metadata: any = {};
          if (jszip.file("metadata.json")) {
            const metaText = await jszip.file("metadata.json")!.async("text");
            try {
              metadata = JSON.parse(metaText);
            } catch (e) {
              console.warn("Could not parse metadata.json", e);
            }
          }
          
          const repoName = metadata.repo || "";
          
          const nodesText = await nodesFile.async("text");
          const nodeLines = nodesText.split("\n").filter(line => line.trim() !== "");
          const nodes = nodeLines.map((line, idx) => {
            try {
              const nodeData = JSON.parse(line);
              const labels = nodeData._labels || [];
              const id = nodeData._id;
              
              const properties: Record<string, any> = {};
              for (const key of Object.keys(nodeData)) {
                if (key !== '_labels' && key !== '_id') {
                  properties[key] = nodeData[key];
                }
              }
              
              for (const key of Object.keys(properties)) {
                if (typeof properties[key] === 'string') {
                  const val = properties[key];
                  if (val.startsWith('/') || val.match(/^[a-zA-Z]:\\/) || val.includes('\\') || val.includes('/')) {
                    if (key === 'path' || key === 'file' || key === 'repo_path' || key === 'import_path') {
                      properties[key] = sanitizePath(val, repoName);
                    }
                  }
                }
              }
              
              let displayName = String(properties.name || properties.label || properties.path || 'Unknown');
              if (displayName.startsWith('/') || displayName.includes('\\') || displayName.includes('/')) {
                displayName = sanitizePath(displayName, repoName);
              }
              
              const type = labels[0] ? (labels[0].charAt(0).toUpperCase() + labels[0].slice(1)) : 'Other';
              
              return {
                id: String(id),
                name: displayName,
                label: displayName,
                type: type,
                file: String(properties.path || properties.file || ''),
                val: (labels.length > 0 && ['Repository', 'Class', 'Interface', 'Trait'].includes(labels[0])) ? 4 : 2,
                properties: properties
              };
            } catch (err) {
              return null;
            }
          }).filter(Boolean);
          
          setProgressText("Linking semantic references...");
          setProgressValue(80);
          
          const edgesText = await edgesFile.async("text");
          const edgeLines = edgesText.split("\n").filter(line => line.trim() !== "");
          const links = edgeLines.map((line, idx) => {
            try {
              const edgeData = JSON.parse(line);
              return {
                id: `${edgeData.from}_to_${edgeData.to}_${edgeData.type}_${idx}`,
                source: String(edgeData.from),
                target: String(edgeData.to),
                type: String(edgeData.type).toUpperCase()
              };
            } catch (err) {
              return null;
            }
          }).filter(Boolean);
          
          const filePaths: string[] = [];
          for (const n of nodes as any[]) {
            if (n.file && n.type.toLowerCase() === 'file') {
              filePaths.push(n.file);
            }
          }
          const sortedFiles = Array.from(new Set(filePaths)).sort();
          
          setProgressText("Complete!");
          setProgressValue(100);
          await new Promise((r) => setTimeout(r, 450));
          
          setGraphData({
            nodes,
            links,
            files: sortedFiles,
            fileContents: {},
            metadata
          });
          return;
        }

        // --- LIVE CODE INDEXING FLOW (FALLBACK ROUTE) ---
        setProgressText("Downloading repository zip archive...");
        setProgressValue(10);
        
        let response;
        try {
          const zipUrl = `https://github.com/${owner}/${repo}/archive/refs/heads/main.zip`;
          response = await fetchWithFallbackProxies(zipUrl);
        } catch (err) {
          const fallbackZipUrl = `https://github.com/${owner}/${repo}/archive/refs/heads/master.zip`;
          response = await fetchWithFallbackProxies(fallbackZipUrl);
        }

        setProgressText("Unzipping archive in-memory...");
        setProgressValue(30);
        const buffer = await response.arrayBuffer();
        const jszip = await JSZip.loadAsync(buffer);
        
        const files: any[] = [];
        const promises: Promise<void>[] = [];
        
        jszip.forEach((path, entry) => {
          if (
            !entry.dir && 
            path.match(/\.(js|ts|jsx|tsx|py|c|h|cpp|hpp|cc|cs|go|rs|rb|php|swift|kt|kts|dart)$/) && 
            !isPathIgnored(path)
          ) {
            promises.push(
              entry.async("text").then((content) => {
                const cleanPath = path.substring(path.indexOf("/") + 1);
                files.push({ path: cleanPath, content });
              })
            );
          }
        });
        
        if (promises.length === 0) {
          throw new Error("No parseable code files found in the repository.");
        }
        
        setProgressText(`Extracting ${promises.length} files...`);
        setProgressValue(45);
        await Promise.all(promises);

        const fileContents: Record<string, string> = {};
        for (const f of files) {
          fileContents[f.path] = f.content;
        }

        setProgressText("Initializing WebAssembly semantic engine...");
        setProgressValue(60);
        
        const graphData = await parseFilesIntoGraph(
          files,
          (msg, val) => {
            setProgressText(msg);
            setProgressValue(val);
          },
          { indexVariables: true }
        );
        
        setProgressText("Complete!");
        setProgressValue(100);
        await new Promise((r) => setTimeout(r, 450));
        
        setGraphData({ ...graphData, fileContents });
      } catch (err: any) {
        console.error("Auto-Index Error:", err);
        setError(err.message);
        toast.error("Auto-Indexing failed: " + err.message);
      } finally {
        setLoading(false);
      }
    };

    autoFetchAndIndex();
  }, [owner, repo]);
  
  // If bundleUrl is present, we download and parse it client-side
  useEffect(() => {
    if (!bundleUrl) return;

    const fetchBundle = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetchWithFallbackProxies(bundleUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch bundle from URL (${response.status})`);
        }
        
        const buffer = await response.arrayBuffer();
        const jszip = await JSZip.loadAsync(buffer);
        
        const nodesFile = jszip.file("nodes.jsonl");
        const edgesFile = jszip.file("edges.jsonl");
        
        if (!nodesFile || !edgesFile) {
          throw new Error("Invalid CGC bundle: nodes.jsonl and edges.jsonl are required.");
        }
        
        let metadata: any = {};
        if (jszip.file("metadata.json")) {
          const metaText = await jszip.file("metadata.json")!.async("text");
          try {
            metadata = JSON.parse(metaText);
          } catch (e) {
            console.warn("Could not parse metadata.json", e);
          }
        }
        
        const repoName = metadata.repo || "";
        
        const nodesText = await nodesFile.async("text");
        const nodeLines = nodesText.split("\n").filter(line => line.trim() !== "");
        const nodes = nodeLines.map((line, idx) => {
          try {
            const nodeData = JSON.parse(line);
            const labels = nodeData._labels || [];
            const id = nodeData._id;
            
            // Extract properties
            const properties: Record<string, any> = {};
            for (const key of Object.keys(nodeData)) {
              if (key !== '_labels' && key !== '_id') {
                properties[key] = nodeData[key];
              }
            }
            
            // Clean absolute paths in node properties
            for (const key of Object.keys(properties)) {
              if (typeof properties[key] === 'string') {
                const val = properties[key];
                if (val.startsWith('/') || val.match(/^[a-zA-Z]:\\/) || val.includes('\\') || val.includes('/')) {
                  if (key === 'path' || key === 'file' || key === 'repo_path' || key === 'import_path') {
                    properties[key] = sanitizePath(val, repoName);
                  }
                }
              }
            }
            
            let displayName = String(properties.name || properties.label || properties.path || 'Unknown');
            if (displayName.startsWith('/') || displayName.includes('\\') || displayName.includes('/')) {
              displayName = sanitizePath(displayName, repoName);
            }
            
            const type = labels[0] ? (labels[0].charAt(0).toUpperCase() + labels[0].slice(1)) : 'Other';
            
            return {
              id: String(id),
              name: displayName,
              label: displayName,
              type: type,
              file: String(properties.path || properties.file || ''),
              val: (labels.length > 0 && ['Repository', 'Class', 'Interface', 'Trait'].includes(labels[0])) ? 4 : 2,
              properties: properties
            };
          } catch (err) {
            console.error("Failed to parse node line at index", idx, err);
            return null;
          }
        }).filter(Boolean);
        
        const edgesText = await edgesFile.async("text");
        const edgeLines = edgesText.split("\n").filter(line => line.trim() !== "");
        const links = edgeLines.map((line, idx) => {
          try {
            const edgeData = JSON.parse(line);
            return {
              id: `${edgeData.from}_to_${edgeData.to}_${edgeData.type}_${idx}`,
              source: String(edgeData.from),
              target: String(edgeData.to),
              type: String(edgeData.type).toUpperCase()
            };
          } catch (err) {
            console.error("Failed to parse edge line at index", idx, err);
            return null;
          }
        }).filter(Boolean);
        
        const filePaths: string[] = [];
        for (const n of nodes as any[]) {
          if (n.file && n.type.toLowerCase() === 'file') {
            filePaths.push(n.file);
          }
        }
        const sortedFiles = Array.from(new Set(filePaths)).sort();
        
        setGraphData({
          nodes,
          links,
          files: sortedFiles,
          fileContents: {},
          metadata
        });
      } catch (err: any) {
        console.error("Fetch Bundle Error:", err);
        setError(err.message);
        toast.error("Failed to load bundle: " + err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchBundle();
  }, [bundleUrl]);

  // If backend param is present, we automatically fetch from the local python server
  useEffect(() => {
    if (!backend && !cypherQuery) return;

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const url = new URL("/api/graph", backend || window.location.origin);
        if (repoPath) url.searchParams.append("repo_path", repoPath);
        if (cypherQuery) url.searchParams.append("cypher_query", cypherQuery);

        const response = await fetch(url.toString());
        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.detail || `Server error (${response.status})`);
        }

        const data = await response.json();
        setGraphData(data);
      } catch (err: any) {
        console.error("Fetch Error:", err);
        setError(err.message);
        toast.error("Failed to connect to local index: " + err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [backend, repoPath, cypherQuery]);

  if (loading) {
    const isAutoIndexing = owner && repo && owner.toLowerCase() !== "explore";
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background text-center px-6 max-w-md mx-auto">
        <Loader2 className="w-14 h-14 animate-spin text-purple-500 mb-6 drop-shadow-[0_0_15px_rgba(168,85,247,0.4)]" />
        <p className="text-lg font-medium text-white mb-4 animate-pulse">
          {isAutoIndexing 
            ? progressText 
            : (bundleUrl ? "Downloading and parsing pre-indexed CGC bundle..." : "Connecting to local database...")}
        </p>
        {isAutoIndexing && (
          <div className="w-full bg-gray-800 rounded-full h-2 mt-2 overflow-hidden shadow-inner border border-white/5">
            <div 
              className="bg-gradient-to-r from-purple-400 to-indigo-400 h-2 rounded-full transition-all duration-300 ease-out" 
              style={{ width: `${progressValue}%`, boxShadow: '0 0 15px rgba(168, 85, 247, 0.8)' }}
            />
          </div>
        )}
        {isAutoIndexing && (
          <p className="text-xs text-gray-400 font-mono mt-3">{progressValue}%</p>
        )}
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background px-6 text-center">
        <h1 className="text-2xl font-bold mb-2 text-red-500">Connection Error</h1>
        <p className="text-muted-foreground max-w-md mb-8">{error}</p>
        <button onClick={() => window.location.reload()} className="bg-primary text-primary-foreground px-6 py-2 rounded-lg">Retry</button>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-background pt-24 pb-12 px-6 flex flex-col items-center">
      <AnimatePresence mode="wait">
        {!graphData ? (
          <motion.div 
            key="uploader"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="w-full max-w-4xl mx-auto flex flex-col items-center mt-12"
          >
            <div className="text-center mb-12">
              <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-blue-400 to-indigo-500 bg-clip-text text-transparent">
                Graph Explorer
              </h1>
              <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
                Instantly visualize your code architecture. Scan local files via WebAssembly or connect to your local CLI index.
              </p>
            </div>
            
            <div className="w-full max-w-2xl">
              <LocalUploader onComplete={setGraphData} />
            </div>
          </motion.div>
        ) : (
          <CodeGraphViewer 
            key="viewer" 
            data={graphData} 
            onClose={() => setGraphData(null)}
          />
        )}
      </AnimatePresence>
    </main>
  );
};

export default Explore;
