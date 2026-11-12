"""Compare a shadow model with versioned, genuinely pregame site forecasts."""
import argparse
import hashlib
import json
import subprocess
import tempfile
from functools import lru_cache
from pathlib import Path

from fantasy_learning import ROOT, OUT, actuals, canon, date, key, load, num, save
from rolling_learning import input_ok

SOURCES = ('unified-forecast-core.js', 'weighted-forecast-core.js', 'personal-model-core.js',
           'personal-model.js', 'model-stability.js', 'matchup-context-core.js',
           'advanced-player-core.js', 'weighted-forecast.js', 'scripts/snapshot_live_model.py',
           'matchup-context.js', 'learning.js', 'rolling-learning.js', 'scripts/unified-replay.cjs',
           'scripts/score-unified.cjs', 'scripts/unified_learning.py')


def engine_id():
    return hashlib.sha256(b''.join(name.encode() + (ROOT / name).read_bytes() for name in SOURCES)).hexdigest()[:20]


def run(*args, **kwargs):
    return subprocess.run(args, cwd=ROOT, check=True, capture_output=True, **kwargs).stdout


@lru_cache(maxsize=None)
def revisions(path):
    lines = run('git', 'log', '--first-parent', '--format=%H %cI', '--', path, text=True).splitlines()
    return [(sha, date(stamp)) for sha, stamp in (line.split() for line in lines)]


def archived(path, cutoff, target):
    """Select a Git publication available at cutoff and reject future payload timestamps."""
    for sha, published in revisions(path):
        if published > cutoff:
            continue
        output = target / f'{sha}-{Path(path).name}'
        if not output.exists():
            output.write_bytes(run('git', 'show', f'{sha}:{path}'))
        data = load(output)
        stamp = date(data.get('updated_at')) if isinstance(data, dict) else None
        if stamp and stamp > cutoff:
            continue
        return output
    return None


def matching(snapshot, game, player):
    club = canon(player.get('team'))
    return (snapshot.get('season') == 'E2026' and snapshot.get('gameCode') == game['gameCode']
            and club in (game['home'], game['away'])
            and canon(player.get('opponent')) == (game['away'] if club == game['home'] else game['home']))


def known_results(path, cutoff, allowed=None):
    result = {}
    for profile in load(path, {}).get('players', {}).values():
        for row in profile.get('games', []):
            code = str(row['gameCode'])
            when = date(row.get('date'))
            pir, minutes = num(row.get('stats', {}).get('valuation')), num(row.get('minutes'))
            if when and when < cutoff and pir is not None and minutes is not None and (allowed is None or code in allowed):
                result.setdefault(code, {})[key(profile['name']) + '|' + canon(row['team'])] = [pir, minutes]
    return result


def paired_rows(schedule, target, historical):
    groups = []
    current_engine = engine_id()
    observed = {'archivedReplay': {'rows': [], 'results': {}}, 'prospective': {'rows': [], 'results': {}}}
    for game in schedule.values():
        code = game['gameCode']
        if not game['played'] or not (ROOT / f'data/backtest/cache/E2026-{code}-stats.json').exists():
            continue
        snap = load(OUT / f'snapshots/E2026-{code}.json', {})
        live_cutoff, kickoff = date(snap.get('created_at')), date(game['start'])
        version = snap.get('modelId')
        if not version or not live_cutoff or not kickoff or live_cutoff >= kickoff:
            continue
        by_player = actuals(game)
        frozen = load(OUT / f'input-snapshots/E2026-{code}.json', {}) if historical else {}
        replay_cutoff = date(frozen.get('created_at'))
        if frozen.get('schema') != 'frozen-replay-input-v1':
            replay_cutoff = None
        frozen_by_name = {(key(p['name']), canon(p['team'])): p for p in frozen.get('predictions', [])}
        candidate_rows = []
        for p in snap.get('predictions', []):
            club, name = canon(p.get('team')), key(p.get('name'))
            a = by_player.get(name)
            expected, minutes = num(p.get('expectedPir')), num(p.get('expectedMinutes'))
            if not matching(snap, game, p) or a is None or a['team'] != club or None in (expected, minutes):
                continue
            row = {'gameCode': code, 'round': game['round'], 'start': game['start'], 'team': club, 'name': p['name'],
                   'key': name + '|' + club, 'servedVersion': version, 'servedCutoff': snap['created_at'],
                   'served': {'expected': expected, 'minutes': minutes}, 'actualPir': a['actualPir'],
                   'actualMinutes': a['actualMinutes']}
            saved = frozen_by_name.get((name, club))
            if not replay_cutoff or not saved or not matching(frozen, game, saved):
                continue
            a = saved.get('input')
            if (input_ok(a, replay_cutoff, kickoff, code) and a['match'].get('home') == (club == game['home'])
                    and canon(a['match'].get('opponent')) == canon(p.get('opponent'))
                    and key(a['player'].get('name')) == name and canon(a['player'].get('team')) == club):
                candidate_rows.append({**row, 'frozen': a, 'cutoff': a['asOf']})
        shadow = load(OUT / f'shadow-snapshots/E2026-{code}-{current_engine}.json', {})
        shadow_cutoff = date(shadow.get('created_at'))
        if shadow.get('shadowId') == current_engine and shadow_cutoff and shadow_cutoff < kickoff:
            shadow_rows = []
            for p in shadow.get('predictions', []):
                club, name = canon(p.get('team')), key(p.get('name'))
                a = by_player.get(name)
                expected, minutes = num(p.get('expectedPir')), num(p.get('expectedMinutes'))
                candidate = p.get('shadowInput') or {}
                if (not matching(shadow, game, p) or a is None or a['team'] != club
                        or None in (expected, minutes) or candidate.get('version') != 'unified-pir-v1'
                        or p.get('home') != (club == game['home']) or not shadow.get('modelId')
                        or not isinstance(p.get('shadowProjection'), dict)):
                    continue
                shadow_rows.append({'gameCode': code, 'round': game['round'], 'start': game['start'],
                    'team': club, 'name': p['name'], 'key': name + '|' + club,
                    'servedVersion': shadow['modelId'], 'servedCutoff': shadow['created_at'],
                    'served': {'expected': expected, 'minutes': minutes}, 'actualPir': a['actualPir'],
                    'actualMinutes': a['actualMinutes'], 'input': candidate, 'cutoff': shadow['created_at'],
                    **p['shadowProjection']})
            observed['prospective']['rows'].extend(shadow_rows)
        if candidate_rows:
            # A browser snapshot can span seconds. Select sources available to every player in the capture.
            cutoff = min(date(r['cutoff']) for r in candidate_rows)
            official = archived('data/official-offense.json', cutoff, target)
            if not official:
                continue
            group = {'cutoff': cutoff.isoformat(), 'rows': candidate_rows, 'official': str(official)}
            for field, file in [('advanced', 'advanced-players.json'), ('roster', 'players.json'), ('defense', 'position-matchups.json')]:
                path = archived('data/' + file, cutoff, target)
                group[field] = str(path) if path else None
            groups.append(group)
            observed['archivedReplay']['results'][code] = known_results(official, cutoff)
    if groups:
        output = run('node', 'scripts/unified-replay.cjs', input=json.dumps(groups), text=True)
        observed['archivedReplay']['rows'] = [json.loads(line) for line in output.splitlines()]
    return observed


def freeze_shadow(players, cutoff, completed_codes, schedule):
    with tempfile.TemporaryDirectory() as folder:
        history = paired_rows(schedule, Path(folder), False)['prospective']['rows']
    known = known_results(ROOT / 'data/official-offense.json', cutoff, set(map(str, completed_codes)))
    payload = {'rows': [{'input': p['shadowInput']} for p in players], 'history': history,
               'known': known, 'cutoff': cutoff.isoformat()}
    projections = json.loads(run('node', 'scripts/score-unified.cjs', '--freeze', input=json.dumps(payload), text=True))
    return [{**p, 'shadowProjection': projection} for p, projection in zip(players, projections, strict=True)]


def build(historical=False):
    with tempfile.TemporaryDirectory() as folder:
        evidence = paired_rows(load(OUT / 'schedule.json', {}), Path(folder), historical)
    result = json.loads(run('node', 'scripts/score-unified.cjs', input=json.dumps(evidence), text=True))
    return {'engineId': engine_id(), **result}


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--historical', action='store_true', help='Also replay Git-archived pregame data')
    parser.add_argument('--output', type=Path, default=OUT / 'unified-validation.json')
    args = parser.parse_args()
    report = build(args.historical)
    save(args.output, report)
    for mode in ('archivedReplay', 'prospective'):
        print(mode, {k: report[mode][k] for k in ('inputN', 'inputGames', 'heldOutN')})
