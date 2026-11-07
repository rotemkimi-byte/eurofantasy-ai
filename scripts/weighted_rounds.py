"""Join frozen weighted inputs to completed EuroLeague box scores."""
from collections import defaultdict
from fantasy_learning import OUT, ROOT, actuals, canon, date, key, load, num
import json

SCHEMA = 'weighted-rounds-v1'
SIGNALS = 22


def game_rows(game, snapshot, observed):
    if not snapshot or snapshot.get('season') != 'E2026' or snapshot.get('algorithmSchema') != 2:
        return []
    saved = date(snapshot.get('created_at'))
    kickoff = date(game['start'])
    if not saved or not kickoff or saved >= kickoff or snapshot.get('gameCode') != game['gameCode']:
        return []
    result = []
    for p in snapshot.get('predictions', []):
        actual = observed.get(key(p.get('name')))
        club = canon(p.get('team'))
        if actual is None or club != actual['team'] or club not in (game['home'], game['away']):
            continue
        if canon(p.get('opponent')) != (game['away'] if club == game['home'] else game['home']):
            continue
        frozen = p.get('weightedForecast')
        if not isinstance(frozen, dict):
            continue
        pir, base, scale = [num(v) for v in (actual['actualPir'], frozen.get('base'), frozen.get('scale'))]
        signals = frozen.get('signals')
        if None in (pir, base, scale) or not 0 <= scale <= 5 or not isinstance(signals, list) or len(signals) != SIGNALS:
            continue
        if any(v is not None and (num(v) is None or abs(num(v)) > 1) for v in signals):
            continue
        result.append([pir, base, scale, signals])
    return result


def build(schedule):
    grouped = defaultdict(list)
    for game in schedule.values():
        grouped[game['round']].append(game)
    rounds = []
    for number, games in sorted(grouped.items(), reverse=True):
        complete = all(g['played'] for g in games)
        entries = []
        if complete:
            for game in sorted(games, key=lambda g: g['start']):
                code = game['gameCode']
                snapshot = load(OUT / f'snapshots/E2026-{code}.json')
                if not snapshot or snapshot.get('algorithmSchema') != 2:
                    continue
                # The normal grading step has already refreshed these box scores.
                if not (ROOT / f'data/backtest/cache/E2026-{code}-stats.json').exists():
                    continue
                try:
                    rows = game_rows(game, snapshot, actuals(game))
                except (OSError, ValueError, TypeError, AttributeError):
                    continue
                if rows:
                    entries.append({'gameCode': code, 'savedAt': snapshot['created_at'], 'weights': snapshot.get('weightedDefaults'), 'players': rows})
        if entries or not complete:
            rounds.append({'round': number, 'scheduled': len(games), 'complete': complete, 'games': entries})
    return {'schema': SCHEMA, 'season': 'E2026', 'rounds': rounds}


def write_report(schedule):
    target = OUT / 'tool-impacts.json'
    report = build(schedule)
    target.write_text(json.dumps(report, ensure_ascii=False, separators=(',', ':')) + '\n')
    print('Weighted round reports:', [(r['round'], len(r['games'])) for r in report['rounds']])


if __name__ == '__main__':
    write_report(load(OUT / 'schedule.json', {}))
