"""Build separate, official E2025 priors; never mix them into E2026 results."""
import argparse
import concurrent.futures
import json
import gzip
import math
import statistics
import time
import urllib.request
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from fantasy_learning import ROOT, canon, key

MIRROR = 'https://feeds.incrowdsports.com/provider/euroleague-feeds/v2/competitions/E/seasons/E2025/'

def fetch(path):
    for attempt in range(3):
        try:
            req = urllib.request.Request(MIRROR + path, headers={'Accept': 'application/json', 'User-Agent': 'EuroFantasy/2.0'})
            with urllib.request.urlopen(req, timeout=30) as response:
                return json.load(response)
        except Exception:
            if attempt == 2:
                raise
            time.sleep(2 * (attempt + 1))

def summary(games):
    minutes = sum(g['minutes'] for g in games)
    return {'games': len(games), 'avgPir': statistics.mean(g['pir'] for g in games),
            'avgMinutes': minutes / len(games), 'pirPerMinute': sum(g['pir'] for g in games) / minutes,
            'sdPir': statistics.pstdev(g['pir'] for g in games)}

def streaks(games, threshold):
    opportunities = []
    longest = run = 0
    for i, game in enumerate(games):
        run = run + 1 if game['pir'] >= threshold else 0
        longest = max(longest, run)
        if i >= 2 and games[i-1]['pir'] >= threshold and games[i-2]['pir'] >= threshold:
            opportunities.append(game['pir'])
    return {'threshold': threshold, 'longestRun': longest, 'nextGameSamples': len(opportunities),
            'nextGameAvgPir': statistics.mean(opportunities) if opportunities else None,
            'continuedRate': sum(p >= threshold for p in opportunities) / len(opportunities) if opportunities else None}

def build(cache, schedule_file=None):
    raw = json.loads(Path(schedule_file).read_text()) if schedule_file else fetch('games?limit=500')
    schedule = [g for g in raw['data'] if g.get('season', {}).get('code') == 'E2025'
                and g.get('status') == 'result' and g.get('date', '') < '2026-07-01']
    cache.mkdir(parents=True, exist_ok=True)

    def get_game(game):
        code = int(game.get('gameCode') or game['code'])
        path = cache / f'E2025-{code}.json'
        if path.exists():
            box = json.loads(path.read_text())
        else:
            box = fetch(f'games/{code}/stats')
            path.write_text(json.dumps(box))
        rows = []
        for side in ('local', 'road'):
            for row in box.get(side, {}).get('players', []):
                p, s = row.get('player', {}), row.get('stats', {})
                if p.get('season', {}).get('code') != 'E2025':
                    continue
                try:
                    minutes, pir = float(s['timePlayed']) / 60, float(s['valuation'])
                except (KeyError, TypeError, ValueError):
                    continue
                if minutes <= 0 or not math.isfinite(minutes) or not math.isfinite(pir):
                    continue
                rows.append({'key': key(p.get('person', {}).get('name')), 'name': p.get('person', {}).get('name'),
                             'playerCode': p.get('person', {}).get('code'), 'team': canon(p.get('club', {}).get('name')),
                             'pos': str(p.get('positionName', ''))[:1].upper(), 'gameCode': code,
                             'date': game['date'], 'pir': pir, 'minutes': round(minutes, 4)})
        return rows

    players = defaultdict(list)
    # Any failed box score aborts the build; never replace a complete prior with partial history.
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        for i, rows in enumerate(pool.map(get_game, schedule)):
            for row in rows:
                players[row['key']].append(row)
            if i % 40 == 0:
                print(f'Historical games: {i+1}/{len(schedule)}', flush=True)
    profiles = {}
    for player_key, games in players.items():
        games.sort(key=lambda g: (g['date'], g['gameCode']))
        profiles[player_key] = {**summary(games), 'name': games[-1]['name'], 'playerCode': games[-1]['playerCode'],
                                'team': games[-1]['team'], 'pos': games[-1]['pos'],
                                'streaks': [streaks(games, t) for t in (20, 25, 30)], 'gameLog': games}
    payload = {'schema': 'player-history-v1', 'season': 'E2025', 'currentSeason': 'E2026',
               'source': MIRROR, 'sourceMetric': 'stats.valuation (PIR), not EFF or fantasy bonus',
               'complete': True, 'playedGames': len(schedule), 'players': profiles}
    path = ROOT / 'data/player-history.json'
    (ROOT / 'data/player-history-games.json.gz').write_bytes(gzip.compress(
        json.dumps(payload, ensure_ascii=False, separators=(',', ':')).encode(), mtime=0))
    # Keep the live download small; replay logs remain in a separate compressed file.
    payload['players'] = {k: {field: value for field, value in profile.items() if field != 'gameLog'}
                          for k, profile in profiles.items()}
    path.write_text(json.dumps(payload, ensure_ascii=False, separators=(',', ':')) + '\n')
    print(f'Built {len(profiles)} personal profiles from {len(schedule)} games')

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--cache', type=Path, default=ROOT / 'data/history-cache')
    parser.add_argument('--schedule')
    args = parser.parse_args()
    build(args.cache, args.schedule)
