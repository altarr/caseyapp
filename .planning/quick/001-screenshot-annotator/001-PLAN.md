# Screenshot Annotator

## Goal
Add visual annotations to session screenshots showing click locations, sequence numbers, and element labels. Integrate into the analysis pipeline as a step between correlation and Claude analysis.

## Success Criteria
- [ ] `analysis/engines/annotator.py` draws red circles at click coordinates
- [ ] Sequence numbers (1, 2, 3...) displayed next to each circle
- [ ] Tooltip showing element text or aria-label near each annotation
- [ ] Annotated screenshots saved to `output/annotated/` in session S3 folder
- [ ] Uses Pillow (PIL) for image manipulation
- [ ] Integrated into pipeline-run.js as step 4 (after correlation, before analysis)
- [ ] Pillow added to requirements.txt
