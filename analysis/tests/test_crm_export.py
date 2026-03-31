"""Tests for CRM export engine."""

import csv
import io
import json
import os
import tempfile

import pytest

from engines.crm_export import (
    export_all,
    generate_csv_row,
    generate_salesforce_lead,
    generate_vcard,
)

SAMPLE_SUMMARY = {
    "session_id": "A726594",
    "visitor_name": "Jane Doe",
    "products_demonstrated": ["Endpoint Security", "XDR", "Risk Insights"],
    "key_interests": [
        {"topic": "Endpoint policy", "confidence": "high", "evidence": "Asked 3 questions"},
        {"topic": "XDR rules", "confidence": "medium", "evidence": "Spent 2 min on page"},
    ],
    "follow_up_actions": [
        "Send EP policy guide",
        "Schedule XDR deep-dive",
    ],
    "demo_duration_seconds": 900,
    "session_score": 8,
    "executive_summary": "Visitor showed strong interest in endpoint security.",
    "key_moments": [],
    "generated_at": "2026-08-05T15:02:00Z",
}

SAMPLE_METADATA = {
    "visitor_company": "Acme Corp",
    "visitor_title": "CISO",
    "visitor_email": "jane@acme.com",
}


class TestGenerateVcard:
    def test_basic_vcard(self):
        vcf = generate_vcard(SAMPLE_SUMMARY, SAMPLE_METADATA)
        assert vcf.startswith("BEGIN:VCARD")
        assert vcf.endswith("END:VCARD")
        assert "FN:Jane Doe" in vcf
        assert "N:Doe;Jane;;;" in vcf
        assert "ORG:Acme Corp" in vcf
        assert "TITLE:CISO" in vcf
        assert "EMAIL;TYPE=INTERNET:jane@acme.com" in vcf
        assert "Endpoint Security" in vcf

    def test_vcard_without_metadata(self):
        vcf = generate_vcard(SAMPLE_SUMMARY)
        assert "FN:Jane Doe" in vcf
        assert "ORG:" not in vcf  # no company without metadata

    def test_vcard_single_name(self):
        summary = {**SAMPLE_SUMMARY, "visitor_name": "Madonna"}
        vcf = generate_vcard(summary)
        assert "FN:Madonna" in vcf
        assert "N:;Madonna;;;" in vcf

    def test_vcard_special_chars_escaped(self):
        summary = {**SAMPLE_SUMMARY, "visitor_name": "Jane, Jr; Doe"}
        vcf = generate_vcard(summary)
        assert "\\," in vcf
        assert "\\;" in vcf


class TestGenerateCsvRow:
    def test_basic_csv(self):
        result = generate_csv_row(SAMPLE_SUMMARY, SAMPLE_METADATA)
        reader = csv.reader(io.StringIO(result))
        rows = list(reader)
        assert len(rows) == 2
        header = rows[0]
        assert header == ["name", "company", "title", "products_shown", "engagement_score", "follow_up_actions"]
        data = rows[1]
        assert data[0] == "Jane Doe"
        assert data[1] == "Acme Corp"
        assert data[2] == "CISO"
        assert "Endpoint Security" in data[3]
        assert data[4] == "8"
        assert "Send EP policy guide" in data[5]

    def test_csv_without_metadata(self):
        result = generate_csv_row(SAMPLE_SUMMARY)
        reader = csv.reader(io.StringIO(result))
        rows = list(reader)
        assert rows[1][1] == ""  # no company
        assert rows[1][2] == ""  # no title


class TestGenerateSalesforceLead:
    def test_basic_lead(self):
        lead = generate_salesforce_lead(SAMPLE_SUMMARY, SAMPLE_METADATA)
        assert lead["attributes"]["type"] == "Lead"
        assert lead["FirstName"] == "Jane"
        assert lead["LastName"] == "Doe"
        assert lead["Company"] == "Acme Corp"
        assert lead["Title"] == "CISO"
        assert lead["Email"] == "jane@acme.com"
        assert lead["LeadSource"] == "Trade Show"
        assert lead["Rating"] == "Hot"  # score >= 8
        assert lead["EngagementScore__c"] == 8
        assert "Endpoint Security" in lead["ProductInterest__c"]
        assert lead["SessionId__c"] == "A726594"

    def test_warm_rating(self):
        summary = {**SAMPLE_SUMMARY, "session_score": 6}
        lead = generate_salesforce_lead(summary)
        assert lead["Rating"] == "Warm"

    def test_cold_rating(self):
        summary = {**SAMPLE_SUMMARY, "session_score": 3}
        lead = generate_salesforce_lead(summary)
        assert lead["Rating"] == "Cold"

    def test_unknown_company_fallback(self):
        lead = generate_salesforce_lead(SAMPLE_SUMMARY)
        assert lead["Company"] == "Unknown"

    def test_single_name_last_name_fallback(self):
        summary = {**SAMPLE_SUMMARY, "visitor_name": "Cher"}
        lead = generate_salesforce_lead(summary)
        assert lead["FirstName"] == "Cher"
        assert lead["LastName"] == "(Unknown)"


class TestExportAll:
    def test_writes_all_files(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            paths = export_all(SAMPLE_SUMMARY, SAMPLE_METADATA, output_dir=tmpdir)

            assert os.path.isfile(paths["vcard"])
            assert paths["vcard"].endswith(".vcf")
            with open(paths["vcard"]) as f:
                assert "BEGIN:VCARD" in f.read()

            assert os.path.isfile(paths["csv"])
            assert paths["csv"].endswith(".csv")
            with open(paths["csv"]) as f:
                content = f.read()
                assert "Jane Doe" in content

            assert os.path.isfile(paths["salesforce_json"])
            with open(paths["salesforce_json"]) as f:
                lead = json.load(f)
                assert lead["FirstName"] == "Jane"

    def test_creates_output_dir(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            nested = os.path.join(tmpdir, "output", "crm")
            paths = export_all(SAMPLE_SUMMARY, output_dir=nested)
            assert os.path.isdir(nested)
            assert os.path.isfile(paths["vcard"])

    def test_session_id_in_filenames(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            paths = export_all(SAMPLE_SUMMARY, output_dir=tmpdir)
            for path in paths.values():
                assert "A726594" in os.path.basename(path)
