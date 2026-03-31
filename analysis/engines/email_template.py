"""Generate a personalized follow-up email HTML template for booth demo visitors.

Reads summary.json + follow-up.json data and produces a self-contained HTML email
suitable for sending via any email platform. Uses Trend Micro brand styling with
table-based layout for maximum email client compatibility.
"""


def _esc(val):
    """HTML-escape a string value."""
    if val is None:
        return ""
    return (
        str(val)
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


def _format_date(iso_string):
    """Format ISO timestamp to human-readable date."""
    if not iso_string:
        return ""
    try:
        from datetime import datetime
        dt = datetime.fromisoformat(iso_string.replace("Z", "+00:00"))
        return dt.strftime("%B %d, %Y")
    except (ValueError, AttributeError):
        return iso_string


def _build_product_rows(products):
    """Build table rows for products demonstrated."""
    if not products:
        return ""
    rows = []
    colors = ["#3b82f6", "#8b5cf6", "#06b6d4", "#f59e0b", "#e94560", "#22c55e"]
    for i, product in enumerate(products):
        color = colors[i % len(colors)]
        rows.append(
            f'<tr><td style="padding:8px 16px;font-size:14px;color:#1e293b;'
            f'border-bottom:1px solid #f1f5f9">'
            f'<span style="display:inline-block;width:8px;height:8px;'
            f'border-radius:50%;background:{color};margin-right:10px"></span>'
            f'{_esc(product)}</td></tr>'
        )
    return "\n".join(rows)


def _build_recommendation_rows(actions):
    """Build numbered recommendation items."""
    if not actions:
        return ""
    rows = []
    for i, action in enumerate(actions, 1):
        rows.append(
            f'<tr><td style="padding:10px 16px;font-size:14px;color:#334155;'
            f'border-bottom:1px solid #f1f5f9;line-height:1.6">'
            f'<span style="display:inline-block;width:24px;height:24px;'
            f'border-radius:50%;background:#e94560;color:#fff;text-align:center;'
            f'line-height:24px;font-size:12px;font-weight:700;margin-right:10px;'
            f'vertical-align:middle">{i}</span>'
            f'{_esc(action)}</td></tr>'
        )
    return "\n".join(rows)


def _build_interest_summary(interests):
    """Build a brief text summary of top visitor interests."""
    if not interests:
        return ""
    high = [i for i in interests if i.get("confidence") == "high"]
    if not high:
        high = interests[:2]
    topics = [_esc(i.get("topic", "")) for i in high[:3]]
    if len(topics) == 1:
        return topics[0]
    if len(topics) == 2:
        return f"{topics[0]} and {topics[1]}"
    return f"{', '.join(topics[:-1])}, and {topics[-1]}"


def render_follow_up_email(summary, follow_up, metadata=None):
    """Render a personalized follow-up email HTML template.

    Args:
        summary: Dict from summary.json (session analysis results).
        follow_up: Dict from follow-up.json (follow-up actions and metadata).
        metadata: Optional dict from metadata.json (session metadata).

    Returns:
        Complete HTML string ready to write as follow-up-email.html.
    """
    metadata = metadata or {}

    visitor_name = _esc(
        summary.get("visitor_name")
        or metadata.get("visitor_name")
        or "Valued Visitor"
    )
    se_name = _esc(metadata.get("se_name", ""))
    session_date = _format_date(
        metadata.get("started_at") or summary.get("generated_at", "")
    )
    products = summary.get("products_demonstrated", [])
    interests = summary.get("key_interests", [])
    actions = summary.get("follow_up_actions", [])
    exec_summary = _esc(summary.get("executive_summary", ""))
    tenant_url = _esc(
        follow_up.get("tenant_url")
        or summary.get("v1_tenant_link", "")
    )
    summary_url = _esc(follow_up.get("summary_url", ""))

    interest_text = _build_interest_summary(interests)
    product_rows = _build_product_rows(products)
    recommendation_rows = _build_recommendation_rows(actions)

    # Personalized intro paragraph
    if interest_text:
        intro = (
            f"During your demo, you showed particular interest in "
            f"<strong>{interest_text}</strong>. "
            f"We've put together some personalized recommendations to help "
            f"you explore these areas further."
        )
    else:
        intro = (
            "Thank you for taking the time to explore Trend Micro Vision One "
            "with us. Below you'll find a summary of what we covered and "
            "recommended next steps."
        )

    # CTA link -- prefer tenant URL, fall back to summary URL
    cta_url = tenant_url or summary_url or "#"
    cta_text = "Explore Your Vision One Environment" if tenant_url else "View Your Demo Summary"

    # Pre-build conditional sections (can't nest f-strings in triple-quoted blocks)
    exec_section = ""
    if exec_summary:
        exec_section = (
            '<tr><td style="padding:16px 32px">'
            '<div style="background:#f8fafc;border-left:4px solid #e94560;border-radius:0 8px 8px 0;padding:16px 20px">'
            '<div style="font-size:11px;font-weight:700;color:#e94560;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:6px">Session Highlights</div>'
            f'<div style="font-size:14px;color:#475569;line-height:1.7;font-style:italic">{exec_summary}</div>'
            '</div></td></tr>'
        )

    products_section = ""
    if product_rows:
        products_section = (
            '<tr><td style="padding:24px 32px 8px">'
            '<div style="font-size:13px;font-weight:700;color:#e94560;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:12px">Products We Explored Together</div>'
            f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f8fafc;border-radius:8px;overflow:hidden">{product_rows}</table>'
            '</td></tr>'
        )

    recommendations_section = ""
    if recommendation_rows:
        recommendations_section = (
            '<tr><td style="padding:24px 32px 8px">'
            '<div style="font-size:13px;font-weight:700;color:#e94560;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:12px">Recommended Next Steps</div>'
            f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f8fafc;border-radius:8px;overflow:hidden">{recommendation_rows}</table>'
            '</td></tr>'
        )

    tenant_note = ""
    if tenant_url:
        tenant_note = '<div style="font-size:12px;color:#94a3b8;margin-top:12px">Your personalized environment is available for 30 days</div>'

    summary_link_section = ""
    if summary_url:
        summary_link_section = (
            '<tr><td style="padding:0 32px 24px;text-align:center">'
            f'<a href="{summary_url}" target="_blank" style="font-size:13px;color:#3b82f6;text-decoration:underline">'
            'View your complete demo summary online</a></td></tr>'
        )

    date_part = f" on {session_date}" if session_date else ""
    se_part = f" -- presented by {se_name}" if se_name else ""

    return f"""<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>Your Vision One Demo Follow-Up</title>
<!--[if mso]>
<noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
<![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1e293b;line-height:1.6;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%">

<!-- Wrapper -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f1f5f9">
<tr><td align="center" style="padding:32px 16px">

<!-- Email Container -->
<table role="presentation" width="640" cellpadding="0" cellspacing="0" border="0" style="max-width:640px;width:100%;background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1)">

  <!-- Header with Trend Micro Branding -->
  <tr>
    <td style="background:linear-gradient(135deg,#e94560 0%,#c2185b 100%);padding:32px;text-align:center">
      <div style="font-size:24px;font-weight:800;color:#ffffff;letter-spacing:0.02em">TREND MICRO</div>
      <div style="font-size:11px;color:rgba(255,255,255,0.8);margin-top:4px;letter-spacing:0.15em;text-transform:uppercase">Vision One</div>
    </td>
  </tr>

  <!-- Greeting -->
  <tr>
    <td style="padding:32px 32px 8px">
      <div style="font-size:22px;font-weight:700;color:#0f172a;margin-bottom:8px">
        Hi {visitor_name},
      </div>
      <div style="font-size:14px;color:#64748b;margin-bottom:16px">
        Thank you for visiting our booth{date_part}{se_part}.
      </div>
      <div style="font-size:15px;color:#334155;line-height:1.7">
        {intro}
      </div>
    </td>
  </tr>

  <!-- Executive Summary -->
  {exec_section}

  <!-- Products Demonstrated -->
  {products_section}

  <!-- Personalized Recommendations -->
  {recommendations_section}

  <!-- CTA Button -->
  <tr>
    <td style="padding:32px;text-align:center">
      <div style="font-size:14px;color:#475569;margin-bottom:16px">Ready to dive deeper?</div>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto">
        <tr>
          <td style="background:linear-gradient(135deg,#e94560 0%,#c2185b 100%);border-radius:8px">
            <a href="{cta_url}" target="_blank" style="display:inline-block;padding:16px 40px;font-size:16px;font-weight:700;color:#ffffff;text-decoration:none;letter-spacing:0.02em">
              {cta_text}
            </a>
          </td>
        </tr>
      </table>
      {tenant_note}
    </td>
  </tr>

  <!-- Schedule Meeting CTA -->
  <tr>
    <td style="padding:0 32px 32px;text-align:center">
      <div style="border-top:1px solid #e2e8f0;padding-top:24px">
        <div style="font-size:15px;color:#334155;font-weight:600;margin-bottom:8px">Want to discuss further?</div>
        <div style="font-size:14px;color:#64748b;margin-bottom:16px">
          Our team is ready to schedule a personalized deep-dive session tailored to your needs.
        </div>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto">
          <tr>
            <td style="border:2px solid #e94560;border-radius:8px">
              <a href="mailto:demo-followup@trendmicro.com?subject=Follow-up%20meeting%20request&amp;body=Hi%2C%20I%20visited%20the%20Trend%20Micro%20booth%20and%20would%20like%20to%20schedule%20a%20follow-up%20meeting." style="display:inline-block;padding:12px 32px;font-size:14px;font-weight:600;color:#e94560;text-decoration:none">
                Schedule a Follow-Up Meeting
              </a>
            </td>
          </tr>
        </table>
      </div>
    </td>
  </tr>

  <!-- View Full Summary Link -->
  {summary_link_section}

  <!-- Footer -->
  <tr>
    <td style="background-color:#0f172a;padding:24px 32px;text-align:center">
      <div style="font-size:11px;color:#94a3b8;line-height:1.6;letter-spacing:0.02em">
        This email was generated by Trend Micro BoothApp.<br>
        Questions? Reply to this email or contact your account team.<br>
        <span style="color:#475569">Trend Micro Incorporated</span>
      </div>
    </td>
  </tr>

</table>
<!-- /Email Container -->

</td></tr>
</table>
<!-- /Wrapper -->

</body>
</html>"""
