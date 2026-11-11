import os
import json
import re
import urllib.request
import urllib.error
from datetime import datetime, timezone
from pathlib import Path

API = "https://fantaking-api.dunkest.com/api/v1"
TOKEN = os.environ.get("FANTASY_TOKEN", "").strip()

DATA_DIR = Path("data")
DATA_DIR.mkdir(exist_ok=True)
POPULARITY_SEASON = "E2026"
POPULARITY_LIST_ID = 49
POPULARITY_POSITIONS = {"G", "F", "C"}


def api(path, auth=True):
    headers = {
        "Accept": "application/json",
        "User-Agent": "EuroFantasy-AI/1.0",
    }

    if auth:
        if not TOKEN:
            raise RuntimeError("FANTASY_TOKEN is missing")
        headers["Authorization"] = f"Bearer {TOKEN}"

    req = urllib.request.Request(API + path, headers=headers)

    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            return json.loads(response.read().decode("utf-8"))

    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="ignore")
        raise RuntimeError(f"HTTP {e.code}: {body[:300]}")

    except urllib.error.URLError as e:
        raise RuntimeError(f"Network error: {e}")


def resolve_matchday():
    cfg = api("/leagues/10/config", auth=False)

    data = cfg.get("data", {}) if isinstance(cfg, dict) else {}

    md = (
        data.get("current_matchday")
        or cfg.get("current_matchday")
        or data.get("matchday")
        or cfg.get("matchday")
    )

    if not md or not md.get("id"):
        raise RuntimeError("Could not determine current matchday")

    return {
        "id": int(md["id"]),
        "number": int(md.get("number") or 0),
        "previous": data.get("previous_matchday"),
        "current_slot": data.get("current_round") or {},
    }


def player_name(p):
    first = str(p.get("first_name") or "").strip()
    last = str(p.get("last_name") or "").strip()

    name = f"{first} {last}".strip()

    return (
        name
        or str(p.get("name") or "").strip()
        or str(p.get("label") or "").strip()
    )


def position_code(p):
    pos = p.get("position")

    if isinstance(pos, dict):
        pos = pos.get("name", "")

    s = str(pos or "").lower()

    if "guard" in s or s == "g":
        return "G"

    if "forward" in s or s == "f":
        return "F"

    if "center" in s or "centre" in s or s == "c":
        return "C"

    return s[:1].upper() if s else ""


def player_status(p):
    prob = p.get("probability_of_playing")

    try:
        prob = float(prob)
    except (TypeError, ValueError):
        prob = None

    injured = p.get("is_injured") is True

    if injured and (prob is None or prob <= 0.05):
        return "out"

    if prob is not None and prob < 0.75:
        return "out" if prob <= 0.05 else "questionable"

    if injured:
        return "questionable"

    return "active"


def extract_rows(data):
    if isinstance(data, list):
        return data

    if not isinstance(data, dict):
        return []

    for key in ("data", "players", "items", "results"):
        value = data.get(key)
        if isinstance(value, list):
            return value

    return []


def discover_player_list_ids():
    ids = []

    def add(value):
        try:
            value = int(value)
        except (TypeError, ValueError):
            return

        if value > 0 and value not in ids:
            ids.append(value)

    def walk(obj, context=""):
        if isinstance(obj, list):
            for item in obj:
                walk(item, context)
            return

        if not isinstance(obj, dict):
            return

        for key, value in obj.items():
            new_context = f"{context} {key}".lower()

            if isinstance(value, int):
                if re.search(r"players.?list|schedule|competition", new_context):
                    add(value)

            if isinstance(value, dict):
                if re.search(
                    r"players.?list|schedule|competition",
                    key.lower()
                ):
                    add(value.get("id"))

                walk(value, new_context)

            elif isinstance(value, list):
                walk(value, new_context)

    try:
        walk(api("/games/7/config"), "games config")
    except Exception as e:
        print("games config warning:", e)

    try:
        walk(api("/leagues/10/config", auth=False), "league config")
    except Exception as e:
        print("league config warning:", e)

    for value in [31, 32, 30, 33, 29, 34, 35, 28, 36, 27, 37, 10]:
        add(value)

    return ids


def matchday_players(list_id, matchday_id):
    path = (
        f"/players-lists/{list_id}/matchdays/{matchday_id}/players"
        "?per_page=-1&page=1&sort_by=quotation&sort_order=desc"
    )
    return extract_rows(api(path))


def fetch_players(matchday):
    attempts = []

    for list_id in discover_player_list_ids():
        try:
            rows = matchday_players(list_id, matchday["id"])

            attempts.append(f"{list_id}:{len(rows)}")

            if rows:
                print(f"Using players-list {list_id}: {len(rows)} players")
                return rows, list_id

        except Exception as e:
            attempts.append(f"{list_id}:ERR")
            print(f"players-list {list_id} failed:", e)

    raise RuntimeError(
        "No player list found. Attempts: " + ", ".join(attempts)
    )


def sync_popularity(matchday, list_id, players, captured_at):
    previous = matchday.get("previous") or {}
    previous_number = previous.get("number")
    if list_id != POPULARITY_LIST_ID:
        return previous_number, {}

    path = DATA_DIR / "popularity-snapshots.json"
    archive = {"season": POPULARITY_SEASON, "rounds": {}}
    if path.exists():
        archive = json.loads(path.read_text(encoding="utf-8"))
    rounds = archive["rounds"]
    slot = matchday["current_slot"]
    try:
        starts_at = datetime.fromisoformat(slot.get("started_at") or "")
    except ValueError:
        starts_at = None

    # The API repeats the live popularity field on historical matchday requests.
    # Capture it against the current matchday before the first slot starts.
    if slot.get("number") == 1 and starts_at and starts_at.tzinfo and captured_at < starts_at:
        snapshot = {}
        for raw in players:
            fraction = raw.get("popularity")
            player_id = raw.get("id")
            if player_id is None or type(fraction) not in (int, float) or not 0 <= fraction <= 1:
                continue
            player = normalise_player(raw)
            if player["name"] and player["pos"] in POPULARITY_POSITIONS:
                snapshot[player_id] = {
                    "id": player_id, "name": player["name"], "team": player["team"],
                    "pos": player["pos"], "percent": round(fraction * 100, 4),
                }

        if any(player["percent"] > 0 for player in snapshot.values()):
            key = str(matchday["number"])
            existing = rounds.get(key, {})
            if captured_at.isoformat() > existing.get("captured_at", ""):
                rounds[key] = {
                    "captured_at": captured_at.isoformat(),
                    "players": sorted(snapshot.values(), key=lambda player: str(player["id"])),
                }
                save_json(path, archive)
                print(f"Saved popularity snapshot for round {key}: {len(snapshot)} players")

    previous_players = rounds.get(str(previous_number), {}).get("players", [])
    return previous_number, {p["id"]: p["percent"] for p in previous_players}


def normalise_player(p):
    team = p.get("team") or {}
    opponent = p.get("opponent") or {}

    if isinstance(team, dict):
        team_name = team.get("name") or team.get("abbreviation") or ""
        team_position = team.get("position")
    else:
        team_name = str(team)
        team_position = None

    if isinstance(opponent, dict):
        opponent_name = (
            opponent.get("name")
            or opponent.get("abbreviation")
            or ""
        )
    else:
        opponent_name = str(opponent)

    try:
        price = float(
            p.get("quotation")
            if p.get("quotation") is not None
            else p.get("price", 0)
        )
    except (TypeError, ValueError):
        price = 0

    if team_position == "home":
        home = 1
    elif team_position == "away":
        home = 0
    else:
        home = 0

    jersey = str(p.get("jersey") if p.get("jersey") is not None else "")
    return {
        "name": player_name(p),
        "team": team_name,
        "pos": position_code(p),
        "price": price,
        "opponent": opponent_name,
        "home": home,
        "status": player_status(p),
        "fantasy_id": p.get("id"),
        "jerseyNumber": jersey if re.fullmatch(r"[0-9]{1,2}", jersey) else None,
        "probability_of_playing": p.get("probability_of_playing"),
        "data_updated": datetime.now(timezone.utc).isoformat(),
        "fantasy_source": "Fantaking API",
    }


def save_json(path, value):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(
            value,
            f,
            ensure_ascii=False,
            indent=2,
        )


def main():
    print("EuroFantasy automatic sync started")

    if not TOKEN:
        raise RuntimeError(
            "FANTASY_TOKEN secret has not been configured"
        )

    matchday = resolve_matchday()

    print(
        "Current matchday:",
        matchday["number"],
        "ID:",
        matchday["id"],
    )

    raw_players, list_id = fetch_players(matchday)
    popularity_round, popularity = sync_popularity(
        matchday, list_id, raw_players, datetime.now(timezone.utc),
    )

    players = []

    for raw in raw_players:
        player = normalise_player(raw)

        if player["name"]:
            player["popularity_round"] = popularity_round
            player["previous_round_popularity"] = popularity.get(player["fantasy_id"])
            players.append(player)

    if not players:
        raise RuntimeError("Player list was empty after processing")

    players.sort(
        key=lambda p: p.get("price", 0),
        reverse=True
    )

    now = datetime.now(timezone.utc).isoformat()

    save_json(
        DATA_DIR / "players.json",
        players,
    )

    save_json(
        DATA_DIR / "meta.json",
        {
            "updated_at": now,
            "matchday_id": matchday["id"],
            "matchday_number": matchday["number"],
            "players_list_id": list_id,
            "player_count": len(players),
            "source": "Fantaking API",
        },
    )

    print(f"Saved {len(players)} players")
    print("Sync completed successfully")


if __name__ == "__main__":
    main()

