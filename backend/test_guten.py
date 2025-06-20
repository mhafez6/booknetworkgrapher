

import requests


def get_data(id):
    m = requests.get(f"https://www.gutenberg.org/ebooks/{id}")
    # Find the <title>
    html = m.text

    import re

    # Extract <title> content
    title_match = re.search(r"<title>(.*?)\|", html, re.IGNORECASE)
    title = title_match.group(1).strip() if title_match else None


    if title and " by " in title:
        book_title, author = title.split(" by ")
        print("Title:", book_title.strip())
        print("Author:", author.strip())
    else:
        print("Title:", title)
        print("Author:", "Unknown")

    return 0

if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1:
        book_id = sys.argv[1]
    else:
        book_id = input("Enter Gutenberg book ID: ")
    resp = get_data(book_id)

