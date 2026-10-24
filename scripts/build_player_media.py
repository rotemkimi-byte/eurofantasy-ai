"""Extract identity-matched media URLs from cached official current-season boxes."""
import json
from pathlib import Path
from urllib.parse import urlparse
from build_matchup_context import ROOT, key, save

def safe(url):
    p=urlparse(url or '')
    return url if p.scheme=='https' and p.hostname in {'media-cdn.cortextech.io','media-cdn.incrowdsports.com','media-cdn.euroleague.net'} else None

def build(root=ROOT):
    players={}
    for path in sorted((root/'data/backtest/cache').glob('E2026-*-stats.json'),key=lambda p:int(p.name.split('-')[1])):
        box=json.loads(path.read_text())
        for side in ('local','road'):
            for row in (box.get(side) or {}).get('players',[]):
                p=row.get('player') or {};person=p.get('person') or {};name=person.get('name')
                if not name:continue
                images=p.get('images') or {};club=p.get('club') or {}
                players[key(name)]={'name':name,'playerCode':person.get('code'),
                    'photo':safe(images.get('headshot')) or safe(images.get('action')),
                    'club':club.get('name'),'crest':safe((club.get('images') or {}).get('crest')),
                    'source':'https://api-live.euroleague.net/v2/competitions/E/seasons/E2026/games/'+path.name.split('-')[1]+'/stats'}
    if not players:raise RuntimeError('No current-season media; preserve previous file')
    save(root/'data/player-media.json',{'season':'E2026','players':players})
    print(f'Official player media: {len(players)} identities, {sum(bool(p["photo"]) for p in players.values())} photos')
    return players

if __name__=='__main__':build()
