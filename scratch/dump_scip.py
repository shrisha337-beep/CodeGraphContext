import sys
from codegraphcontext.tools import scip_pb2

def dump(file_path):
    with open(file_path, "rb") as f:
        index = scip_pb2.Index()
        index.ParseFromString(f.read())

    for doc in index.documents:
        for sym_info in doc.symbols:
            if "Flyable" in sym_info.symbol:
                print(f"Symbol: {sym_info.symbol}, Kind: {sym_info.kind}, Display: {sym_info.display_name}")

if __name__ == "__main__":
    sys.path.append("src")
    dump(sys.argv[1])
