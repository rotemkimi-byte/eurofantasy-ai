import math
import os
import json
import urllib.request
import urllib.error
from datetime import datetime, timezone
from pathlib import Path

API = "https://fantaking-api.dunkest.com/api/v1"
TOKEN = os.environ.get("FANTASY_TOKEN", "").strip()

DATA_DIR = Path("data")
DATA_DIR.mkdir(exist_ok=True)


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


def player_name(p):
    first = str(p.get("first_name") or "").strip()
    last = str(p.get("last_name") or "").strip()

    return (
        f"{first} {last}".strip()
        or str(p.get("name") or "").strip()
        or str(p.get("label") or "").strip()
    )


def league_matchdays():
    cfg = api("/leagues/10/config", auth=False)

    data = cfg.get("data", {})
    md = (
        data.get("current_matchday")
        or cfg.get("current_matchday")
        or data.get("matchday")
        or cfg.get("matchday")
    )

    if not md or not md.get("id"):
        raise RuntimeError("Could not determine matchday")

    return md, data.get("matchdays", [])


def last_completed_matchday(matchdays, current):
    schedule = json.loads((DATA_DIR / "context/E2026-schedule.json").read_text(encoding="utf-8"))
    rounds = {}
    for game in schedule.get("data", []):
        round_number = game.get("round")
        if not round_number or (game.get("season") or {}).get("code") != "E2026":
            continue
        rounds.setdefault(int(round_number), []).append(game.get("played") is True)
    completed = max((number for number, played in rounds.items() if all(played)), default=0)
    if not 0 < completed <= int(current["number"]):
        return None
    return next((day for day in matchdays if int(day["number"]) == completed and day.get("id")), None)



def available_credits(*sources):
    """Accept only explicit unspent-balance fields, never total team value."""
    for source in sources:
        if not isinstance(source, dict):
            continue
        for key in ("available_credits", "remaining_credits", "credits_remaining", "credits_available", "remaining_budget"):
            value = source.get(key)
            if value is None or isinstance(value, bool) or value == "":
                continue
            try:
                value = float(value)
            except (ValueError, TypeError):
                continue
            if math.isfinite(value) and value >= 0:
                return round(value, 2)
    return None

def fetch_roster(team_id, matchday_id, historical=False):
    errors = []

    for suffix in (("roster",) if historical else ("roster/preview", "roster")):
        try:
            data = api(
                f"/fantasy-teams/{team_id}/matchdays/"
                f"{matchday_id}/{suffix}"
            )

            roster = data.get("data", {})
            players = roster.get("players", [])

            if isinstance(players, list) and players:
                return players, roster

        except Exception as e:
            errors.append(str(e))

    raise RuntimeError(
        "Could not load roster: " + " | ".join(errors)
    )


def save(path, value):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(value, f, ensure_ascii=False, indent=2)


def main():
    if not TOKEN:
        raise RuntimeError("FANTASY_TOKEN is missing")

    md, matchdays = league_matchdays()
    last_played = last_completed_matchday(matchdays, md)
    now = datetime.now(timezone.utc).isoformat()
    try:
        old = json.loads((DATA_DIR / "rosters.json").read_text(encoding="utf-8"))
    except (OSError, ValueError):
        old = {}
    archived = {str(team["team_id"]): team.get("previous") for team in old.get("teams", [])}


    result = api(
        "/user/fantasy-teams?league=10&game_mode=1"
    )

    teams = result.get("data", [])

    if not isinstance(teams, list) or not teams:
        raise RuntimeError("No Fantasy teams found")

    synced = []

    for team in teams:
        team_id = team.get("id")

        if not team_id:
            continue

        try:
            roster, roster_metadata = fetch_roster(team_id, md["id"])

            names = [
                player_name(p)
                for p in roster
                if player_name(p)
            ]

            entry = {
                "team_id": team_id,
                "team_name": team.get("name") or f"Team {team_id}",
                "players": names,
                "player_count": len(names),
                "available_credits": available_credits(roster_metadata, team),
            }
            if last_played:
                previous = archived.get(str(team_id))
                if not previous or previous.get("matchday_id") != last_played["id"]:
                    try:
                        played_roster, _ = fetch_roster(team_id, last_played["id"], historical=True)
                        previous = {
                            "team_id": team_id,
                            "matchday_id": last_played["id"],
                            "matchday_number": last_played["number"],
                            "players": [name for p in played_roster if (name := player_name(p))],
                            "updated_at": now,
                        }
                    except Exception as e:
                        previous = None
                        print(f"Could not sync played roster for team {team_id}: {e}")
                if previous and previous.get("players"):
                    entry["previous"] = previous
            synced.append(entry)

        except Exception as e:
            print(
                f"Could not sync team {team_id}: {e}"
            )

    if not synced:
        raise RuntimeError("No rosters could be synced")

    full = {
        "updated_at": now,
        "matchday_id": md["id"],
        "matchday_number": md["number"],
        "completed_matchday_id": last_played["id"] if last_played else None,
        "team_count": len(synced),
        "teams": synced,
    }

    if (DATA_DIR / "roster.json").exists() and all(old.get(k) == v for k, v in full.items() if k != "updated_at"):
        print("Roster unchanged")
        return
    save(DATA_DIR / "rosters.json", full)

    # כרגע הקבוצה הראשונה משמשת כברירת מחדל.
    primary = synced[0]

    save(
        DATA_DIR / "roster.json",
        {
            "updated_at": now,
            "matchday_id": md["id"],
            "matchday_number": md["number"],
            "completed_matchday_id": full["completed_matchday_id"],
            **primary,
        },
    )

    print(
        f"Roster sync completed: "
        f"{primary['team_name']} - "
        f"{primary['player_count']} players"
    )


if __name__ == "__main__":
    main()

