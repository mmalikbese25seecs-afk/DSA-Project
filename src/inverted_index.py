# importing libraries
import time
from collections import defaultdict
from pathlib import Path

# paths
BASE = Path(__file__).parent.parent
FORWARD = BASE / "index" / "forward_index.txt"    # input: made by forward_index.py
OUT = BASE / "index" / "inverted_index.txt"       # output: the inverted index


def parse_entries(text):
    """Turn '4:1, 9:1' into {4: 1, 9: 1} (word_id: frequency)."""
    result = {}
    text = text.strip()
    if not text:                                  # empty title or abstract
        return result
    for item in text.split(", "):
        word_id, freq = item.split(":")
        result[int(word_id)] = int(freq)
    return result


def build_inverted_index(forward_path, out_path):
    start = time.time()
    docs = 0

    # {word_id: [(doc_id, title_freq, abstract_freq), ...]}
    index = defaultdict(list)

    # reading the forward index line by line
    with open(forward_path, encoding="utf-8") as f:
        for line in f:
            # line looks like: doc 1<TAB>T: 4:1, 9:1<TAB>A: 1:1, 4:2
            doc_part, title_part, abstract_part = line.rstrip("\n").split("\t")

            doc_id = int(doc_part.split()[1])                # "doc 1" -> 1
            title = parse_entries(title_part[2:])            # remove "T:"
            abstract = parse_entries(abstract_part[2:])      # remove "A:"

            # every word that appears in the title or the abstract of this doc
            for word_id in title.keys() | abstract.keys():
                index[word_id].append(
                    (doc_id, title.get(word_id, 0), abstract.get(word_id, 0))
                )

            docs += 1
            if docs % 10000 == 0:
                print(f"{docs} docs read, {len(index)} words so far")

    # writing one line per word, sorted by word ID
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as out:
        for word_id in sorted(index):
            entries = ", ".join(f"{d}:{t}:{a}" for d, t, a in index[word_id])
            out.write(f"{word_id}\t{entries}\n")

    print(f"Done: {docs} docs, {len(index)} words, "
          f"{time.time() - start:.1f}s -> {out_path}")


if __name__ == "__main__":
    build_inverted_index(FORWARD, OUT)