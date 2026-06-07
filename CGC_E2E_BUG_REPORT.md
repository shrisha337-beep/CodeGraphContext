# CGC E2E Bug Report (Re-run — 2026-06-07)

- **Date:** 2026-06-07 (manual subprocess execution)
- **CGC version:** 0.4.16
- **Install:** editable (`pip install -e .` from repo working tree — includes SEC/BUG fixes not yet on PyPI)
- **Python:** 3.12.3
- **OS:** Linux 6.8
- **Method:** Subprocess-only per [E2E plan](/home/shashank/.cursor/plans/cgc_e2e_bug_hunt_6028a5c6.plan.md). **No pytest.** Golden files used as reference only.
- **Harness:** `scripts/e2e_bug_hunt_runner.py` + supplemental manual `cgc` invocations
- **Sample project golden:** 482 nodes / 619 edges (`tests/fixtures/goldens/sample_project/`) — refreshed 2026-06-07

---

## Executive Summary

| Metric | Result |
|--------|--------|
| Embedded backends exercised | FalkorDB Lite, KuzuDB, LadybugDB — **all PASS core suite** |
| Remote backends | FalkorDB-remote index PASS; Neo4j doctor FAIL (container timing); Nornic SKIP |
| Context isolation | **PASS** (named contexts isolated; Kuzu CtxA/CtxB verified) |
| MCP security (write CREATE) | **PASS** (blocked) |
| Viz `/api/file` sandbox | **PASS** (HTTP 403 outside roots) |
| **New bugs this run** | **5 found → 5 fixed** (see §Bugs Found / §Post-Fix Verification) |
| **Previously reported bugs now verified fixed** | 20+ (see §Verified Fixes) |

**Verdict:** The **5 bugs from this E2E re-run are fixed** in the current working tree. Residual risk items (§Residual Risk) remain unprobed; the project is much healthier but not exhaustively verified bug-free.

---

## Test Matrix Summary

| Backend | index | chain f1→f3 | find f1 | find content | query write block | bundle export | doctor exit |
|---------|-------|-------------|---------|--------------|-------------------|---------------|-------------|
| **falkordb** | PASS (1.5–1.8s) | PASS | PASS (16 matches) | PASS | PASS (exit≠0) | PASS | PASS (0) |
| **kuzudb** | PASS (~20s) | PASS | PASS | PASS | PASS | PASS | PASS (0) |
| **ladybugdb** | PASS (~16s) | PASS | PASS | PASS | PASS | PASS | PASS (0) |
| **falkordb-remote** | PASS | — | — | — | — | — | **PASS** (exit 1 without host — see BUG-081 fix) |
| **neo4j** | SKIP | — | — | — | — | — | FAIL (docker) |
| **nornic** | SKIP | — | — | — | — | — | SKIP (no creds) |

---

## Cross-Backend Parity (sample_project)

| Backend | Nodes | Edges | Node drift vs golden | Edge drift |
|---------|-------|-------|----------------------|------------|
| falkordb | 482 | 620 | **0%** (golden refreshed) | ~0% |
| kuzudb | 482 | 620 | **0%** | ~0% |
| ladybugdb | 482 | 620 | **0%** | ~0% |

Commands:
```bash
HOME=/tmp/... DEFAULT_DATABASE=<backend> cgc index --force tests/fixtures/sample_projects/sample_project
cgc query "MATCH (n) RETURN count(n)"
cgc query "MATCH ()-[r]->() RETURN count(r)"
```

**Observation:** All three embedded backends agree with each other (good parity). Prior +30 node drift vs old golden 452 was caused by `Module`/`ExternalClass` nodes (no `path` property) being counted by `MATCH (n)` but omitted from bundle export; bundle export now includes them and goldens were refreshed to 482.

---

## 20-Language Accuracy Sweep (FalkorDB, isolated HOME per language)

| Fixture | Golden N/E | Actual N/E | Node drift | Status |
|---------|------------|------------|------------|--------|
| sample_project | 482/619 | 482/620 | 0% | OK |
| sample_project_c | 83/96 | 83/96 | 0% | OK |
| sample_project_cpp | 128/170 | 136/167 | 6.2% | OK |
| sample_project_csharp | 129/212 | 141/212 | 9.3% | OK |
| sample_project_dart | 47/64 | 49/64 | 4.3% | OK |
| sample_project_elixir | 50/81 | 53/81 | 6.0% | OK |
| sample_project_go | 655/831 | 660/831 | 0.8% | OK |
| sample_project_haskell | 43/50 | 45/50 | 4.7% | OK |
| sample_project_java | 160/220 | 160/220 | 0% | OK |
| sample_project_javascript | 233/300 | 236/300 | 1.3% | OK |
| sample_project_kotlin | 187/241 | 189/242 | 1.1% | OK |
| sample_project_lua | 50/55 | 52/55 | 4.0% | OK |
| sample_project_misc | 27/26 | 27/26 | 0.0% | OK |
| sample_project_perl | 71/94 | 71/94 | 0% | OK |
| sample_project_php | 754/875 | 757/866 | 0.4% | OK |
| sample_project_ruby | 71/105 | 74/105 | 4.2% | OK |
| sample_project_rust | 773/915 | 803/915 | 3.9% | OK |
| sample_project_scala | 130/171 | 130/171 | 0.0% | OK |
| sample_project_swift | 135/178 | 136/178 | 0.7% | OK |
| sample_project_typescript | 904/1330 | 918/1330 | 1.5% | OK |

20/20 languages within tolerance after golden refresh. Edge drift ≤1.8% everywhere.

---

## CLI Exit-Code Audit (FalkorDB, fresh HOME)

| Command | Expected | Actual | Status |
|---------|----------|--------|--------|
| `cgc config set DEFAULT_DATABASE badval` | exit 1 | exit 1 | **PASS** |
| `cgc watch /nonexistent` | exit 1 | exit 1 | **PASS** |
| `cgc find name f1 --type typo` | exit 1 | exit 1 | **PASS** |
| `cgc bundle export ... --repo /tmp/unindexed` | exit 1 | exit 1 | **PASS** |
| `cgc delete --all` with `ALLOW_DB_DELETION=false` | exit 1 | exit 1 | **PASS** |
| `cgc doctor` (healthy falkordb) | exit 0 | exit 0 | **PASS** |
| `cgc index --context GhostCtx` (unregistered) | exit 1 | exit 1 | **PASS** |
| `cgc registry search nonexistent_pkg` | exit 1 | exit 1 | **PASS** |
| `cgc query "CREATE ..."` | exit ≠0 | blocked | **PASS** |

---

## Context System (Phase 2)

| Scenario | Result |
|----------|--------|
| Named CtxA indexed, CtxB empty | **PASS** — CtxB stats show no Functions |
| Kuzu CtxA has f1, CtxB query returns `[]` | **PASS** — context switch no longer stale |
| Ghost context `index --context GhostCtx` | **PASS** — rejected, must `context create` first |

---

## MCP E2E (Phase 4)

| Probe | Result |
|-------|--------|
| `cgc mcp tools` | 25 tools listed (Rich table) |
| `tools/list` JSON-RPC | 25 tools — **matches** |
| `execute_cypher_query` with `CREATE` | **blocked** (read-only guard) |
| `discover_codegraph_contexts` path=/etc | **rejected** (sandbox) |
| `add_code_to_graph` bad path | returns error (not silent success) |

---

## Security Probes (Phase 5)

| Probe | Result |
|-------|--------|
| Viz `GET /api/file?path=/etc/passwd` | **403** — `File path is outside allowed roots` |
| Viz `GET /../../../../etc/passwd` | **200** — returns SPA `index.html` (not file read; acceptable) |
| MCP Cypher `CREATE` | blocked |
| MCP path outside `CGC_ALLOWED_ROOTS` | blocked on watch/index/discover |

---

## Bugs Found This Run

### BUG-081: `cgc doctor` passes for `falkordb-remote` without `FALKORDB_HOST` — **FIXED**
- **Severity:** Medium
- **Fix:** Added dedicated `falkordb-remote` branch in `doctor()` using `FalkorDBRemoteManager.validate_config()` + `test_connection()`; split from FalkorDB Lite check.
- **Verified:** `unset FALKORDB_HOST && cgc doctor` → exit **1**, config invalid message shown.

### BUG-082: Python `sample_project` node count drift vs golden — **FIXED**
- **Severity:** Low–Medium
- **Root cause:** `Module` (27) + `ExternalClass` (3) nodes lack `path`; bundle export filtered by path only while `MATCH (n)` counted them.
- **Fix:** `CGCBundle._extract_nodes/_extract_edges` now include repo-linked `Module`/`ExternalClass` nodes; goldens refreshed to **482** nodes.

### BUG-083: C fixture node drift — **FIXED**
- **Root cause:** Same as BUG-082 (+9 `Module` nodes).
- **Fix:** Bundle export + golden refresh → **83** nodes.

### BUG-084: Java fixture node drift — **FIXED**
- **Root cause:** +16 `Module` + 1 `ExternalClass`.
- **Fix:** Bundle export + golden refresh → **160** nodes.

### BUG-085: Perl fixture node drift — **FIXED**
- **Root cause:** +7 `Module` nodes.
- **Fix:** Bundle export + golden refresh → **71** nodes.

---

## Doc / UX Inconsistencies (verified)

| Item | Status |
|------|--------|
| Project `.codegraphcontext/.env` merges when cwd is repo root | **FIXED** — `should_apply_project_dotenv()` skips cwd project env when `cwd` ∉ `$HOME` unless `CGC_LOAD_PROJECT_ENV=1` |
| `cgc mcp tools` count vs code | **25 = 25** — docs drift fixed |
| Kuzu ~3× slower than FalkorDB | **Confirmed** (~20s vs ~1.8s index) — performance, not correctness |

---

## Skipped Tests

| Item | Reason |
|------|--------|
| Neo4j full matrix | `cgc doctor` exit 1 — container `cgc-neo4j-e2e` not ready / auth within probe window |
| Nornic | No `NORNIC_URI` credentials on host |
| `cgc watch` live edit loop | Not run (blocking; would add ~10 min) |
| `cgc api start` | Not run this pass |
| Production-scale repo | Out of scope |

---

## Verified Fixes (prior bugs — re-tested this run)

| Area | Prior ID | This run |
|------|----------|----------|
| `analyze chain f1 f3` | BUG-003/048 | **PASS** all 3 backends |
| `cgc doctor` exit code on healthy setup | BUG-031 | **PASS** exit 0 |
| `cgc config set` invalid value | BUG-035 | **PASS** exit 1 |
| `ALLOW_DB_DELETION` guard | BUG-037/074 | **PASS** |
| Kuzu context switch stale DB | BUG-063 | **PASS** |
| Ghost context auto-create | BUG-080 | **PASS** — rejected |
| Viz arbitrary file read | SEC-062/063 | **PASS** — 403 |
| MCP Cypher write guard | SEC-067 | **PASS** |
| Registry search empty | BUG-030 | **PASS** exit 1 |
| Bundle export empty repo | BUG-073 | **PASS** exit 1 |
| FalkorDB worker leak | BUG-056 | Not re-tested (requires MCP stress) |
| `falkordb-remote` doctor without host | BUG-081 | **PASS** exit 1 |
| Parser golden drift (Python/C/Java/Perl) | BUG-082–085 | **PASS** — goldens refreshed, 20/20 golden tests |
| Project `.env` leak with isolated HOME | — | **PASS** — only `$HOME/.codegraphcontext/.env` loaded |

---

## Post-Fix Verification (2026-06-07)

| Check | Result |
|-------|--------|
| `cgc doctor` falkordb-remote, no `FALKORDB_HOST` | exit **1** |
| Isolated `HOME` from repo cwd | loads only `/tmp/.../.codegraphcontext/.env` |
| Bundle export vs `MATCH (n)` for sample_project | **482 = 482** |
| `pytest tests/integration/test_parser_goldens.py` | **20 passed** |
| `pytest tests/` | **553 passed**, 2 skipped |

---

## Residual Risk (not exhaustively probed)

1. Path-sandbox TOCTOU (symlink race)
2. Novel Cypher bypass on Kùzu/FalkorDB (regex-only guard)
3. Long-running MCP job memory
4. Windows path behavior
5. Repos >100k files
6. PyPI-published 0.4.16 may **lack** local SEC fixes until next release

---

## Recommendations

1. **Publish** current working tree to PyPI so `pip install codegraphcontext` matches repo fixes
2. **Document** `CGC_LOAD_PROJECT_ENV=1` / `CGC_IGNORE_PROJECT_ENV=1` for advanced env isolation
3. **Re-run** full manual E2E harness (`scripts/e2e_bug_hunt_runner.py`) before release

---

## Test Artifacts

| Path | Contents |
|------|----------|
| `/tmp/cgc-e2e-venv/` | Test venv (editable install) |
| `/tmp/cgc-e2e-results/hunt_state.json` | Automated runner raw JSON |
| `scripts/e2e_bug_hunt_runner.py` | Repeatable harness |
