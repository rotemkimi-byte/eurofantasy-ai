#!/usr/bin/env python3
"""Offline regression checks for the static Pages artifact; no credentials or network."""
import importlib.util
import json
import re
import shutil
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("public_dist", ROOT / "scripts/build_public_dist.py")
BUILDER = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(BUILDER)


class PublicationGuard(unittest.TestCase):
    def test_workflows_only_upload_allowlisted_directory(self):
        uploads = 0
        for file in (ROOT / ".github/workflows").glob("*.y*ml"):
            content = file.read_text(encoding="utf-8")
            for match in re.finditer(r"(?m)^\s*uses: actions/upload-pages-artifact@|^\s*- uses: actions/upload-pages-artifact@", content):
                uploads += 1
                section = content[match.start():].split("\n  deploy:", 1)[0]
                self.assertIn("path: ${{ runner.temp }}/eurofantasy-public-dist", section, file.name)
                self.assertIn("python3 scripts/build_public_dist.py", content[:match.start()], file.name)
        self.assertEqual(uploads, 17)

    def test_publish_fresh_data_and_never_publish_development_files(self):
        with tempfile.TemporaryDirectory() as folder:
            base = Path(folder)
            fixture = base / "source"
            BUILDER.build(ROOT, fixture, base / "baseline.json")
            for fname in ("data/meta.json", "data/roster.json"):
                f = fixture / fname
                d = json.loads(f.read_text())
                d["updated_at"] = "2099-01-01T00:00:00Z"  # artificial refresh, never a real update
                f.write_text(json.dumps(d))
            for fname in ("sync.py", "scripts/rolling_learning.py", "scripts/weighted_rounds.py", "index.html.map", "archive.zip"):
                f = fixture / fname
                f.parent.mkdir(parents=True, exist_ok=True)
                f.write_text("test-only forbidden file")
            new_game = fixture / "data/backtest/cache/E2026-999999-stats.json"
            new_game.write_text("{}")
            output = base / "site"
            BUILDER.build(fixture, output, base / "published.json")
            for fname in ("data/meta.json", "data/roster.json"):
                self.assertEqual(json.loads((output / fname).read_text())["updated_at"], "2099-01-01T00:00:00Z")
            self.assertTrue((output / new_game.relative_to(fixture)).is_file())
            for fname in ("sync.py", "scripts/rolling_learning.py", "scripts/weighted_rounds.py", "index.html.map", "archive.zip"):
                self.assertFalse((output / fname).exists())

            # A new unreviewed browser dependency must fail before producing artifacts.
            index = fixture / "index.html"
            index.write_text(index.read_text() + '<script src="./unreviewed.js"></script>')
            with self.assertRaisesRegex(ValueError, "unapproved HTML dependency"):
                BUILDER.build(fixture, base / "rejected", base / "rejected.json")
            self.assertFalse((base / "rejected").exists())


if __name__ == "__main__":
    unittest.main()
