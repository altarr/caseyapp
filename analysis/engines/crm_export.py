"""CRM export engine -- generates vCard, CSV, and Salesforce lead JSON from session analysis."""

import csv
import io
import json
import os
from datetime import datetime, timezone


def _safe_str(val, default=""):
    """Return str(val) or default if val is None/empty."""
    if val is None:
        return default
    s = str(val).strip()
    return s if s else default


def _escape_vcard(text):
    """Escape special characters for vCard 3.0 text values."""
    return text.replace("\\", "\\\\").replace(",", "\\,").replace(";", "\\;").replace("\n", "\\n")


def generate_vcard(summary, metadata=None):
    """Generate a vCard 3.0 string from session summary and optional metadata.

    Args:
        summary: dict with keys like visitor_name, products_demonstrated, etc.
        metadata: optional dict with extra fields (visitor_company, visitor_title, visitor_email, etc.)

    Returns:
        str: vCard 3.0 formatted string
    """
    metadata = metadata or {}
    visitor_name = _safe_str(summary.get("visitor_name"), "Unknown Visitor")
    company = _safe_str(metadata.get("visitor_company") or summary.get("visitor_company"), "")
    title = _safe_str(metadata.get("visitor_title") or summary.get("visitor_title"), "")
    email = _safe_str(metadata.get("visitor_email") or summary.get("visitor_email"), "")

    # Split name into parts (simple first/last)
    parts = visitor_name.split(None, 1)
    first = parts[0] if parts else visitor_name
    last = parts[1] if len(parts) > 1 else ""

    lines = [
        "BEGIN:VCARD",
        "VERSION:3.0",
        f"N:{_escape_vcard(last)};{_escape_vcard(first)};;;",
        f"FN:{_escape_vcard(visitor_name)}",
    ]

    if company:
        lines.append(f"ORG:{_escape_vcard(company)}")
    if title:
        lines.append(f"TITLE:{_escape_vcard(title)}")
    if email:
        lines.append(f"EMAIL;TYPE=INTERNET:{email}")

    # Add products as a note
    products = summary.get("products_demonstrated", [])
    if products:
        note = f"Demo products: {', '.join(products)}"
        lines.append(f"NOTE:{_escape_vcard(note)}")

    lines.append(f"REV:{datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')}")
    lines.append("END:VCARD")

    return "\r\n".join(lines)


def generate_csv_row(summary, metadata=None):
    """Generate a CSV string (header + one data row) for CRM bulk import.

    Columns: name, company, title, products_shown, engagement_score, follow_up_actions

    Args:
        summary: dict from session analysis
        metadata: optional dict with visitor_company, visitor_title, etc.

    Returns:
        str: CSV with header row and one data row
    """
    metadata = metadata or {}
    name = _safe_str(summary.get("visitor_name"), "Unknown Visitor")
    company = _safe_str(metadata.get("visitor_company") or summary.get("visitor_company"), "")
    title = _safe_str(metadata.get("visitor_title") or summary.get("visitor_title"), "")
    products = "; ".join(summary.get("products_demonstrated", []))
    score = summary.get("session_score", 0)
    actions = "; ".join(summary.get("follow_up_actions", []))

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["name", "company", "title", "products_shown", "engagement_score", "follow_up_actions"])
    writer.writerow([name, company, title, products, score, actions])
    return buf.getvalue()


def generate_salesforce_lead(summary, metadata=None):
    """Generate a Salesforce-compatible Lead JSON object.

    Args:
        summary: dict from session analysis
        metadata: optional dict with visitor_company, visitor_title, visitor_email, etc.

    Returns:
        dict: Salesforce Lead object
    """
    metadata = metadata or {}
    visitor_name = _safe_str(summary.get("visitor_name"), "Unknown Visitor")
    parts = visitor_name.split(None, 1)
    first = parts[0] if parts else visitor_name
    last = parts[1] if len(parts) > 1 else ""

    company = _safe_str(metadata.get("visitor_company") or summary.get("visitor_company"), "Unknown")
    title = _safe_str(metadata.get("visitor_title") or summary.get("visitor_title"), "")
    email = _safe_str(metadata.get("visitor_email") or summary.get("visitor_email"), "")

    products = summary.get("products_demonstrated", [])
    score = summary.get("session_score", 0)
    actions = summary.get("follow_up_actions", [])
    exec_summary = _safe_str(summary.get("executive_summary"), "")

    # Map engagement score to Salesforce rating
    if score >= 8:
        rating = "Hot"
    elif score >= 5:
        rating = "Warm"
    else:
        rating = "Cold"

    lead = {
        "attributes": {"type": "Lead"},
        "FirstName": first,
        "LastName": last or "(Unknown)",
        "Company": company or "(Unknown)",
        "Title": title,
        "Email": email,
        "LeadSource": "Trade Show",
        "Rating": rating,
        "Description": exec_summary,
        "ProductInterest__c": "; ".join(products),
        "EngagementScore__c": score,
        "FollowUpActions__c": "; ".join(actions),
        "DemoDate__c": _safe_str(summary.get("generated_at"), ""),
        "SessionId__c": _safe_str(summary.get("session_id"), ""),
    }

    return lead


def export_all(summary, metadata=None, output_dir="output/crm"):
    """Generate all CRM export formats and write them to output_dir.

    Args:
        summary: dict from session analysis (summary.json)
        metadata: optional dict with visitor_company, visitor_title, visitor_email
        output_dir: directory to write files to (created if missing)

    Returns:
        dict with keys 'vcard', 'csv', 'salesforce_json' mapping to file paths
    """
    os.makedirs(output_dir, exist_ok=True)

    session_id = _safe_str(summary.get("session_id"), "unknown")

    vcard_path = os.path.join(output_dir, f"{session_id}.vcf")
    csv_path = os.path.join(output_dir, f"{session_id}.csv")
    sf_path = os.path.join(output_dir, f"{session_id}_salesforce.json")

    vcard_content = generate_vcard(summary, metadata)
    with open(vcard_path, "w", encoding="utf-8") as f:
        f.write(vcard_content)

    csv_content = generate_csv_row(summary, metadata)
    with open(csv_path, "w", encoding="utf-8", newline="") as f:
        f.write(csv_content)

    sf_lead = generate_salesforce_lead(summary, metadata)
    with open(sf_path, "w", encoding="utf-8") as f:
        json.dump(sf_lead, f, indent=2)

    return {
        "vcard": vcard_path,
        "csv": csv_path,
        "salesforce_json": sf_path,
    }
