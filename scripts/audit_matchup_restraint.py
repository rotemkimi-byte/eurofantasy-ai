"""Read-only forecast audit: select stronger-signal candidates before held-out rounds.

Run from any directory: python scripts/audit_matchup_restraint.py
Writes the diagnostic report only; never changes forecasts or fitted weights.
"""
import json
import subprocess
from datetime import timedelta
import fantasy_learning as f
from rolling_learning import input_ok


def build():
    schedule = f.load(f.OUT / 'schedule.json', {})
    # Never fetch outcomes over the network or accidentally include unfinished games.
    cached = {k: g for k, g in schedule.items()
              if g['played'] and (f.ROOT / f'data/backtest/cache/E2026-{g["gameCode"]}-stats.json').exists()}
    rows, warnings = f.collect(cached)
    exact = []
    for r in rows:
        snap = f.load(f.OUT / f'input-snapshots/E2026-{r["gameCode"]}.json', {})
        if (snap.get('schema') != 'frozen-replay-input-v1' or snap.get('season') != 'E2026'
                or snap.get('gameCode') != r['gameCode']):
            continue
        saved = next((p for p in snap.get('predictions', [])
                      if f.key(p['name']) == r['key'] and f.canon(p['team']) == r['team']
                      and f.canon(p.get('opponent')) == r['opponent']), None)
        a = saved.get('input') if saved else None
        if not input_ok(a, f.date(snap.get('created_at')), f.date(r['start']), r['gameCode']):
            continue
        if f.canon(a['match'].get('opponent')) != r['opponent']:
            continue
        logs = (a.get('recent') or {}).get('gameLog', []) + [g for p in a['contextData'].get('players', {}).values() if p for g in p.get('logs', [])]
        if any(f.date(g['date']) + timedelta(hours=4) >= f.date(a['asOf']) for g in logs):
            continue
        # Fixed historical experiment. New rounds require a separately specified protocol.
        if 5 <= r['round'] <= 8:
            exact.append({**r, 'input': a})
    if not exact:
        raise RuntimeError('No verified frozen pregame inputs; cannot run the audit')
    result = subprocess.run(['node', str(f.ROOT / 'scripts/audit_matchup_restraint.cjs')],
                            cwd=f.ROOT, input=json.dumps(exact), text=True, capture_output=True, check=True)
    report = json.loads(result.stdout)
    report['snapshotWarnings'] = warnings
    report['historicalServedAudit'] = {
        'n': len(rows), 'games': len({r['gameCode'] for r in rows}),
        'note': 'Frozen served predictions across older model versions. Diagnostic only; incomplete inputs excluded from candidate selection.',
        'largestMisses': [{k: r[k] for k in ['name', 'opponent', 'round', 'gameCode', 'servedPir', 'actualPir', 'servedError', 'servedMinutes', 'actualMinutes', 'modelId']}
                          for r in sorted(rows, key=lambda r: abs(r['servedError']), reverse=True)[:20]]}

    f.save(f.OUT / 'matchup-restraint-audit.json', report)
    print(json.dumps({k: report[k] for k in ['totalExact', 'coverage', 'selected', 'holdout', 'activate', 'largestMissesSummary']}, indent=2))


if __name__ == '__main__':
    build()
