"""Export completed official EuroLeague games between clubs in the current DNA picker."""
import json
from subprocess import CalledProcessError, check_output
from concurrent.futures import ThreadPoolExecutor

from build_matchup_context import ROOT, load


def download(year):
    season = f'E{year}'
    cached = load(ROOT / f'data/context/{season}-schedule.json')
    if cached:
        return cached
    path = f'/v2/competitions/E/seasons/{season}/games?limit=500'
    for base in ('https://api-live.euroleague.net', 'https://feeds.incrowdsports.com/provider/euroleague-feeds'):
        try:
            payload = json.loads(check_output(['curl', '-fsSL', '--max-time', '20', base + path]))
            if payload['data'] and len(payload['data']) == payload['total']:
                return payload
        except (CalledProcessError, ValueError, KeyError):
            continue
    raise RuntimeError(f'Incomplete official schedule for {season}')


def main():
    latest = 2026
    current = download(latest)
    codes = {g[side]['club']['code'] for g in current['data'] for side in ('local', 'road')
             if not g[side]['club'].get('isVirtual')}
    first = 2000
    seasons = range(first, latest)
    with ThreadPoolExecutor(max_workers=5) as executor:
        schedules = list(executor.map(download, seasons))
    pairs = {}
    for year, payload in zip(seasons, schedules):
        season = f'E{year}'
        seen = set()
        for g in payload['data']:
            if g.get('season', {}).get('code') != season or not g.get('played'):
                continue
            local, road = g['local'], g['road']
            home, away = local['club']['code'], road['club']['code']
            hp, ap = local.get('score'), road.get('score')
            code, date = g['gameCode'], g.get('utcDate')
            if (code in seen or home == away or home not in codes or away not in codes or
                    not isinstance(hp, int) or not isinstance(ap, int) or min(hp, ap) < 0 or hp == ap or not date):
                continue
            seen.add(code)
            pair = '|'.join(sorted((home, away)))
            pairs.setdefault(pair, []).append([year, code, date, home, away, hp, ap, g.get('round')])
    for games in pairs.values():
        games.sort(key=lambda g: (g[2], g[1]), reverse=True)
    out = {'first': first, 'last': latest - 1, 'pairs': pairs}
    (ROOT / 'data/dna-history.json').write_text(json.dumps(out, separators=(',', ':')) + '\n')
    print(f'{sum(map(len, pairs.values()))} games across {len(pairs)} pairs')


if __name__ == '__main__':
    main()
