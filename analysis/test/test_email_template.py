"""Tests for engines/email_template.py — follow-up email generator."""

import pytest
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from engines.email_template import render_follow_up_email, _esc, _build_interest_summary


# -- Fixtures --

@pytest.fixture
def sample_summary():
    return {
        "session_id": "B291047",
        "visitor_name": "Priya Sharma",
        "products_demonstrated": ["Endpoint Security", "XDR", "Risk Insights"],
        "key_interests": [
            {"topic": "Endpoint policy management", "confidence": "high", "evidence": "Asked 3 questions"},
            {"topic": "XDR detection rules", "confidence": "medium", "evidence": "Spent 2 min on page"},
        ],
        "follow_up_actions": [
            "Send EP policy best practices guide",
            "Schedule deep-dive on XDR custom detection rules",
            "Share V1 tenant link for self-guided exploration",
        ],
        "demo_duration_seconds": 900,
        "session_score": 8,
        "executive_summary": "Visitor showed strong interest in endpoint policy management.",
        "v1_tenant_link": "https://portal.xdr.trendmicro.com/demo",
        "generated_at": "2026-08-06T10:45:00Z",
    }


@pytest.fixture
def sample_follow_up():
    return {
        "session_id": "B291047",
        "visitor_email": "priya@example.com",
        "summary_url": "https://boothapp.trendmicro.com/sessions/B291047/summary.html",
        "tenant_url": "https://portal.xdr.trendmicro.com/demo",
        "priority": "high",
        "tags": ["endpoint", "xdr"],
        "sdr_notes": "Enterprise CISO, 5000 endpoints",
    }


@pytest.fixture
def sample_metadata():
    return {
        "session_id": "B291047",
        "visitor_name": "Priya Sharma",
        "se_name": "Casey Mondoux",
        "started_at": "2026-08-06T10:15:00Z",
        "ended_at": "2026-08-06T10:32:00Z",
    }


# -- Helper tests --

class TestEsc:
    def test_escapes_html(self):
        assert _esc('<script>alert("xss")</script>') == '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'

    def test_none(self):
        assert _esc(None) == ""


class TestBuildInterestSummary:
    def test_single_high(self):
        interests = [{"topic": "XDR", "confidence": "high"}]
        assert _build_interest_summary(interests) == "XDR"

    def test_two_high(self):
        interests = [
            {"topic": "XDR", "confidence": "high"},
            {"topic": "EP", "confidence": "high"},
        ]
        assert _build_interest_summary(interests) == "XDR and EP"

    def test_three_high(self):
        interests = [
            {"topic": "XDR", "confidence": "high"},
            {"topic": "EP", "confidence": "high"},
            {"topic": "Risk", "confidence": "high"},
        ]
        assert _build_interest_summary(interests) == "XDR, EP, and Risk"

    def test_no_high_falls_back(self):
        interests = [
            {"topic": "A", "confidence": "low"},
            {"topic": "B", "confidence": "medium"},
        ]
        result = _build_interest_summary(interests)
        assert "A" in result and "B" in result

    def test_empty(self):
        assert _build_interest_summary([]) == ""


# -- Full render tests --

class TestRenderFollowUpEmail:
    def test_contains_visitor_name(self, sample_summary, sample_follow_up, sample_metadata):
        html = render_follow_up_email(sample_summary, sample_follow_up, sample_metadata)
        assert "Priya Sharma" in html

    def test_contains_se_name(self, sample_summary, sample_follow_up, sample_metadata):
        html = render_follow_up_email(sample_summary, sample_follow_up, sample_metadata)
        assert "Casey Mondoux" in html

    def test_contains_products(self, sample_summary, sample_follow_up):
        html = render_follow_up_email(sample_summary, sample_follow_up)
        assert "Endpoint Security" in html
        assert "XDR" in html
        assert "Risk Insights" in html

    def test_contains_recommendations(self, sample_summary, sample_follow_up):
        html = render_follow_up_email(sample_summary, sample_follow_up)
        assert "Send EP policy best practices guide" in html
        assert "Schedule deep-dive on XDR custom detection rules" in html

    def test_contains_cta_meeting(self, sample_summary, sample_follow_up):
        html = render_follow_up_email(sample_summary, sample_follow_up)
        assert "Schedule a Follow-Up Meeting" in html

    def test_contains_cta_explore(self, sample_summary, sample_follow_up):
        html = render_follow_up_email(sample_summary, sample_follow_up)
        assert "Explore Your Vision One Environment" in html

    def test_contains_trend_micro_branding(self, sample_summary, sample_follow_up):
        html = render_follow_up_email(sample_summary, sample_follow_up)
        assert "TREND MICRO" in html
        assert "Vision One" in html

    def test_contains_tenant_url(self, sample_summary, sample_follow_up):
        html = render_follow_up_email(sample_summary, sample_follow_up)
        assert "portal.xdr.trendmicro.com" in html

    def test_contains_executive_summary(self, sample_summary, sample_follow_up):
        html = render_follow_up_email(sample_summary, sample_follow_up)
        assert "endpoint policy management" in html

    def test_personalized_intro(self, sample_summary, sample_follow_up):
        html = render_follow_up_email(sample_summary, sample_follow_up)
        assert "particular interest in" in html

    def test_valid_html_structure(self, sample_summary, sample_follow_up):
        html = render_follow_up_email(sample_summary, sample_follow_up)
        assert html.strip().startswith("<!DOCTYPE html>")
        assert "</html>" in html
        assert "<body" in html

    def test_xss_escaped(self, sample_follow_up):
        summary = {
            "visitor_name": '<script>alert("xss")</script>',
            "products_demonstrated": [],
            "key_interests": [],
            "follow_up_actions": [],
        }
        html = render_follow_up_email(summary, sample_follow_up)
        assert "<script>" not in html
        assert "&lt;script&gt;" in html

    def test_minimal_data(self):
        html = render_follow_up_email({}, {})
        assert "Valued Visitor" in html
        assert "TREND MICRO" in html

    def test_no_metadata(self, sample_summary, sample_follow_up):
        html = render_follow_up_email(sample_summary, sample_follow_up)
        assert "Priya Sharma" in html

    def test_summary_url_link(self, sample_summary, sample_follow_up):
        html = render_follow_up_email(sample_summary, sample_follow_up)
        assert "boothapp.trendmicro.com" in html

    def test_email_table_layout(self, sample_summary, sample_follow_up):
        html = render_follow_up_email(sample_summary, sample_follow_up)
        assert 'role="presentation"' in html
        assert "max-width:640px" in html
