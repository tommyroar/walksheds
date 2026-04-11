#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.10"
# dependencies = ["httpx"]
# ///
"""Compare data/station-index.json against the live SDOT stations feed.

Reports stations that have been added, removed, or moved beyond a tolerance.
Exits non-zero on any drift so the calling workflow can label its output PR.

Usage: python data/compare_station_index.py [--threshold 75]
"""

import json
import math
import os
import sys
from dataclasses import dataclass, field
from pathlib import Path

# Allow `import refresh`/`import process` regardless of cwd.
sys.path.insert(0, str(Path(__file__).resolve().parent))

import refresh  # noqa: E402
from process import MISSING_STATIONS, NAME_MAP  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
INDEX_PATH = ROOT / "data" / "station-index.json"

DEFAULT_THRESHOLD_M = 75.0


def haversine(lng1: float, lat1: float, lng2: float, lat2: float) -> float:
    """Great-circle distance in meters."""
    r = 6_371_000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


@dataclass
class Drift:
    name: str
    distance_m: float


@dataclass
class Report:
    added: list[str] = field(default_factory=list)
    removed: list[str] = field(default_factory=list)
    drifted: list[Drift] = field(default_factory=list)

    @property
    def ok(self) -> bool:
        return not (self.added or self.removed or self.drifted)


def load_index(path: Path = INDEX_PATH) -> dict:
    with open(path) as f:
        return json.load(f)


def fetch_live() -> dict:
    data = refresh.fetch_geojson(refresh.STATIONS_URL)
    refresh.validate_stations(data)
    return data


def _live_station_map(live: dict) -> dict[str, tuple[float, float]]:
    """Map of live station name (post NAME_MAP normalization) -> (lng, lat).

    Filters to existing/under-construction stations and excludes Tacoma Link
    (matching the filter in process.py).
    """
    out: dict[str, tuple[float, float]] = {}
    tacoma_kw = ("Commerce", "Theater District", "Convention Center",
                 "Union Station", "Tacoma Dome", "South 25th")
    for feat in live["features"]:
        props = feat["properties"]
        if props.get("STATUS") != "Existing / Under Construction":
            continue
        # process.py uses list(values())[2] for the name; mirror that here.
        raw_name = list(props.values())[2] if len(props) > 2 else props.get("NAME", "")
        if not raw_name or any(kw in raw_name for kw in tacoma_kw):
            continue
        name = NAME_MAP.get(raw_name, raw_name)
        coords = feat["geometry"]["coordinates"]
        out[name] = (coords[0], coords[1])
    return out


def compare(index: dict, live: dict, threshold_m: float = DEFAULT_THRESHOLD_M) -> Report:
    """Diff a station index against a live SDOT GeoJSON FeatureCollection."""
    index_by_name = {s["name"]: s for s in index["stations"]}
    live_by_name = _live_station_map(live)
    missing_names = {name for name, _, _ in MISSING_STATIONS}

    report = Report()

    # Stations live knows about that we don't.
    for name in sorted(live_by_name.keys() - index_by_name.keys()):
        report.added.append(name)

    # Stations we have that live doesn't, ignoring known-missing.
    for name in sorted(index_by_name.keys() - live_by_name.keys()):
        if name in missing_names:
            continue
        report.removed.append(name)

    # Coordinate drift on intersection (also skip MISSING_STATIONS — those
    # carry approximate coords and aren't authoritative).
    for name in sorted(index_by_name.keys() & live_by_name.keys()):
        if name in missing_names:
            continue
        idx = index_by_name[name]
        lng, lat = live_by_name[name]
        d = haversine(idx["lng"], idx["lat"], lng, lat)
        if d > threshold_m:
            report.drifted.append(Drift(name=name, distance_m=d))

    return report


def format_summary(report: Report, threshold_m: float) -> str:
    lines = ["# Station index drift report", ""]
    if report.ok:
        lines.append(f"OK — no drift detected (threshold {threshold_m:.0f} m).")
        return "\n".join(lines) + "\n"

    lines.append(f"Drift detected (threshold {threshold_m:.0f} m).")
    lines.append("")
    if report.added:
        lines.append(f"## Added in live feed ({len(report.added)})")
        for n in report.added:
            lines.append(f"- {n}")
        lines.append("")
    if report.removed:
        lines.append(f"## Missing from live feed ({len(report.removed)})")
        for n in report.removed:
            lines.append(f"- {n}")
        lines.append("")
    if report.drifted:
        lines.append(f"## Coordinate drift ({len(report.drifted)})")
        for d in report.drifted:
            lines.append(f"- {d.name}: {d.distance_m:.0f} m")
        lines.append("")
    return "\n".join(lines) + "\n"


def main():
    threshold = DEFAULT_THRESHOLD_M
    if "--threshold" in sys.argv:
        i = sys.argv.index("--threshold")
        threshold = float(sys.argv[i + 1])

    print("Loading station index...")
    index = load_index()
    print(f"  → {len(index['stations'])} stations")

    print("Fetching live SDOT stations...")
    live = fetch_live()
    print(f"  → {len(live['features'])} features")

    report = compare(index, live, threshold_m=threshold)
    summary = format_summary(report, threshold)
    print()
    print(summary)

    summary_path = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary_path:
        with open(summary_path, "a") as f:
            f.write(summary)

    sys.exit(0 if report.ok else 1)


if __name__ == "__main__":
    main()
