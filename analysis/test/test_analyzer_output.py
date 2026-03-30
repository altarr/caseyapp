"""Tests for SessionAnalyzer output builders.

Validates that _build_summary_json and _build_follow_up_json correctly
pass through all fields (including session_score, executive_summary,
and enhanced key_moments) from the LLM results.
"""

import sys
import os
import types
import unittest
from unittest.mock import patch, MagicMock
from datetime import datetime, timezone

# Stub out anthropic before importing analyzer (not installed in test env)
sys.modules.setdefault("anthropic", types.ModuleType("anthropic"))

# Allow importing from analysis package
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from analysis.engines.analyzer import SessionAnalyzer


def _make_analyzer():
    """Create a SessionAnalyzer with mock metadata (no filesystem access)."""
    analyzer = SessionAnalyzer.__new__(SessionAnalyzer)
    analyzer._metadata = {
        "session_id": "TEST-001",
        "visitor_name": "Jane Doe",
        "visitor_email": "jane@example.com",
        "started_at": "2026-03-29T10:00:00Z",
        "ended_at": "2026-03-29T10:20:00Z",
    }
    analyzer._tenant = {"tenant_url": "https://portal.xdr.trendmicro.com/test"}
    return analyzer


SAMPLE_FACTUAL = {
    "products_shown": ["Endpoint Security", "XDR"],
    "features_demonstrated": [],
    "visitor_questions": [],
    "key_moments": [
        {"timestamp_rel": "02:30", "screenshot_file": "click-001.jpg", "description": "Asked about BYOD", "impact": "Real deployment concern"},
        {"timestamp_rel": "05:10", "screenshot_file": "click-005.jpg", "description": "Deep dive on XDR rules", "impact": "Strong buying signal"},
        {"timestamp_rel": "08:45", "screenshot_file": None, "description": "Compared to CrowdStrike", "impact": "Competitive evaluation"},
        {"timestamp_rel": "12:00", "screenshot_file": "click-010.jpg", "description": "Reviewed risk dashboard", "impact": "Executive interest"},
    ],
    "session_stats": {"duration_seconds": 1200, "click_count": 25, "transcript_entries": 40},
}

SAMPLE_RECOMMENDATIONS = {
    "session_score": 8,
    "executive_summary": "Jane showed strong interest in endpoint policy and XDR detection rules. Schedule a deep-dive within the week.",
    "visitor_interests": [
        {"topic": "Endpoint policy", "confidence": "high", "evidence": "Asked 3 questions"},
        {"topic": "XDR rules", "confidence": "medium", "evidence": "Spent 2 min exploring"},
    ],
    "recommended_follow_up": [
        "Send EP policy best practices guide",
        "Schedule XDR deep-dive",
    ],
    "sdr_notes": "CISO, 5000 endpoints, comparing with CrowdStrike",
}


class TestBuildSummaryJson(unittest.TestCase):
    def setUp(self):
        self.analyzer = _make_analyzer()
        self.summary = self.analyzer._build_summary_json(SAMPLE_FACTUAL, SAMPLE_RECOMMENDATIONS)

    def test_session_score_present(self):
        self.assertEqual(self.summary["session_score"], 8)

    def test_executive_summary_present(self):
        self.assertIn("strong interest", self.summary["executive_summary"])

    def test_products_shown_unchanged(self):
        self.assertEqual(self.summary["products_shown"], ["Endpoint Security", "XDR"])

    def test_visitor_interests_unchanged(self):
        self.assertEqual(len(self.summary["visitor_interests"]), 2)
        self.assertEqual(self.summary["visitor_interests"][0]["topic"], "Endpoint policy")

    def test_recommended_follow_up_unchanged(self):
        self.assertEqual(len(self.summary["recommended_follow_up"]), 2)

    def test_key_moments_capped_at_three(self):
        self.assertEqual(len(self.summary["key_moments"]), 3)

    def test_key_moments_have_impact(self):
        for m in self.summary["key_moments"]:
            self.assertIn("impact", m)
            self.assertTrue(len(m["impact"]) > 0)

    def test_key_moments_order_preserved(self):
        timestamps = [m["timestamp"] for m in self.summary["key_moments"]]
        self.assertEqual(timestamps, ["02:30", "05:10", "08:45"])

    def test_duration_calculated_from_metadata(self):
        self.assertEqual(self.summary["demo_duration_minutes"], 20)

    def test_session_score_defaults_to_zero(self):
        no_score = {k: v for k, v in SAMPLE_RECOMMENDATIONS.items() if k != "session_score"}
        summary = self.analyzer._build_summary_json(SAMPLE_FACTUAL, no_score)
        self.assertEqual(summary["session_score"], 0)

    def test_executive_summary_defaults_to_empty(self):
        no_summary = {k: v for k, v in SAMPLE_RECOMMENDATIONS.items() if k != "executive_summary"}
        summary = self.analyzer._build_summary_json(SAMPLE_FACTUAL, no_summary)
        self.assertEqual(summary["executive_summary"], "")


class TestBuildFollowUpJson(unittest.TestCase):
    def setUp(self):
        self.analyzer = _make_analyzer()
        self.follow_up = self.analyzer._build_follow_up_json(SAMPLE_RECOMMENDATIONS)

    def test_sdr_notes_present(self):
        self.assertIn("CISO", self.follow_up["sdr_notes"])

    def test_priority_high_when_high_confidence(self):
        self.assertEqual(self.follow_up["priority"], "high")

    def test_tags_from_interests(self):
        self.assertTrue(len(self.follow_up["tags"]) > 0)


if __name__ == "__main__":
    unittest.main()
