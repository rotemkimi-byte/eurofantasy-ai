"""Python adapter to the same generated registry consumed by the browser/Node."""
import json,re,unicodedata
from pathlib import Path
from functools import lru_cache
ROOT=Path(__file__).resolve().parents[1]
def normalize(value):
    text=''.join(c for c in unicodedata.normalize('NFD',str(value or '')) if not unicodedata.combining(c)).lower()
    return ' '.join(sorted(re.sub('[^a-z0-9]+',' ',text.replace("'",'').replace('’','')).split()))
def legacy(value):
    text=''.join(c for c in unicodedata.normalize('NFD',str(value or '')) if not unicodedata.combining(c)).lower()
    return ' '.join(sorted(re.sub('[^a-z0-9]+',' ',text).split()))
@lru_cache(maxsize=1)
def registry():
    data=json.loads((ROOT/'data/player-identities.json').read_text())
    if data['season']!='E2026':raise ValueError('Wrong identity season')
    names={};official={};fantasy={}
    for r in data['players']:
        if r['euroleagueId']:official[str(r['euroleagueId']).removeprefix('P').lstrip('0')]=r
        if r['fantasyId']:fantasy[str(r['fantasyId'])]=r
        for name in [r['officialName'],r['displayName'],*r['aliases']]:
            if name:
                rows=names.setdefault(normalize(name),[])
                if r not in rows:rows.append(r)
    return names,official,fantasy

def resolve(value):
    names,official,fantasy=registry();p=value if isinstance(value,dict) else {'name':value}
    eid=p.get('euroleagueId',p.get('playerCode'));fid=p.get('fantasyId',p.get('fantasy_id'))
    a=official.get(str(eid).removeprefix('P').lstrip('0')) if eid is not None else None
    b=fantasy.get(str(fid)) if fid is not None else None
    if eid is not None and fid is not None:return a if a is not None and a is b else None
    if eid is not None:return a
    if fid is not None:return b
    rows=names.get(normalize(p.get('name')),[])
    return rows[0] if len(rows)==1 else None

def key(value):
    r=resolve(value)
    if r:return r['key']
    if isinstance(value,dict):
        for field in ['euroleagueId','playerCode','fantasyId','fantasy_id']:
            if value.get(field) is not None:return 'unresolved:'+str(value[field])
    raw=value.get('name') if isinstance(value,dict) else value
    return ('ambiguous:' if len(registry()[0].get(normalize(raw),[]))>1 else '')+legacy(raw)
