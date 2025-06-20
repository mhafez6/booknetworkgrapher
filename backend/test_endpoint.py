import requests
import json

def test_endpoint():
    url = "https://mhafez6--book-ner-analyze-book.modal.run"
    headers = {"Content-Type": "application/json"}
    data = {
        "gutenberg_id": 11,
        "analysis_type": "spacy"
    }
    
    try:
        response = requests.post(url, headers=headers, json=data)
        print(f"Status Code: {response.status_code}")
        print(f"Response Headers: {response.headers}")
        print(f"Response Body: {response.text}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_endpoint() 