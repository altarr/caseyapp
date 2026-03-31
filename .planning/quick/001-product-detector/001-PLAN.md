# Product Detector Engine

## Goal
Add V1 product detection to the analysis pipeline. Given clicks.json, identify which Vision One products/features were demonstrated and output structured stats to output/products.json.

## Success Criteria
- [ ] `analysis/engines/product_detector.py` exists with `detect_products()` function
- [ ] Maps URL patterns to products per spec (xdr, search, workbench, cloud-security, risk-insights, endpoint, email, network)
- [ ] Reuses existing `v1_features.json` config for URL pattern matching
- [ ] Outputs `products_demonstrated` array with: name, time_spent_seconds, click_count, screenshots_count
- [ ] Writes to output/products.json
- [ ] Works standalone (CLI) and as importable module
- [ ] Tests pass with sample data
