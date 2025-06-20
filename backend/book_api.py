import time
import requests
import modal
import re
import subprocess
from collections import Counter, defaultdict
from pathlib import Path

# strip and remove copy right info 
HDR = re.compile(r"\*\*\* *start of .*?project gutenberg ebook", re.I)
FTR = re.compile(r"\*\*\* *end of .*?project gutenberg ebook", re.I)

def core_text(txt: str) -> str:
    """strip Gutenberg header/footer"""

    h = HDR.search(txt); f = FTR.search(txt)
    if not h or not f or f.start() <= h.end():      # if fails, send everything
        return txt
    start = txt.find("\n", h.end()) + 1
    return txt[start : f.start()].strip()

# modal image 
image = (
    modal.Image.from_registry(
        "nvidia/cuda:12.4.0-devel-ubuntu22.04", add_python="3.10"
    )
    .apt_install("curl")
    .pip_install_from_requirements("requirements-modal.txt")
    .run_commands("python -m spacy download en_core_web_trf -qq")
)

app = modal.App("book-ner", image=image)

def get_text(gutenberg_id: int):
    """Get book text from local file or download from Gutenberg."""
    
    # Check for local copy of Pride and Prejudice
    if gutenberg_id == 1342 and Path("pg11.txt").exists():
        return core_text(Path("pg11.txt").read_text(encoding='utf-8'))
        
    # Download from Gutenberg
    temp_file = f"gutenberg_{gutenberg_id}.txt"
    url = f"https://www.gutenberg.org/files/{gutenberg_id}/{gutenberg_id}-0.txt"
    
    try:
        result = subprocess.run(
            ["curl", "-L", "--max-time", "30", url, "-o", temp_file],
            capture_output=True,
            text=True
        )
        
        if result.returncode == 0:
            text = Path(temp_file).read_text(encoding='utf-8')
            if len(text) > 1000:
                return core_text(text)
                
        return {"error": f"Failed to download or validate book {gutenberg_id}"}
            
    except Exception as e:
        return {"error": str(e)}

@app.function(gpu="A10", min_containers=1, timeout=600)
def spacy_count(raw_text: str, book_id: int = 1324):
    """
    A barebones function takes in a book and returns raw spaCy PERSON counts.
    """
    print(f"\n=== Processing book {book_id} ===")
    print(f"Input text length: {len(raw_text)} characters")
    print(f"First 100 chars: {raw_text[:100]}")
    
    # load spaCy
    import spacy
    print("\nInitializing spaCy...")
    spacy.require_gpu()
    print("GPU requirement set")

    # Disable pipeline components we don't need for faster inference
    nlp = spacy.load("en_core_web_trf", disable=["tagger", "parser", "lemmatizer"])
    print("Model loaded successfully")

    # Process text in blocks like strip.py does
    blocks = [raw_text[i:i+25_000] for i in range(0, len(raw_text), 25_000)]
    print(f"\nSplit text into {len(blocks)} blocks of ~25k chars each")
    spans = []
    t0 = time.perf_counter()
    
    print("\nProcessing blocks through spaCy pipeline...")
    for i, doc in enumerate(nlp.pipe(blocks, batch_size=1024)):
        block_spans = [(ent.text, ent.start_char, ent.end_char)
                      for ent in doc.ents if ent.label_ == "PERSON"]
        spans += block_spans
        print(f"Block {i+1}/{len(blocks)}: Found {len(block_spans)} PERSON entities")
                  
    print(f"\nspaCy NER finished in {time.perf_counter() - t0:.2f}s.")
    print(f"Total PERSON mentions found: {len(spans)}")
    
    if len(spans) > 0:
        print("\nFirst 5 PERSON mentions found:")
        for span in spans[:5]:
            print(f"  - {span[0]} (pos: {span[1]}-{span[2]})")
    else:
        print("\nWARNING: No PERSON entities found in the text!")
        print("This might indicate an issue with the text content or processing")

    # count our person entities using the same approach as strip.py
    buckets = defaultdict(set)
    counts = Counter()
    
    for name, *_ in spans:
        name = name.strip()
        counts[name] += 1
        buckets[name].add(name)

    # Sort results
    sorted_counts = sorted(counts.items(), key=lambda x: x[1], reverse=True)

    print("\nCharacter frequency analysis complete")
    print(f"Found {len(sorted_counts)} unique characters")
    
    if len(sorted_counts) > 0:
        print("\nTop 5 most frequent characters:")
        for name, count in sorted_counts[:5]:
            print(f"  - {name}: {count} mentions")

    # json payload we send back to frontend 
    return {
        "book_id": book_id,
        "total_person_mentions": len(spans),
        "unique_person_entities": len(sorted_counts),
        "characters": sorted_counts[:50]  # Return top 50 characters
    }

def create_graph(list):
    # TO DO, create a graph based on how many times each character appears
    return 0

def count_interactions_spacy():
    # TO DO, maybe add interaction if two names within 200 chars; 
    # wouldn't be accurate as X mentioning Y to Z doesn't mean Y interacting with X or Z
    # rename to obsession index or smthn lmao 

    return 0

@app.function()
def count_interactions_llm(text):
    # TO DO, parse the text and make it a small ammount
    # then use groq with a smart prompt and have it count interactions and add them to a dict somehow 

    return 0 
    

@app.local_entrypoint()
def test():
    book_id = 11  # Alice in Wonderland
    print("\n=== Starting test with Alice in Wonderland (ID: 11) ===")
    
    text = get_text(book_id)
    if isinstance(text, dict) and "error" in text:
        print(f"Error: {text['error']}")
        return
        
    print("\nSuccessfully retrieved text, sending to spaCy for analysis...")
    result = spacy_count.remote(text, book_id)
    print("\nFinal results:")
    print(result)


  


@modal.fastapi_endpoint(method="POST", docs=True)
def main(data):

    r = spacy_count.remote(data.gutenberg_id, data.type)


