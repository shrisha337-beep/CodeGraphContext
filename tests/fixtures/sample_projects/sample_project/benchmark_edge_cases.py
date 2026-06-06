# tests/fixtures/sample_projects/sample_project/benchmark_edge_cases.py
"""
This file contains comments, string literals, and commented-out code mentioning:
- square
- hidden_function
- module_b

Regex-based search tools will match these textual occurrences, leading to false positives.
On-the-fly AST search and CodeGraphContext (CGC) will successfully ignore these as they are not actual AST symbol usages!
"""

# Let's write a comment about the square function
# Remember: do not use square here. It is just a text comment.

def dummy_benchmark_harness():
    # Inside this function, we have a commented-out definition:
    # def hidden_function():
    #     return "Not a real function definition!"
    
    docstring_like = "This is a string literal containing hidden_function definition name."
    comment_ref = "We are also importing module_b in a comment!"
    
    return docstring_like, comment_ref
