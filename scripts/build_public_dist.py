#!/usr/bin/env python3
"""Build EuroFantasy AI's allowlisted static Pages artifact; never deploy it.

Only explicit runtime assets and current-season data families are allowed.
Run on a private source checkout; the output must be a new directory.
"""
import argparse
import gzip
import hashlib
import json
import re
import shutil
from pathlib import Path

HTML = """index.html app.html connect.html connect2.html""".split()
ASSETS = """
advanced-player-core.js advanced-player-tools.css advanced-player-tools.js
app-design.css app-navigation.js app-player.js audit-compact.css audit-compact.js
chart-game-card.js coaches-ui.css coaches-ui.js component-forecast.css component-forecast.js
control-design.css defense-core.js defense-ui.js defense.css dna-core.js dna-metric-explanations.js
dna-player-core.js dna-tools.css dna-tools.js fantasy-compact.css fantasy-compact.js free-throws.js
game-data-store.js home-dashboard.css home-dashboard.js learning-model-version.js learning.css
learning.js live.js matchup-context-core.js matchup-context.js matchup-live.js model-stability.js
official-offense-core.js optimizer.js optimizer-worker.js performance-controls.js personal-model-core.js
personal-model.js pir-compare.js player-analysis.css player-analysis.js player-identities.js
player-identity-core.js player-matchup-history.js player-statistics.css popularity.css popularity.js
position-defense-core.js position-matchups.js risk-profile-core.js risk-profile.css risk-profile.js
rolling-learning.js rolling-model-version.js roster-live.js round-lab.css round-lab.js round-review.js
season-game-picker.js squad-layout.css squad-matchup.js squad-optimizer.css squad-optimizer.js
surprises.js team-metrics-core.js team-metrics-ui.js team-metrics.css unified-forecast-core.js
usage-core.js usage-ui.js usage.css watchlist.js weighted-forecast-core.js weighted-forecast.css
weighted-forecast.js
""".split()
DATA = """
data/advanced-players.json data/context/E2026-schedule.json data/euroleague-live-E2026.json
data/matchup-context.json data/matchups.json data/meta.json data/official-offense.json
data/performance-history.json data/player-dna-events.json data/player-history.json
data/player-identities.json data/player-media.json data/players.json data/popularity-snapshots.json
data/position-matchups.json data/recent-form.json data/risk-profile.json data/roster.json
data/rosters.json data/round-lab.json data/team-dna-events.json
data/learning/latest.json data/learning/rolling.json data/learning/tool-impacts.json
data/learning/position-defense-validation.json data/backtest/report-round-01.json
data/component-forecast/live.json.gz data/component-forecast/performance.json.gz
""".split()
# The browser constructs these filenames at runtime for current-season game cards
# and round history. Restrict each pattern to its exact file family, not a directory.
DYNAMIC = {
    "data/backtest/cache": re.compile(r"E2026-[1-9][0-9]*-stats\.json\Z"),
    "data/backtest": re.compile(r"predictions-round-[0-9]{2}\.json\Z"),
}

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def safe_file(root, relative):
    file = root / relative
    if not file.is_file() or file.is_symlink() or file.resolve() != file.absolute():
        raise ValueError(f"missing or unsafe required file: {relative}")
    return file

def build(source, output, manifest):
    source, output, manifest = source.resolve(), output.resolve(), manifest.resolve()
    if output.exists() or manifest.exists():
        raise ValueError("output and manifest must not already exist")
    if source == output or source in output.parents or output in source.parents:
        raise ValueError("source and publication directories must be separate")
    if output == manifest or output in manifest.parents:
        raise ValueError("manifest must stay outside public publication")
    allowed = set(HTML + ASSETS + DATA)
    for directory, pattern in DYNAMIC.items():
        matches = [f for f in (source / directory).iterdir() if pattern.fullmatch(f.name)]
        if not matches:
            raise ValueError(f"no runtime files in {directory}")
        allowed.update(f.relative_to(source).as_posix() for f in matches)
    for file in sorted(allowed):
        safe_file(source, file)
    # New linked browser assets must be explicitly reviewed before publication.
    for entry in HTML:
        content = (source / entry).read_text(encoding="utf-8")
        for ref in re.findall(r'''(?:src|href)=["'](\./[^"']+)["']''', content):
            ref = ref[2:].split("?", 1)[0].split("#", 1)[0]
            if ref not in allowed:
                raise ValueError(f"unapproved HTML dependency {entry}: {ref}")
    # Fail closed on newly referenced data, rather than silently publishing a broken site.
    for entry in sorted(allowed):
        if not entry.endswith((".js", ".html")):
            continue
        content = (source / entry).read_text(encoding="utf-8")
        for ref in re.findall(r'''["'](?:\./)?data/([\w./-]+\.json(?:\.gz)?)(?:[?"'])''', content):
            if "data/" + ref not in allowed:
                raise ValueError(f"unapproved runtime data dependency {entry}: data/{ref}")
        if re.search(r"sourceMappingURL\s*=", content):
            raise ValueError(f"source map directive in public asset: {entry}")
    for entry in sorted(allowed):
        if entry.endswith(".css") and re.search(r"sourceMappingURL\s*=", (source / entry).read_text(encoding="utf-8")):
            raise ValueError(f"source map directive in public stylesheet: {entry}")
    # Validate current data files, including gzip payloads; reject corrupt data.
    for file in sorted(allowed):
        if file.endswith(".json.gz"):
            with gzip.open(source / file, "rt", encoding="utf-8") as handle:
                json.load(handle)
        elif file.endswith(".json"):
            with (source / file).open(encoding="utf-8") as handle:
                json.load(handle)
    output.mkdir(mode=0o700, parents=True, exist_ok=False)
    records = []
    for file in sorted(allowed):
        src = safe_file(source, file)
        dst = output / file
        dst.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
        shutil.copyfile(src, dst)
        checksum = digest(src)
        if digest(dst) != checksum:
            raise ValueError(f"copy mismatch: {file}")
        records.append({"path": file, "bytes": dst.stat().st_size, "sha256": checksum})
    (output / ".nojekyll").touch()
    actual = {f.relative_to(output).as_posix() for f in output.rglob("*") if f.is_file()}
    if actual != allowed | {".nojekyll"} or any(f.is_symlink() for f in output.rglob("*")):
        raise ValueError("unexpected file or symlink in Pages artifact")
    manifest.write_text(json.dumps({"files": records, "count": len(records), "bytes": sum(r["bytes"] for r in records)}, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"files": len(records), "bytes": sum(r["bytes"] for r in records)}))

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("manifest", type=Path)
    args = parser.parse_args()
    build(args.source, args.output, args.manifest)
