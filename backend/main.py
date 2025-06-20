import time
import requests
import modal
import re
import subprocess
from collections import Counter, defaultdict
from pathlib import Path
from typing import Literal
from pydantic import BaseModel
import os
from dotenv import load_dotenv
from collections import deque

# Load environment variables from .env file
load_dotenv()

# Create a Modal secret containing API keys
groq_secret = modal.Secret.from_name("api-keys")

# Pydantic types 

class AnalysisRequest(BaseModel):
    gutenberg_id: int
    analysis_type: Literal["spacy", "llm"]

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
    modal.Image.debian_slim(python_version="3.10")
    .pip_install_from_requirements("requirements-modal.txt")
    .run_commands("python -m spacy download en_core_web_sm")
)

app = modal.App("copy-scapy-ner", image=image)

# get book.txt
def get_text(gutenberg_id: int):
    """Get book text from local file or download from Gutenberg."""
    
        
    # Download from Gutenberg
    url = f"https://www.gutenberg.org/files/{gutenberg_id}/{gutenberg_id}-0.txt"
    
    try:
        response = requests.get(url, timeout=30)
        response.raise_for_status()
        
        text = response.text
        if len(text) > 1000:
            return core_text(text)
            
        return {"error": f"Failed to download or validate book {gutenberg_id}"}
            
    except Exception as e:
        return {"error": str(e)}

# get book meta_data
def get_meta_data(id: int):
    m = requests.get(f"https://www.gutenberg.org/ebooks/{id}")
    # Find the <title>
    html = m.text

    import re

    title_match = re.search(r"<title>(.*?)\|", html, re.IGNORECASE)
    title = title_match.group(1).strip() if title_match else None

    if title and " by " in title:
        book_title, author = title.split(" by ")
        return ({"Title": title, "Author": author })
    else:
        return ({"Title": title, "Author": "UnKnown" })
        


@app.function(secrets=[groq_secret])
def check_chars_with_llm(characters: list[tuple[str, int]], book_id: int):
    print("\n=== Starting LLM character filtering ===")
    print(f"Initial character count: {len(characters)}")
    print("First 5 characters before filtering:")
    if characters:
        for char in characters[:5]:
            print(f"  - {char[0]}: {char[1]}")
    
    # choose key
    openai_key = os.getenv("OPENAI_API_KEY")
    if not openai_key:
        print("[check_chars_with_llm] No OPENAI_API_KEY found:")
        print("  • For deployment: Key is loaded from Modal secret 'api-keys'")
        print("  • For local dev: Add OPENAI_API_KEY to backend/.env")
        print("Returning unfiltered character list...")
        return characters

    from openai import OpenAI
    client = OpenAI(
        api_key=openai_key,
        base_url=os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1")
    )

    # Fetch metadata for context 
    meta = get_meta_data(book_id)
    title = meta.get("Title", f"Gutenberg book #{book_id}")
    author = meta.get("Author", "Unknown")
    print(f"\nBook context - Title: {title}, Author: {author}")

    char_list_str = "\n".join(f"- {name}: {count}" for name, count in characters)
    print("\nSending request to OpenAI (GPT-4)...")

    system_prompt = (
        "You are a literary expert. Given a list of names automatically extracted "
        "from a novel, identify which items are *not* actual characters in the story "
        "and consolidate different variations of the same character's name. "
        "Your tasks:\n\n"
        "1. Remove non-character entries like:\n"
        "   - Publishing metadata (e.g., 'Project Gutenberg', 'Editor')\n"
        "   - Chapter indicators or formatting\n"
        "   - Author names (unless they appear as characters)\n"
        "   - Place names misidentified as people\n"
        "   - Common words incorrectly tagged as names\n"
        "   - Partial or incomplete name mentions\n\n"
        "2. Consolidate name variations:\n"
        "   - Combine full names with partial mentions (e.g., 'Dorian Gray' + 'Dorian')\n"
        "   - Add counts together for the same character\n"
        "   - Use the most complete/formal version of the name as the key\n"
        "   - Consider context and character relationships\n\n"
        "Return ONLY a JSON object where keys are the consolidated character names "
        "and values are the total mention counts."
    )

    user_prompt = (
        f"Book title: {title}\n"
        f"Author: {author}\n\n"
        "Here is the extracted list (name: mention_count). Remove non-character entries "
        "and consolidate different variations of the same character's name. Sum the counts "
        "for variations of the same character. Return a JSON object where keys are character "
        "names (use the most complete version) and values are total counts.\n\n" + char_list_str
    )

    try:
        response = client.chat.completions.create(
            model="gpt-4-turbo-preview",  # Latest GPT-4 model
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.0,  # Maximum precision for consistent output
            max_tokens=1024,
            response_format={"type": "json_object"}  # Enforce JSON output
        )
        content = response.choices[0].message.content.strip()
        print("\nRaw LLM response:")
        print(content)

        # The model should have returned a JSON list – attempt to parse
        import json
        cleaned = json.loads(content)

        # If response comes back as an object {"characters": [...]} or flat dict of name:count
        if isinstance(cleaned, dict):
            if "characters" in cleaned and isinstance(cleaned["characters"], list):
                cleaned = cleaned["characters"]
            else:
                # Convert {name: count, ...} -> [[name, count], ...]
                cleaned = [[k, v] for k, v in cleaned.items()]

        # Validate structure: list of 2-item lists/tuples
        if (
            isinstance(cleaned, list)
            and all(isinstance(item, (list, tuple)) and len(item) == 2 for item in cleaned)
        ):
            result = [(str(name), int(count)) for name, count in cleaned]
            print(f"\nSuccessfully filtered characters. New count: {len(result)}")
            print("First 5 characters after filtering:")
            for name, count in result[:5]:
                print(f"  - {name}: {count}")
            return result

        print("[check_chars_with_llm] Unexpected response schema, returning original list")
        return characters

    except Exception as e:
        print(f"[check_chars_with_llm] LLM request failed: {str(e)} – returning original list")
        return characters

@app.function(timeout=120, scaledown_window=60)
def spacy_count(raw_text: str, book_id: int = 1324):
    """
    takes in a book and returns raw spaCy "PERSON" counts.
    Using lighter model and optimized processing.
    also returns pairs of "interactoins"
    """
    print(f"\nProcessing {book_id} ")
    print(f"Input text length: {len(raw_text)} characters")
    

    import spacy
    print("\nInitializing spaCy...")
    # Use smaller CPU-optimized model
    nlp = spacy.load("en_core_web_sm", disable=["tagger", "parser", "attribute_ruler", "lemmatizer"])
    nlp.add_pipe("sentencizer")



    print("Model loaded successfully")

    
    blocks = [raw_text[i:i+50000] for i in range(0, len(raw_text), 50000)]
    print(f"\nSplit text into {len(blocks)} blocks")
    
    # spans = []
    t0 = time.perf_counter()

    
    print("\nProcessing blocks through spaCy pipeline...")



    # for i, doc in enumerate(nlp.pipe(blocks, batch_size=2048)):
    #     block_spans = [(ent.text, ent.start_char, ent.end_char)
    #                   for ent in doc.ents if ent.label_ == "PERSON"]
    #     spans += block_spans
    #     print(f"Block {i+1}/{len(blocks)}: Found {len(block_spans)} PERSON entities")

    mention_counter: Counter[str] = Counter()
    pair_counter = defaultdict(lambda: defaultdict(int))
    
    # we create two counters for each of pairs and overall number of mentions
    
    from collections import deque
    window_size = 4  # number of consecutive sentences to consider as context 
    
    for i, doc in enumerate(nlp.pipe(blocks, batch_size=2048)):
        # Keep a small deque for the sliding sentence window inside this block
        sent_window: deque[set[str]] = deque(maxlen=window_size)

        for ent in doc.ents:
            if ent.label_ == "PERSON":
                mention_counter[ent.text.strip()] += 1

        for sent in doc.sents:
            names = {e.text.strip() for e in sent.ents if e.label_ == "PERSON"}
            sent_window.append(names)

            # Combine names across the current window
            union_names: set[str] = set().union(*sent_window)

            if len(union_names) > 1:
                for n1 in union_names:
                    for n2 in union_names:
                        if n1 < n2:
                            pair_counter[n1][n2] += 1
                            pair_counter[n2][n1] += 1
        
    



    
              
    print(f"\nspaCy NER finished in {time.perf_counter() - t0:.2f}s.")



    
    sorted_mentions = sorted(mention_counter.items(), key=lambda x: x[1], reverse=True)
    # Convert nested defaultdict to list of ((char1, char2), count) tuples
    pairs = []
    for char1, interactions in pair_counter.items():
        for char2, count in interactions.items():
            if char1 < char2:  # Only add each pair once
                pairs.append(((char1, char2), count))
    sorted_pairs = sorted(pairs, key=lambda x: x[1], reverse=True)

    print(f"\nFound {len(sorted_mentions)} unique characters")
    print(f"\nFound {len(pairs)} unique pairs or interactions")
    
    # Display top character interactions
    print("\nTop 5 character interactions:")
    for (char1, char2), count in sorted_pairs[:5]:
        print(f"  - {char1} ↔ {char2}: {count} interactions")

    return {
        "book_id": book_id,
        "characters": sorted_mentions[:15], 
        "pairs": sorted_pairs[:200]
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
    book_id = 1342
    print(f"\n=== Starting test  {book_id} ===")
    
    text = get_text(book_id)
    if isinstance(text, dict) and "error" in text:
        print(f"Error: {text['error']}")
        return
        
    print("\nSuccessfully retrieved text, sending to spaCy for analysis...")
    result = spacy_count.remote(text, book_id)
    print("\nFinal results:")
    print(result)

    print("\nChecking with LLM...")
    # Pass just the characters list, not the whole result dictionary
    rs = check_chars_with_llm.remote(result["characters"], book_id)
    print("\nFiltered results:")
    print(rs)





@app.function()
@modal.fastapi_endpoint(method="POST", docs=True)
def analyze_book(data: AnalysisRequest):
    """
    Analyze a book from Project Gutenberg using either spaCy or LLM approach.
    """
    try:
        print(f"\n=== Starting book analysis for ID: {data.gutenberg_id} ===")
        print(f"Analysis type: {data.analysis_type}")
        
        # Get the book text
        text = get_text(data.gutenberg_id)
        if isinstance(text, dict) and "error" in text:
            print(f"Error getting text: {text['error']}")
            return text

        # Process based on analysis type
        if data.analysis_type == "spacy":
            print("\nRunning spaCy analysis...")
            initial = spacy_count.remote(text, data.gutenberg_id)
            print("\nSpaCy analysis complete, starting LLM filtering...")
            result = check_chars_with_llm.remote(initial["characters"], data.gutenberg_id)
            return {"book_id": data.gutenberg_id, "characters": result}
        else:
            print("\nRunning LLM interaction analysis...")
            return count_interactions_llm.remote(text, data.gutenberg_id)

    except Exception as e:
        print(f"\nError in analyze_book: {str(e)}")
        return {"error": str(e)}


