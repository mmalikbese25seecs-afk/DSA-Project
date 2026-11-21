#making samply data 
with open("data/arxiv_cs_100k.jsonl", encoding="utf-8") as src, \
     open("data/sample/sample_1000.jsonl", "w", encoding="utf-8") as dst:
    for i, line in enumerate(src):
        #first 1000 lines were taken as sample data of the actual data 
        if i == 1000:
            break
        dst.write(line)