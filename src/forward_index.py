# importing libraries
import json
import sys
import time
from collections import Counter     # counts how many times each word appears
from pathlib import Path
from preprocess import preprocess_doc

# paths
BASE = Path(__file__).parent.parent
DATA = BASE / "data" / "arxiv_cs_100k.jsonl"
SAMPLE = BASE / "data" / "sample" / "sample_1000.jsonl"
LEXICON = BASE / "index" / "lexicon.json"        # input: made by build_lexicon.py
OUT = BASE / "index" / "forward_index.txt"       # output: the forward index


def to_entries(tokens, lexicon):
    """Turn a list of words into text like '1:1, 4:3, 7:2' (word_id:frequency)."""
    counts = Counter(tokens)                      # {word: frequency}
    pairs = []
    for word, freq in counts.items():
        word_id = lexicon.get(word)
        if word_id is not None:                   # safety check
            pairs.append((word_id, freq))
    pairs.sort()                                  # order by word ID
    return ", ".join(f"{w}:{f}" for w, f in pairs)


def build_forward_index(src_path, lexicon_path, out_path):
    start = time.time()
    docs = skipped = 0

    # load the lexicon once: {word: word_id}
    with open(lexicon_path, encoding="utf-8") as f:
        lexicon = json.load(f)

    out_path.parent.mkdir(parents=True, exist_ok=True)

    with open(src_path, encoding="utf-8") as src, \
         open(out_path, "w", encoding="utf-8") as out:

        # doc_id = line number in the dataset, starting from 1
        for doc_id, line in enumerate(src, start=1):
            doc = preprocess_doc(json.loads(line))
            if doc is None:                       # empty title or abstract
                skipped += 1
                continue

            # title and abstract are counted separately
            title_entries = to_entries(doc["title_tokens"], lexicon)
            abstract_entries = to_entries(doc["abstract_tokens"], lexicon)

            # one line per document: doc 1    T: 4:1, 9:1    A: 1:1, 4:2, 7:2
            out.write(f"doc {doc_id}\tT: {title_entries}\tA: {abstract_entries}\n")

            docs += 1
            if docs % 10000 == 0:
                print(f"{docs} docs processed")

    print(f"Done: {docs} docs, {skipped} skipped, "
          f"{time.time() - start:.1f}s -> {out_path}")


if __name__ == "__main__":
    use_sample = len(sys.argv) > 1 and sys.argv[1] == "sample"
    build_forward_index(SAMPLE if use_sample else DATA, LEXICON, OUT)