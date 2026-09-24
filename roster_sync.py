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


def current_matchday():
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

    return {
        "id": int(md["id"]),
        "number": int(md.get("number") or 0),
    }


def fetch_roster(team_id, matchday_id):
    errors = []

    for suffix in ("roster/preview", "roster"):
        try:
            data = api(
                f"/fantasy-teams/{team_id}/matchdays/"
                f"{matchday_id}/{suffix}"
            )

            roster = data.get("data", {})
            players = roster.get("players", [])

            if isinstance(players, list) and players:
                return players

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

    md = current_matchday()

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
            roster = fetch_roster(team_id, md["id"])

            names = [
                player_name(p)
                for p in roster
                if player_name(p)
            ]

            synced.append({
                "team_id": team_id,
                "team_name": team.get("name") or f"Team {team_id}",
                "players": names,
                "player_count": len(names),
            })

        except Exception as e:
            print(
                f"Could not sync team {team_id}: {e}"
            )

    if not synced:
        raise RuntimeError("No rosters could be synced")

    now = datetime.now(timezone.utc).isoformat()

    full = {
        "updated_at": now,
        "matchday_id": md["id"],
        "matchday_number": md["number"],
        "team_count": len(synced),
        "teams": synced,
    }

    save(DATA_DIR / "rosters.json", full)

    # כרגע הקבוצה הראשונה משמשת כברירת מחדל.
    primary = synced[0]

    save(
        DATA_DIR / "roster.json",
        {
            "updated_at": now,
            "matchday_id": md["id"],
            "matchday_number": md["number"],
            "team_id": primary["team_id"],
            "team_name": primary["team_name"],
            "players": primary["players"],
            "player_count": primary["player_count"],
        },
    )

    print(
        f"Roster sync completed: "
        f"{primary['team_name']} - "
        f"{primary['player_count']} players"
    )


if __name__ == "__main__":
    main()
