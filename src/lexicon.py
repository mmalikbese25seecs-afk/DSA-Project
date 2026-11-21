# imporitng libraries
import json
import sys
import time # to measure the execution time
from pathlib import Path # used to handle file and folder paths
# importing the preprocess_doc function from preprocess.py file
from preprocess import preprocess_doc 

# defining the paths for the input data, sample data, and output lexicon file
BASE = Path(__file__).parent.parent                 # main project folder 
DATA = BASE / "data" / "arxiv_cs_100k.jsonl"
SAMPLE = BASE / "data" / "sample" / "sample_1000.jsonl"
OUT = BASE / "index" / "lexicon.json"               # path to store output lexicon file

# function to build lexicon from the input data and store it in the output file
def build_lexicon(src_path, out_path):
    # initialing variables
    words = set()       # to store unique words from the documents
    docs = skipped = 0  # counter for docs processed and skipped
    start = time.time() # to record execution time

    # reading the input dataset line by line
    with open(src_path, encoding="utf-8") as f:
        for line in f:
            doc = preprocess_doc(json.loads(line)) # converts json to python dictionary and preprocesses it
            if doc is None:              # empty title or abstract
                skipped += 1
                continue
            words.update(doc["title_tokens"])    # add title tokens to the set of unique words
            words.update(doc["abstract_tokens"]) # add abstract tokens to the set of unique words
            docs += 1
            if docs % 10000 == 0:
                print(f"{docs} docs, {len(words)} words so far") # print progress every 10,000 documents and tells number of unique words found
    
    # sorts all unique words alphabetically
    # enumerate() assigns a sequential integer ID to each sorted word starting from 0
    # same sorted ids for each run so that the lexicon is consistent across runs 
    lexicon = {word: i for i, word in enumerate(sorted(words))}

    # location of output file
    out_path.parent.mkdir(parents=True, exist_ok=True)  # creates folder if they don't exist 
    with open(out_path, "w", encoding="utf-8") as f:    # saves lexicon to output file in json format
        json.dump(lexicon, f)

    # print final summary of the processing and execution time
    print(f"Done: {docs} docs, {skipped} skipped, {len(lexicon)} unique words, "
          f"{time.time() - start:.1f}s -> {out_path}")

# main block
# use terminal to choose between full dataset or sample dataset
if __name__ == "__main__":

    use_sample = len(sys.argv) > 1 and sys.argv[1] == "sample"
    build_lexicon(SAMPLE if use_sample else DATA, OUT)