"""Tier 2: NLP Engine

Extracts clinical signals from free-text notes using keyword matching.
Designed for speed and reliability in a hackathon prototype.
"""
import re
from typing import List, Dict, Set
from tier2.keywords import KEYWORD_TAXONOMY


def extract_signals(note_text: str) -> Dict[str, List[str]]:
    """
    Extract clinical signals from a clinical note.

    Returns dict: { category_key: [matched_keywords] }
    """
    if not note_text:
        return {}

    text_lower = note_text.lower()
    found = {}

    for category_key, category_info in KEYWORD_TAXONOMY.items():
        matches = []
        for keyword in category_info["keywords"]:
            # Use word boundary matching for multi-word and single-word terms
            pattern = re.escape(keyword.lower())
            if re.search(r'\b' + pattern + r'\b', text_lower):
                matches.append(keyword)

        if matches:
            found[category_key] = matches

    return found


def extract_signals_with_context(note_text: str, window: int = 80) -> List[Dict]:
    """
    Extract signals with surrounding context snippets.

    Returns list of {category, keyword, context, significance}.
    """
    if not note_text:
        return []

    text_lower = note_text.lower()
    results = []

    for category_key, category_info in KEYWORD_TAXONOMY.items():
        for keyword in category_info["keywords"]:
            pattern = re.escape(keyword.lower())
            for match in re.finditer(r'\b' + pattern + r'\b', text_lower):
                start = max(0, match.start() - window)
                end = min(len(note_text), match.end() + window)
                context = note_text[start:end].strip()
                if start > 0:
                    context = "..." + context
                if end < len(note_text):
                    context = context + "..."

                results.append({
                    "category": category_key,
                    "category_display": category_info["display"],
                    "keyword": keyword,
                    "significance": category_info["significance"],
                    "context": context,
                    "position": match.start(),
                })

    # Deduplicate by category (keep first match per category)
    seen_categories = set()
    unique_results = []
    for r in sorted(results, key=lambda x: x["position"]):
        key = (r["category"], r["keyword"])
        if key not in seen_categories:
            seen_categories.add(key)
            unique_results.append(r)

    return unique_results


def get_signal_summary(signals: Dict[str, List[str]]) -> str:
    """Generate a human-readable summary of extracted signals."""
    if not signals:
        return "No significant clinical signals detected in notes."

    parts = []
    for category_key, keywords in signals.items():
        info = KEYWORD_TAXONOMY.get(category_key, {})
        display = info.get("display", category_key)
        parts.append(f"• {display}: {', '.join(keywords)}")

    return "Clinical signals detected:\n" + "\n".join(parts)
