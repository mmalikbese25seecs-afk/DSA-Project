#importing required libraries
import re
import json
from functools import lru_cache #helps to not calculate the same word again and again
from pathlib import Path # handles file paths
import snowballstemmer # library for stemming words

REMOVE_STOPWORDS = True # will be used to track whether to remove stopwords(the, is, are) or not 
MIN_TOKEN_LEN = 2

STOPWORDS = { #set of stopwords to be removed
    "a", "an", "and", "are", "as", "at", "be", "been", "but", "by", "for", "from",
    "has", "have", "he", "in", "is", "it", "its", "of", "on", "or", "that", "the",
    "their", "this", "to", "was", "we", "were", "which", "with", "our", "can",
    "also", "such", "these", "those", "than", "then", "into", "not", "may", "use",
}

_stemmer = snowballstemmer.stemmer("english") #creates object of stemmer class, will be used to stem words
_LATEX_MATH = re.compile(r"\$[^$]*\$") # will be used to remove latex(only dollar enclosed) math expressions from the text
_TOKEN = re.compile(r"[a-z0-9]+") # extracts lower case and numbers from the text, anything else acts as a separator

# function to convert to stem form, if a word appeared multiple times it will store it once
@lru_cache(maxsize=None)
def stem(word):
    return _stemmer.stemWord(word)

# function that accepts string of text and returns a list of stemmed tokens, removing stopwords and short tokens
def preprocess(text):
    """Raw text -> list of stemmed tokens (list index = word position)."""
    if not text:
        return []                          # if text is empty return empty list
    text = _LATEX_MATH.sub(" ", text)      # remove math expressions
    text = text.lower()                    # convert to lower case
    tokens = _TOKEN.findall(text)          # anything not a-z/0-9 acts as a separator
    out = []    # to store final list of tokens after processing
    for t in tokens:                       # loop through each token
        if len(t) < MIN_TOKEN_LEN:         # removes short tokens, if length of token is less than 2
            continue
        if REMOVE_STOPWORDS and t in STOPWORDS: # if token is a stopword then remove it 
            continue
        out.append(stem(t)) # converts the token to its stem form and adds to the final list
    return out


def preprocess_doc(record):
    """One dataset record -> dict of token lists + metadata. Returns None if unusable."""
    title = (record.get("title") or "").strip()       # gets the title from the record, if not present then empty string, and removes extra spaces
    abstract = (record.get("abstract") or "").strip() # do the same for abstract
    if not title or not abstract:                     # if any of them is empty then skip the doc
        return None     
    return {
        # the following are the fields that will be returned for each document
        "id": record["id"],
        "title_tokens": preprocess(title),
        "abstract_tokens": preprocess(abstract),
        "categories": (record.get("categories") or "").split(), # splits the categories into list
        "year": record.get("year"),
        "update_date": record.get("update_date"),
        "n_versions": record.get("n_versions", 1),
    }

#temo chack
if __name__ == "__main__":

    sample = Path(__file__).parent.parent / "data" / "sample" / "sample_1000.jsonl"

    with open(sample, encoding="utf-8") as f:
        for i, line in enumerate(f):
            record = json.loads(line)
            doc = preprocess_doc(record)

            if doc is None:
                continue

            print(doc["id"], doc["title_tokens"])

            if i == 999:
                break