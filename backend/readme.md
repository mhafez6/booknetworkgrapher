This project is going to be a book to graph visualizer of sorts. 

Initially I was going to simply chunk our book and have an LLM wiht context parse through and just add character occurerences and interactions into a shared state. That took way too long even when trying to parrallelize as I quickly hit rate limits.

After a bit of research, I decided I was going to use a spaCy transformer model built for Named Entity Recognition to parse through entire books. 

And I'll use my inital approach on a small subset of the book. 


* set up modal with the model wokring and counting characters
* maybe imporve data cleaning 
* fetch meta data along with text
* send the pure count list to be corrected by an llm with context about book & meta data 
* 

plan for 20 june 

1. create frontend mock up and set up calls to the fast api endpoint with two versions, spacy or llm 

2. have the spacy version fully working with a simple graph visualizer working 

3. start working on llm parser with small context windows and save interactions

4. create weighted graphs based on interactions info

