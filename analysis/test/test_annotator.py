"""Tests for screenshot annotator engine.

Validates annotation rendering: circles, sequence numbers, tooltips,
edge-case handling (clicks near edges, missing data, empty events).
"""

import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from PIL import Image
from analysis.engines.annotator import annotate_screenshot, _get_element_label


class TestAnnotateScreenshot(unittest.TestCase):
    def _make_image(self, w=1920, h=1080):
        return Image.new("RGBA", (w, h), (30, 30, 40, 255))

    def test_basic_annotation(self):
        img = self._make_image()
        clicks = [
            {"index": 1, "coordinates": {"x": 500, "y": 300}, "element": {"text": "Dashboard"}},
            {"index": 2, "coordinates": {"x": 800, "y": 500}, "element": {"text": "Settings"}},
        ]
        result = annotate_screenshot(img, clicks)
        self.assertEqual(result.size, (1920, 1080))
        self.assertEqual(result.mode, "RGBA")
        # Verify pixels changed at click locations (not the original dark background)
        px = result.getpixel((500, 300 - 28))  # top of circle
        self.assertNotEqual(px, (30, 30, 40, 255), "Circle should be drawn at click location")

    def test_empty_clicks(self):
        img = self._make_image()
        result = annotate_screenshot(img, [])
        # Should return same-size image without crashing
        self.assertEqual(result.size, (1920, 1080))

    def test_click_near_top_left_edge(self):
        img = self._make_image()
        clicks = [{"index": 1, "coordinates": {"x": 5, "y": 5}, "element": {"text": "Corner"}}]
        # Should not crash -- badge and tooltip clamped to screen
        result = annotate_screenshot(img, clicks)
        self.assertEqual(result.size, (1920, 1080))

    def test_click_near_bottom_right_edge(self):
        img = self._make_image()
        clicks = [{"index": 1, "coordinates": {"x": 1915, "y": 1075}, "element": {"text": "Corner"}}]
        result = annotate_screenshot(img, clicks)
        self.assertEqual(result.size, (1920, 1080))

    def test_missing_coordinates(self):
        img = self._make_image()
        clicks = [{"index": 1, "coordinates": {}, "element": {"text": "No coords"}}]
        result = annotate_screenshot(img, clicks)
        self.assertEqual(result.size, (1920, 1080))

    def test_no_element_text(self):
        img = self._make_image()
        clicks = [{"index": 1, "coordinates": {"x": 400, "y": 400}, "element": {}}]
        result = annotate_screenshot(img, clicks)
        self.assertEqual(result.size, (1920, 1080))

    def test_element_as_string(self):
        img = self._make_image()
        clicks = [{"index": 1, "coordinates": {"x": 400, "y": 400}, "element": "Click Me"}]
        result = annotate_screenshot(img, clicks)
        self.assertEqual(result.size, (1920, 1080))


class TestGetElementLabel(unittest.TestCase):
    def test_text_field(self):
        self.assertEqual(_get_element_label({"element": {"text": "Hello"}}), "Hello")

    def test_aria_label_fallback(self):
        self.assertEqual(_get_element_label({"element": {"aria-label": "Close"}}), "Close")

    def test_id_fallback(self):
        self.assertEqual(_get_element_label({"element": {"id": "btn-save"}}), "btn-save")

    def test_page_title_fallback(self):
        self.assertEqual(
            _get_element_label({"element": {}, "page_title": "Dashboard"}),
            "Dashboard",
        )

    def test_string_element(self):
        self.assertEqual(_get_element_label({"element": "Raw Text"}), "Raw Text")

    def test_truncation(self):
        long = "A" * 100
        result = _get_element_label({"element": {"text": long}})
        self.assertEqual(len(result), 40)

    def test_empty(self):
        self.assertEqual(_get_element_label({"element": {}}), "")


if __name__ == "__main__":
    unittest.main()
