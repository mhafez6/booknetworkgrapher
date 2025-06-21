import json
import os
import re
import time
from collections import Counter, defaultdict, deque
from pathlib import Path
from typing import Literal

import modal
import requests
import tiktoken
from dotenv import load_dotenv
from openai import OpenAI
from pydantic import BaseModel


load_dotenv()
secret_apis = modal.Secret.from_name("api-keys")

MAX_EXCERPT_CHARS = 15000
CHUNK_CHARS = 2200
OVERLAP_CHARS = 200
SKIP = 0.05      



MODEL = "gpt-4o-mini"




image = (
    modal.Image.debian_slim(python_version="3.10")
    .pip_install_from_requirements("requirements-modal.txt")
    .run_commands("python -m spacy download en_core_web_sm")
)
app = modal.App("llm_idea", image=image)


class AnalysisRequest(BaseModel):
    gutenberg_id: int
    analysis_type: Literal["spacy", "llm", "metadata"]
    max_chunks: int = 5


# remove the headers 
hdr= re.compile(r"\*\*\* *start of .*?project gutenberg ebook", re.I)
ftr = re.compile(r"\*\*\* *end of .*?project gutenberg ebook", re.I)

def core_text(txt: str) -> str:
    h = hdr.search(txt)
    f = ftr.search(txt)

    if not h or not f or f.start() <= h.end(): # return everything, lowkey unneccesary now since we skip some portion 
        return txt
    
    start = txt.find("\n", h.end()) + 1
    return txt[start:f.start()].strip()


def get_text(gutenberg_id: int):
    url = f"https://www.gutenberg.org/files/{gutenberg_id}/{gutenberg_id}-0.txt"
    try:
        r = requests.get(url, timeout=30)
        r.raise_for_status()
        txt = r.text
        if len(txt) > 1_000:
            return core_text(txt)
        return {"error": f"failed to download book {gutenberg_id}"}
    except Exception as e:
        return {"error": str(e)}


def take_excerpt(txt: str) -> str:
    start = int(len(txt) * SKIP)
    return txt[start: start + 90000]


def make_chunks(text: str, max_chunks: int = 5) -> list[str]:
    
    n = min(max_chunks, max(1, round(len(text) / CHUNK_CHARS))) 
    span = len(text) // n
    out = []

    # add overlap, chunk sees the last 200 of prev chunk, first 200 of next chunk
    for i in range(n):
        lo = max(0, i * span - OVERLAP_CHARS)
        hi = min(len(text), (i + 1) * span + OVERLAP_CHARS)
        out.append(text[lo:hi])
    return out



def build_system_prompt(title: str, author: str) -> str:
    return (
        f"You are a literary analyst. The novel is '{title}' by {author}.\n"
        "Respond in JSON only.\n"
        "TASK:\n"
        "1. Build \"nodes\": each item [character_name, mention_count]. "
        "   Take into account your knowledge about the story and merge aliases (e.g. 'Lizzy' → 'Elizabeth Bennet', "
        "   'Darcy' → 'Mr. Darcy'). Ignore anyone who is not a story "
        "   character (editors, critics, real authors, book titles, places). \n"
        "2. Build \"edges\": each item [char_A, char_B, interaction_weight] "
        "   where weight = number of explicit interactions in THIS passage "
        "   (dialogue, in-scene action). Do not count mere references.\n"
        "Return one valid JSON object with exactly the keys \"nodes\" and "
        "\"edges\"—no extra text."
    )



# clean up with LLM to fix mistakes 

def clean_graph_with_llm(nodes: list[dict], edges: list[dict],
                         title: str, author: str) -> tuple[list, list]:
    from openai import OpenAI
    client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    
    # give out all nodes 

    raw_node_str = "\n".join(f"- {n['name']}: {n['count']}" for n in nodes)

    sys = (
        "You are a literary expert. Respond in JSON only.\n"
        "Given a novel's character list, produce a mapping that:\n"
        "1. Removes non-characters (places, authors, other books, etc.).\n"
        "2. Merges obvious aliases under ONE canonical key.\n"
        'Return {"map": {alias_or_name: canonical_name, ...}}'
    )

    user = (
        f"Novel: '{title}' by {author}\n\n"
        "Character list (name: mentions):\n" + raw_node_str
    )

    rsp = client.chat.completions.create(
        model=MODEL,
        messages=[{"role": "system", "content": sys},
                  {"role": "user", "content": user}],
        temperature=0.0,
        max_tokens=800,
        response_format={"type": "json_object"},
    )

    mapping = json.loads(rsp.choices[0].message.content)["map"]

    # combine nodes
    merged_counts = Counter()
    for n in nodes:
        canon = mapping.get(n["name"], n["name"])
        merged_counts[canon] += n["count"]

    cleaned_nodes = [
        {"name": name, "count": cnt}
        for name, cnt in merged_counts.most_common(50)
    ]
    top_character_names = {node["name"] for node in cleaned_nodes}

    # combine edges
    edge_ctr: Counter[tuple[str, str]] = Counter()
    for e in edges:
        a = mapping.get(e["source"], e["source"])
        b = mapping.get(e["target"], e["target"])
        if a in top_character_names and b in top_character_names and a != b:
            edge_ctr[tuple(sorted((a, b)))] += e["weight"]

    cleaned_edges = [
        {"source": a, "target": b, "weight": w}
        for (a, b), w in sorted(edge_ctr.items(), key=lambda x: x[1], reverse=True)
    ][:200]

    return cleaned_nodes, cleaned_edges




def get_meta_data(id: int):
    
    m = requests.get(f"https://www.gutenberg.org/ebooks/{id}")


    html = m.text

    import re

    title_match = re.search(r"<title>(.*?)\|", html, re.IGNORECASE)
    title = title_match.group(1).strip() if title_match else None

    if title and " by " in title:
        book_title, author = title.split(" by ")
        return ({"Title": title, "Author": author })
    else:
        return ({"Title": title, "Author": "UnKnown" })
        

def analyse_chunk(txt: str, sys_prompt: str) -> str:
    from openai import OpenAI
    client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    rsp = client.chat.completions.create(
        model=MODEL,
        messages=[
            {"role": "system", "content": sys_prompt},
            {"role": "user", "content": f"PASSAGE (json output only):\n---\n{txt}\n---"},
        ],
        temperature=0.0,
        max_tokens=1024,
        response_format={"type": "json_object"},
    )
    return rsp.choices[0].message.content


def merge(results: list[str]):

    node_ctr: Counter[str] = Counter()
    edge_ctr: Counter[tuple[str, str]] = Counter()

    for raw in results:
        d = json.loads(raw)
        for n, c in d["nodes"]:
            node_ctr[n] += int(c)
        for a, b, w in d["edges"]:
            edge = tuple(sorted((a, b)))
            edge_ctr[edge] += int(w)

    top_nodes = node_ctr.most_common(50)
    top_edges = sorted(edge_ctr.items(), key=lambda x: x[1], reverse=True)[:200]

    nodes = [{"name": n, "count": c} for n, c in top_nodes]
    edges = [
        {"source": a, "target": b, "weight": w} for (a, b), w in top_edges
    ]
    return nodes, edges



@app.function(secrets=[secret_apis], timeout=600)
def count_interactions_llm(text: str, book_id: int, max_chunks: int = 5):
    meta   = get_meta_data(book_id)
    title  = meta.get("Title", f"Gutenberg #{book_id}")
    author = meta.get("Author", "Unknown")

    excerpt = take_excerpt(text)
    chunks  = make_chunks(excerpt, max_chunks)
    sys_prompt = build_system_prompt(title, author)

    results = [analyse_chunk(ch, sys_prompt) for ch in chunks]
    nodes, edges = merge(results)

    # ---- final clean-up ----
    nodes, edges = clean_graph_with_llm(nodes, edges, title, author)

    return {"book_id": book_id, "nodes": nodes, "edges": edges}


@app.function(secrets=[secret_apis], timeout=300, scaledown_window=60)
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
    # Use a simple Counter to tally pair interactions
    pair_counter: Counter[tuple[str, str]] = Counter()
    
    # we create two counters for each of pairs and overall number of mentions
    
    
    
    from itertools import combinations


    
    for i, doc in enumerate(nlp.pipe(blocks, batch_size=2048)):
        # Count overall mentions across the block
        for ent in doc.ents:
            if ent.label_ == "PERSON":
                mention_counter[ent.text.strip()] += 1

        # Count interactions per sentence 
        for sent in doc.sents:
            names = {e.text.strip() for e in sent.ents if e.label_ == "PERSON"}
            if len(names) > 1:
                for n1, n2 in combinations(sorted(list(names)), 2):
                    pair_counter[(n1, n2)] += 1 
        
    



    
              
    print(f"\nspaCy NER finished in {time.perf_counter() - t0:.2f}s.")



    
    sorted_mentions = sorted(mention_counter.items(), key=lambda x: x[1], reverse=True)

    # Sort pair interactions by weight (count) descending
    sorted_pairs = sorted(pair_counter.items(), key=lambda x: x[1], reverse=True)

    print(f"\nFound {len(sorted_mentions)} unique characters")
    print(f"\nFound {len(sorted_pairs)} unique pairs or interactions")
    
    # Display top character interactions
    print("\nTop 5 character interactions:")
    for (char1, char2), count in sorted_pairs[:5]:
        print(f"  - {char1} ↔ {char2}: {count} interactions")

    nodes = [{"name": n, "count": c} for n, c in sorted_mentions]
    edges = [
        {"source": a, "target": b, "weight": w}
        for (a, b), w in sorted_pairs
    ]

    meta = get_meta_data(book_id)
    title = meta.get("Title", f"Gutenberg #{book_id}")
    author = meta.get("Author", "Unknown")

    print("\nCleaning spaCy results with LLM...")
    nodes, edges = clean_graph_with_llm(nodes, edges, title, author)

    return {"book_id": book_id, "nodes": nodes, "edges": edges}




@app.function()
@modal.fastapi_endpoint(method="POST", docs=True)
def analyze_book(req: AnalysisRequest):

    if req.analysis_type == "metadata":
        return get_meta_data(req.gutenberg_id)
    
    txt = get_text(req.gutenberg_id)
    if isinstance(txt, dict) and "error" in txt:
        return txt
    
    if req.analysis_type == "spacy":
        return spacy_count.remote(txt, req.gutenberg_id)

    return count_interactions_llm.remote(txt, req.gutenberg_id, req.max_chunks)


@app.local_entrypoint()
def run_local():
    book_id = 28054
    txt = get_text(book_id)
    if isinstance(txt, dict):
        print(txt["error"])
        return
    out = count_interactions_llm.remote(txt, book_id)
    print(json.dumps(out, indent=2))








