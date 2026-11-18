"""Restore raw evidence referenced by the published E2026 derived dataset."""
import json
from pathlib import Path
from build_matchup_context import ROOT, api, save

def restore(root=ROOT, fetch=api):
    official=json.loads((root/'data/official-offense.json').read_text())
    if official.get('season')!='E2026':raise ValueError('Wrong evidence season')
    codes={int(g['gameCode']) for p in official.get('players',{}).values() for g in p.get('games',[])}
    restored=[]
    for code in sorted(codes):
        path=root/f'data/backtest/cache/E2026-{code}-stats.json'
        if path.exists():continue
        box=fetch('E2026',f'games/{code}/stats')
        if not isinstance(box,dict) or not all(isinstance(box.get(s),dict) for s in ['local','road']):
            raise ValueError(f'Invalid official box {code}')
        save(path,box);restored.append(code)
    print(json.dumps({'restoredOfficialBoxes':restored}))
    return restored

if __name__=='__main__':restore()
