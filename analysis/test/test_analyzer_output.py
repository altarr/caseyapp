"""Tests for SessionAnalyzer output builders and validator.

Validates that _build_summary_json and _build_follow_up_json correctly
produce the structured output with: visitor_name, products_demonstrated,
key_interests, follow_up_actions, demo_duration_seconds.
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
from analysis.engines.validator import validate_summary, validate_summary_or_raise, ValidationError


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
    "products_demonstrated": ["Endpoint Security", "XDR"],
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
    "key_interests": [
        {"topic": "Endpoint policy", "confidence": "high", "evidence": "Asked 3 questions"},
        {"topic": "XDR rules", "confidence": "medium", "evidence": "Spent 2 min exploring"},
    ],
    "follow_up_actions": [
        "Send EP policy best practices guide",
        "Schedule XDR deep-dive",
    ],
    "sdr_notes": "CISO, 5000 endpoints, comparing with CrowdStrike",
}


class TestBuildSummaryJson(unittest.TestCase):
    def setUp(self):
        self.analyzer = _make_analyzer()
        self.summary = self.analyzer._build_summary_json(SAMPLE_FACTUAL, SAMPLE_RECOMMENDATIONS)

    def test_visitor_name_present(self):
        self.assertEqual(self.summary["visitor_name"], "Jane Doe")

    def test_products_demonstrated(self):
        self.assertEqual(self.summary["products_demonstrated"], ["Endpoint Security", "XDR"])

    def test_key_interests(self):
        self.assertEqual(len(self.summary["key_interests"]), 2)
        self.assertEqual(self.summary["key_interests"][0]["topic"], "Endpoint policy")

    def test_follow_up_actions(self):
        self.assertEqual(len(self.summary["follow_up_actions"]), 2)
        self.assertIn("EP policy", self.summary["follow_up_actions"][0])

    def test_demo_duration_seconds(self):
        self.assertEqual(self.summary["demo_duration_seconds"], 1200)

    def test_session_score_present(self):
        self.assertEqual(self.summary["session_score"], 8)

    def test_executive_summary_present(self):
        self.assertIn("strong interest", self.summary["executive_summary"])

    def test_key_moments_capped_at_three(self):
        self.assertEqual(len(self.summary["key_moments"]), 3)

    def test_key_moments_have_impact(self):
        for m in self.summary["key_moments"]:
            self.assertIn("impact", m)
            self.assertTrue(len(m["impact"]) > 0)

    def test_key_moments_order_preserved(self):
        timestamps = [m["timestamp"] for m in self.summary["key_moments"]]
        self.assertEqual(timestamps, ["02:30", "05:10", "08:45"])

    def test_session_score_defaults_to_zero(self):
        no_score = {k: v for k, v in SAMPLE_RECOMMENDATIONS.items() if k != "session_score"}
        summary = self.analyzer._build_summary_json(SAMPLE_FACTUAL, no_score)
        self.assertEqual(summary["session_score"], 0)

    def test_executive_summary_defaults_to_empty(self):
        no_summary = {k: v for k, v in SAMPLE_RECOMMENDATIONS.items() if k != "executive_summary"}
        summary = self.analyzer._build_summary_json(SAMPLE_FACTUAL, no_summary)
        self.assertEqual(summary["executive_summary"], "")

    def test_no_old_field_names(self):
        self.assertNotIn("products_shown", self.summary)
        self.assertNotIn("visitor_interests", self.summary)
        self.assertNotIn("recommended_follow_up", self.summary)
        self.assertNotIn("demo_duration_minutes", self.summary)

    def test_fallback_from_old_field_names(self):
        """LLM may still return old field names -- analyzer should handle gracefully."""
        old_factual = {**SAMPLE_FACTUAL, "products_shown": ["XDR"]}
        del old_factual["products_demonstrated"]
        old_recs = {
            "session_score": 5,
            "executive_summary": "Test.",
            "visitor_interests": [{"topic": "XDR", "confidence": "low", "evidence": "brief"}],
            "recommended_follow_up": ["Follow up"],
            "sdr_notes": "notes",
        }
        summary = self.analyzer._build_summary_json(old_factual, old_recs)
        self.assertEqual(summary["products_demonstrated"], ["XDR"])
        self.assertEqual(summary["key_interests"][0]["topic"], "XDR")
        self.assertEqual(summary["follow_up_actions"], ["Follow up"])


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


class TestValidator(unittest.TestCase):
    def _valid_summary(self):
        analyzer = _make_analyzer()
        return analyzer._build_summary_json(SAMPLE_FACTUAL, SAMPLE_RECOMMENDATIONS)

    def test_valid_summary_passes(self):
        errors = validate_summary(self._valid_summary())
        self.assertEqual(errors, [])

    def test_missing_required_field(self):
        summary = self._valid_summary()
        del summary["visitor_name"]
        errors = validate_summary(summary)
        self.assertTrue(any("visitor_name" in e for e in errors))

    def test_wrong_type_products(self):
        summary = self._valid_summary()
        summary["products_demonstrated"] = "not an array"
        errors = validate_summary(summary)
        self.assertTrue(any("products_demonstrated" in e for e in errors))

    def test_invalid_confidence_enum(self):
        summary = self._valid_summary()
        summary["key_interests"] = [{"topic": "X", "confidence": "maybe", "evidence": "e"}]
        errors = validate_summary(summary)
        self.assertTrue(any("confidence" in e for e in errors))

    def test_session_score_out_of_range(self):
        summary = self._valid_summary()
        summary["session_score"] = 11
        errors = validate_summary(summary)
        self.assertTrue(any("maximum" in e for e in errors))

    def test_validate_or_raise(self):
        summary = self._valid_summary()
        del summary["session_id"]
        with self.assertRaises(ValidationError):
            validate_summary_or_raise(summary)

    def test_validate_or_raise_passes(self):
        validate_summary_or_raise(self._valid_summary())

    def test_empty_visitor_name_rejected(self):
        summary = self._valid_summary()
        summary["visitor_name"] = ""
        errors = validate_summary(summary)
        self.assertTrue(any("minLength" in e for e in errors))

    def test_empty_follow_up_actions_rejected(self):
        summary = self._valid_summary()
        summary["follow_up_actions"] = []
        errors = validate_summary(summary)
        self.assertTrue(any("minItems" in e or "minimum" in e for e in errors))

    def test_empty_executive_summary_rejected(self):
        summary = self._valid_summary()
        summary["executive_summary"] = ""
        errors = validate_summary(summary)
        self.assertTrue(any("minLength" in e for e in errors))

    def test_empty_string_in_products_rejected(self):
        summary = self._valid_summary()
        summary["products_demonstrated"] = ["XDR", ""]
        errors = validate_summary(summary)
        self.assertTrue(any("minLength" in e for e in errors))

    def test_schema_exported_in_prompts(self):
        from analysis.engines.prompts import SUMMARY_JSON_SCHEMA
        import json
        schema = json.loads(SUMMARY_JSON_SCHEMA)
        self.assertIn("visitor_name", schema["properties"])
        self.assertIn("follow_up_actions", schema["properties"])
        self.assertIn("demo_duration_seconds", schema["properties"])


if __name__ == "__main__":
    unittest.main()
