"""Build a unified timeline from clicks.json and transcript.json."""

import json
import os
import re
from datetime import datetime, timedelta


CONFIG_PATH = os.path.join(
    os.path.dirname(__file__), "..", "config", "v1_features.json"
)


def load_feature_config(config_path=None):
    path = config_path or CONFIG_PATH
    with open(path, "r") as f:
        return json.load(f)


def _match_path_feature(page_url, href, dom_path, config):
    """Match a click event to a V1 feature using URL path patterns."""
    patterns = config.get("path_patterns", {})
    # Check href first (most specific), then page_url
    candidates = [href, page_url]
    for url in candidates:
        if not url:
            continue
        # Extract path from full URL or use as-is
        path = url
        if "://" in url:
            path = "/" + url.split("://", 1)[1].split("/", 1)[-1]
        # Try longest match first (most specific)
        best_match = None
        best_len = 0
        for pattern, feature in patterns.items():
            if pattern in path and len(pattern) > best_len:
                best_match = feature
                best_len = len(pattern)
        if best_match:
            return best_match
    return None


def _match_keyword_feature(text, config):
    """Match transcript text to a V1 feature using keyword patterns."""
    keywords = config.get("keyword_patterns", {})
    text_lower = text.lower()
    # Try longest keywords first to get most specific match
    for keyword in sorted(keywords, key=len, reverse=True):
        if keyword in text_lower:
            return keywords[keyword]
    return None


def _parse_transcript_timestamp(ts_str, session_start):
    """Convert HH:MM:SS.mmm relative timestamp to ISO datetime using session start."""
    parts = ts_str.replace(",", ".").split(":")
    try:
        if len(parts) == 3:
            h, m, s = int(parts[0]), int(parts[1]), float(parts[2])
        elif len(parts) == 2:
            h, m, s = 0, int(parts[0]), float(parts[1])
        else:
            h, m, s = 0, 0, float(parts[0])
    except (ValueError, IndexError):
        return session_start
    return session_start + timedelta(hours=h, minutes=m, seconds=s)


def _parse_iso_timestamp(ts_str):
    """Parse ISO-8601 timestamp string."""
    ts_str = ts_str.replace("Z", "+00:00")
    try:
        return datetime.fromisoformat(ts_str)
    except ValueError:
        return datetime.min


def _snippet(text, max_len=120):
    """Truncate text to max_len with ellipsis."""
    if len(text) <= max_len:
        return text
    return text[:max_len - 3] + "..."


def build_timeline(clicks_data, transcript_data, config=None):
    """Build unified timeline from clicks and transcript data.

    Args:
        clicks_data: parsed clicks.json dict
        transcript_data: parsed transcript.json dict
        config: V1 feature config dict (loaded from file if None)

    Returns:
        dict with session_id and sorted events list
    """
    if config is None:
        config = load_feature_config()

    events = []
    session_id = clicks_data.get("session_id") or transcript_data.get("session_id", "unknown")

    # Determine session start from first click timestamp (for relative transcript times)
    click_events = clicks_data.get("events", [])
    if click_events:
        session_start = _parse_iso_timestamp(click_events[0]["timestamp"])
    else:
        session_start = datetime.min

    # Process clicks
    for click in click_events:
        ts = _parse_iso_timestamp(click["timestamp"])
        element = click.get("element", {})
        description = element.get("text", click.get("dom_path", "unknown element"))
        href = element.get("href")
        page_url = click.get("page_url", "")
        dom_path = click.get("dom_path", "")

        v1_feature = _match_path_feature(page_url, href, dom_path, config)

        events.append({
            "timestamp": ts.isoformat(),
            "type": "click",
            "description": f"Clicked: {description}",
            "v1_feature": v1_feature,
        })

    # Process transcript
    for entry in transcript_data.get("entries", []):
        ts = _parse_transcript_timestamp(entry.get("timestamp", "00:00:00"), session_start)
        speaker = entry.get("speaker", "Unknown")
        text = entry.get("text", "")

        v1_feature = _match_keyword_feature(text, config)

        events.append({
            "timestamp": ts.isoformat(),
            "type": "speech",
            "description": f"{speaker}: {_snippet(text)}",
            "v1_feature": v1_feature,
        })

    # Sort by timestamp
    events.sort(key=lambda e: e["timestamp"])

    return {
        "session_id": session_id,
        "event_count": len(events),
        "events": events,
    }


def build_timeline_from_files(clicks_path, transcript_path, output_path=None, config_path=None):
    """Build timeline from file paths. Writes to output_path if given."""
    with open(clicks_path, "r") as f:
        clicks_data = json.load(f)
    with open(transcript_path, "r") as f:
        transcript_data = json.load(f)

    config = load_feature_config(config_path) if config_path else None
    result = build_timeline(clicks_data, transcript_data, config)

    if output_path:
        with open(output_path, "w") as f:
            json.dump(result, f, indent=2)

    return result


if __name__ == "__main__":
    import sys
    if len(sys.argv) < 3:
        print("Usage: python -m analysis.engines.timeline_builder <clicks.json> <transcript.json> [output.json]")
        sys.exit(1)
    output = sys.argv[3] if len(sys.argv) > 3 else None
    result = build_timeline_from_files(sys.argv[1], sys.argv[2], output)
    if not output:
        print(json.dumps(result, indent=2))
