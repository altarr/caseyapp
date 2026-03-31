"""Tests for timeline_builder engine."""

import json
import os
import sys
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from engines.timeline_builder import build_timeline, build_timeline_from_files, load_feature_config


SAMPLE_DIR = os.path.join(os.path.dirname(__file__), "..", "sample_data")
TEST_SESSION_DIR = os.path.join(os.path.dirname(__file__), "..", "test-data", "sample-session")


@pytest.fixture
def config():
    return load_feature_config()


@pytest.fixture
def sample_clicks():
    with open(os.path.join(SAMPLE_DIR, "sample_clicks.json")) as f:
        return json.load(f)


@pytest.fixture
def sample_transcript():
    with open(os.path.join(SAMPLE_DIR, "sample_transcript.json")) as f:
        return json.load(f)


def test_build_timeline_returns_all_events(sample_clicks, sample_transcript, config):
    result = build_timeline(sample_clicks, sample_transcript, config)
    click_count = len(sample_clicks["events"])
    speech_count = len(sample_transcript["entries"])
    assert result["event_count"] == click_count + speech_count
    assert len(result["events"]) == result["event_count"]


def test_events_sorted_by_timestamp(sample_clicks, sample_transcript, config):
    result = build_timeline(sample_clicks, sample_transcript, config)
    timestamps = [e["timestamp"] for e in result["events"]]
    assert timestamps == sorted(timestamps)


def test_event_types(sample_clicks, sample_transcript, config):
    result = build_timeline(sample_clicks, sample_transcript, config)
    types = {e["type"] for e in result["events"]}
    assert types == {"click", "speech"}


def test_click_event_has_description(sample_clicks, sample_transcript, config):
    result = build_timeline(sample_clicks, sample_transcript, config)
    clicks = [e for e in result["events"] if e["type"] == "click"]
    for c in clicks:
        assert c["description"].startswith("Clicked: ")
        assert len(c["description"]) > len("Clicked: ")


def test_speech_event_has_speaker(sample_clicks, sample_transcript, config):
    result = build_timeline(sample_clicks, sample_transcript, config)
    speeches = [e for e in result["events"] if e["type"] == "speech"]
    for s in speeches:
        assert ": " in s["description"]
        speaker = s["description"].split(": ", 1)[0]
        assert speaker in ("SE", "Visitor")


def test_v1_feature_mapping_clicks(sample_clicks, sample_transcript, config):
    result = build_timeline(sample_clicks, sample_transcript, config)
    clicks = [e for e in result["events"] if e["type"] == "click"]
    # First click goes to /app/endpoint-security -- should map
    ep_clicks = [c for c in clicks if c["v1_feature"] and "Endpoint" in c["v1_feature"]]
    assert len(ep_clicks) > 0

    # XDR click should map
    xdr_clicks = [c for c in clicks if c["v1_feature"] and "XDR" in c["v1_feature"]]
    assert len(xdr_clicks) > 0


def test_v1_feature_mapping_speech(sample_clicks, sample_transcript, config):
    result = build_timeline(sample_clicks, sample_transcript, config)
    speeches = [e for e in result["events"] if e["type"] == "speech"]
    # At least some speech events should have v1_feature from keyword matching
    mapped = [s for s in speeches if s["v1_feature"] is not None]
    assert len(mapped) > 0


def test_session_id_propagated(sample_clicks, sample_transcript, config):
    result = build_timeline(sample_clicks, sample_transcript, config)
    assert result["session_id"] == "B291047"


def test_each_event_has_required_fields(sample_clicks, sample_transcript, config):
    result = build_timeline(sample_clicks, sample_transcript, config)
    for event in result["events"]:
        assert "timestamp" in event
        assert "type" in event
        assert "description" in event
        assert "v1_feature" in event
        assert event["type"] in ("click", "speech")


def test_build_from_files(tmp_path):
    clicks_path = os.path.join(SAMPLE_DIR, "sample_clicks.json")
    transcript_path = os.path.join(SAMPLE_DIR, "sample_transcript.json")
    output_path = str(tmp_path / "timeline.json")

    result = build_timeline_from_files(clicks_path, transcript_path, output_path)

    assert os.path.exists(output_path)
    with open(output_path) as f:
        saved = json.load(f)
    assert saved["event_count"] == result["event_count"]
    assert len(saved["events"]) == result["event_count"]


def test_empty_clicks(sample_transcript, config):
    empty_clicks = {"session_id": "EMPTY", "events": []}
    result = build_timeline(empty_clicks, sample_transcript, config)
    assert result["event_count"] == len(sample_transcript["entries"])
    assert all(e["type"] == "speech" for e in result["events"])
    assert result["session_id"] == "EMPTY"


def test_empty_transcript(sample_clicks, config):
    empty_transcript = {"session_id": "EMPTY", "entries": []}
    result = build_timeline(sample_clicks, empty_transcript, config)
    assert result["event_count"] == len(sample_clicks["events"])
    assert all(e["type"] == "click" for e in result["events"])


def test_both_empty(config):
    result = build_timeline({"events": []}, {"entries": []}, config)
    assert result["event_count"] == 0
    assert result["events"] == []
    assert result["session_id"] == "unknown"


def test_malformed_timestamp_falls_back(config):
    clicks = {"session_id": "MAL", "events": [
        {"timestamp": "not-a-date", "element": {"text": "btn"}, "page_url": "", "dom_path": ""}
    ]}
    transcript = {"entries": [
        {"timestamp": "garbage", "speaker": "SE", "text": "hello"}
    ]}
    result = build_timeline(clicks, transcript, config)
    assert result["event_count"] == 2
    # Should not crash -- fallback timestamps used


def test_no_feature_match(config):
    clicks = {"session_id": "NF", "events": [
        {"timestamp": "2026-01-01T00:00:00Z", "element": {"text": "btn", "href": "/unknown/page"},
         "page_url": "https://example.com/unknown/page", "dom_path": "div > button"}
    ]}
    transcript = {"entries": [
        {"timestamp": "00:00:01.000", "speaker": "SE", "text": "Let me show you the weather forecast."}
    ]}
    result = build_timeline(clicks, transcript, config)
    assert result["events"][0]["v1_feature"] is None
    assert result["events"][1]["v1_feature"] is None


def test_snippet_truncation(config):
    long_text = "A" * 200
    transcript = {"session_id": "LONG", "entries": [
        {"timestamp": "00:00:01.000", "speaker": "SE", "text": long_text}
    ]}
    result = build_timeline({"events": []}, transcript, config)
    desc = result["events"][0]["description"]
    assert len(desc) <= len("SE: ") + 120
    assert desc.endswith("...")


def test_build_from_test_session_data():
    clicks_path = os.path.join(TEST_SESSION_DIR, "clicks", "clicks.json")
    transcript_path = os.path.join(TEST_SESSION_DIR, "transcript", "transcript.json")
    result = build_timeline_from_files(clicks_path, transcript_path)
    assert result["event_count"] > 0
    assert result["session_id"] == "B291047"
