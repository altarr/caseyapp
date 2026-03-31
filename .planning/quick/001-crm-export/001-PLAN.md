# CRM Export Integration

## Goal
Add a CRM integration module that exports visitor session data in vCard, CSV, Salesforce JSON formats, and add "Export to CRM" section to the dashboard.

## Success Criteria
1. `analysis/engines/crm_export.py` generates vCard (.vcf) with visitor name, company, title
2. Generates CSV row for bulk import (name, company, title, products_shown, engagement_score, follow_up_actions)
3. Generates Salesforce-compatible lead JSON
4. All exports written to output/crm/ folder
5. Dashboard has "Export to CRM" section with download buttons for each format
6. Unit tests pass
