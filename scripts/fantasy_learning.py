"""Audit frozen forecasts; validate calibration on later games only."""
import argparse, hashlib, json, math, re, statistics, unicodedata, urllib.request
from collections import defaultdict
from datetime import datetime, timezone, timedelta
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'data/learning'
VERSION='learning-v1'

def load(path, default=None):
    try: return json.loads(Path(path).read_text())
    except (FileNotFoundError,json.JSONDecodeError): return default

def save(path,data):
    Path(path).parent.mkdir(parents=True,exist_ok=True)
    Path(path).write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')

def key(s):
    s=''.join(c for c in unicodedata.normalize('NFKD',str(s or '')) if not unicodedata.combining(c))
    return ' '.join(sorted(re.sub('[^a-z0-9]+',' ',s.lower()).split()))

def canon(s):
    n=key(s)
    for needles,name in [(['efes'],'Anadolu Efes'),(['milan','milano','armani'],'Milano'),(['besiktas'],'Besiktas'),(['crvena','red star'],'Crvena Zvezda'),(['dubai'],'Dubai'),(['barcelona'],'Barcelona'),(['bayern'],'Bayern Munich'),(['fenerbahce'],'Fenerbahce'),(['hapoel'],'Hapoel Tel Aviv'),(['baskonia'],'Baskonia'),(['asvel'],'ASVEL'),(['maccabi'],'Maccabi Tel Aviv'),(['olympiacos'],'Olympiacos'),(['panathinaikos'],'Panathinaikos'),(['paris'],'Paris'),(['partizan'],'Partizan'),(['real madrid'],'Real Madrid'),(['valencia'],'Valencia'),(['virtus'],'Virtus Bologna'),(['zalgiris'],'Zalgiris'),(['monaco'],'Monaco')]:
        if any(all(t in n.split() for t in x.split()) for x in needles): return name
    return s

def date(s):
    try:
        d=datetime.fromisoformat(str(s).replace('Z','+00:00'))
        return d if d.tzinfo else None  # never guess local kickoff time
    except ValueError: return None

def num(v):
    try:
        n=float(v)
        return n if math.isfinite(n) else None
    except (ValueError,TypeError): return None

def api(path):
    req=urllib.request.Request('https://api-live.euroleague.net/v2/competitions/E/seasons/E2026/'+path,headers={'User-Agent':'EuroFantasy-Learning/1.0','Accept':'application/json'})
    with urllib.request.urlopen(req,timeout=40) as r: return json.load(r)

def model_id():
    files=['index.html','live.js','roster-live.js','position-matchups.js','matchup-live.js','model-stability.js']
    return hashlib.sha256(b''.join(n.encode()+ (ROOT/n).read_bytes() for n in files if (ROOT/n).exists())).hexdigest()[:20]

def prepare():
    OUT.mkdir(parents=True,exist_ok=True)
    meta=load(ROOT/'data/meta.json',{})
    current=int(meta.get('matchday_number') or 0)
    if current<=0: raise RuntimeError('Current round missing; cannot freeze forecasts')
    schedule=load(OUT/'schedule.json',{})
    for rnd in range(1,current+2):
        old=[g for g in schedule.values() if g['round']==rnd]
        if old and all(g['played'] for g in old): continue
        raw=api(f'games?roundNumber={rnd}&limit=50')
        for g in raw.get('data',[]):
            if g.get('season',{}).get('code')!='E2026' or not date(g.get('utcDate')): continue
            code=int(g['gameCode'])
            schedule[str(code)]={'gameCode':code,'round':rnd,'start':g['utcDate'],'played':g.get('played') is True,'home':canon(g['local']['club']['name']),'away':canon(g['road']['club']['name'])}
    save(OUT/'schedule.json',schedule)
    ident=model_id()
    (ROOT/'learning-model-version.js').write_text('window.__learningModelId='+json.dumps(ident)+';\n')
    return schedule

def actuals(g):
    path=ROOT/f'data/backtest/cache/E2026-{g["gameCode"]}-stats.json'
    box=load(path)
    if box is None:
        box=api(f'games/{g["gameCode"]}/stats'); save(path,box)
    rows={}
    for side in ['local','road']:
        for r in (box.get(side) or {}).get('players',[]):
            p=r.get('player',{});stats=r.get('stats',{})
            pir=num(stats.get('valuation'));seconds=num(stats.get('timePlayed'))
            if pir is None or seconds is None:continue
            rows[key(p.get('person',{}).get('name'))]={'actualPir':pir,'actualMinutes':seconds/60,'fouls':num(stats.get('foulsCommited')),'team':canon(p.get('club',{}).get('name'))}
    return rows

def diagnosis(row):
    m=row['baseMinutes'];pred=row['basePir'];actual_m=row['actualMinutes'];actual=row['actualPir']
    if m>0:
        row['minutesContribution']=(actual_m-m)*pred/m
        row['efficiencyContribution']=actual-actual_m*pred/m
    else:
        row['minutesContribution']=None;row['efficiencyContribution']=None
    if m==0 and actual_m>0: reason='availability'
    elif actual_m==0 and m>0: reason='did-not-play'
    elif m>0 and abs(row['minutesContribution'])>abs(row['efficiencyContribution']): reason='minutes'
    else: reason='efficiency'
    row['reason']=reason
    row['error']=actual-pred
    row['servedError']=actual-row['servedPir']
    return row

def collect(schedule):
    rows=[];warnings=[]
    legacy={}
    for path in sorted((ROOT/'data/backtest').glob('predictions-round-*.json')):
        p=load(path,{})
        if p.get('season')=='E2026':legacy[int(p.get('round',0))]=p
    for g in sorted(schedule.values(),key=lambda x:x['start']):
        if not g['played']:continue
        live=load(OUT/f'snapshots/E2026-{g["gameCode"]}.json')
        snapshot=live or legacy.get(g['round'])
        if not snapshot:continue
        created=date(snapshot.get('created_at'))
        if not created or created>=date(g['start']):
            warnings.append(f'Excluded post-kickoff snapshot: {g["gameCode"]}');continue
        try:actual=actuals(g)
        except Exception as e:warnings.append(f'Game {g["gameCode"]}: {type(e).__name__}');continue
        for p in snapshot.get('predictions',[]):
            if p.get('pos') not in ['G','F','C'] or canon(p.get('team')) not in [g['home'],g['away']]:continue
            opponent=g['away'] if canon(p['team'])==g['home'] else g['home']
            if canon(p.get('opponent'))!=opponent:continue
            a=actual.get(key(p['name']))
            if a is None or a['team']!=canon(p['team']):continue
            pred=num(p.get('basePir',p.get('expectedPir')));minutes=num(p.get('baseMinutes',p.get('expectedMinutes')))
            if pred is None or minutes is None:continue
            row={'name':p['name'],'key':key(p['name']),'team':canon(p['team']),'pos':p['pos'],'opponent':opponent,'gameCode':g['gameCode'],'round':g['round'],'start':g['start'],'basePir':pred,'baseMinutes':minutes,'servedPir':num(p.get('expectedPir')) or 0,'servedMinutes':num(p.get('expectedMinutes')) or 0,'status':p.get('status'),'modelId':snapshot.get('modelId') if live else 'legacy','eligible':bool(live and snapshot.get('schema')==VERSION),'snapshotAt':snapshot['created_at'],**a}
            rows.append(diagnosis(row))
    return rows,warnings

def clip(x,a,b):return max(a,min(b,x))

def fit(rows):
    result={}
    for pos in ['G','F','C']:
        sample=[r for r in rows if r['pos']==pos and r['baseMinutes']>=5 and r['actualMinutes']>0 and r['status']=='active']
        n=len(sample)
        if not n:result[pos]={'n':0,'minutes':0,'efficiencyPir':0};continue
        weight=n/(n+80)
        result[pos]={'n':n,'minutes':clip(statistics.mean(clip(r['actualMinutes']-r['baseMinutes'],-12,12) for r in sample)*weight,-2,2),'efficiencyPir':clip(statistics.mean(clip(r['efficiencyContribution'],-15,15) for r in sample)*weight,-2,2)}
    return result

def adjusted(row,coeff):
    p=row['basePir'];m=row['baseMinutes']
    if row['status']!='active' or m<5:return p,m
    c=coeff.get(row['pos'],{})
    new_m=clip(m+c.get('minutes',0),5,36)
    new_p=clip(p/m*new_m+c.get('efficiencyPir',0),max(0,p-max(1,p*.25)),p+max(1,p*.25))
    return new_p,new_m

def metrics(rows):
    return {'n':len(rows),'mae':statistics.mean(abs(r['error']) for r in rows) if rows else None,'bias':statistics.mean(r['error'] for r in rows) if rows else None,'minutesMae':statistics.mean(abs(r['actualMinutes']-r['baseMinutes']) for r in rows) if rows else None}

def validate(rows):
    games=sorted(set((r['start'],r['gameCode']) for r in rows))
    scored=[];history=[]
    for _,code in games:
        test=[r for r in rows if r['gameCode']==code]
        cutoff=min(date(r['snapshotAt']) for r in test)
        available=[r for r in history if date(r['start'])+timedelta(hours=4)<cutoff]
        if len({r['gameCode'] for r in available})>=6 and len(available)>=60:
            coeff=fit(available)
            for r in test:
                new_p,_=adjusted(r,coeff)
                scored.append({'gameCode':code,'baseError':abs(r['actualPir']-r['basePir']),'candidateError':abs(r['actualPir']-new_p)})
        history+=test
    heldout_games=len({r['gameCode'] for r in scored})
    if not scored:return {'n':0,'games':0,'active':False,'reason':'collecting'}
    before=statistics.mean(r['baseError'] for r in scored);after=statistics.mean(r['candidateError'] for r in scored)
    active=heldout_games>=6 and len(scored)>=60 and after<before*.98
    return {'n':len(scored),'games':heldout_games,'baselineMae':before,'candidateMae':after,'improvementPct':(before-after)/max(before,.001)*100,'active':active,'reason':'validated' if active else 'not-yet-validated'}

def grade():
    schedule=load(OUT/'schedule.json',{})
    rows,warnings=collect(schedule)
    ident=model_id()
    eligible=[r for r in rows if r['eligible'] and r['modelId']==ident]
    validation=validate(eligible)
    coeff=fit(eligible)
    groups={}
    for r in rows:groups.setdefault(r['key'],[]).append(r)
    players={k:{'name':v[-1]['name'],'n':len(v),'metrics':metrics(v),'games':sorted(v,key=lambda r:r['start'],reverse=True)[:5]} for k,v in groups.items()}
    now=datetime.now(timezone.utc).isoformat()
    payload={'schema':VERSION,'season':'E2026','modelId':ident,'updated_at':now,'metrics':metrics(rows),'eligibleMetrics':metrics(eligible),'legacyCount':len(rows)-len(eligible),'validation':validation,'coefficients':coeff,'active':validation['active'],'players':players,'largestMisses':sorted(rows,key=lambda r:abs(r['error']),reverse=True)[:20],'byPosition':{pos:metrics([r for r in rows if r['pos']==pos]) for pos in ['G','F','C']},'warnings':warnings}
    save(OUT/'latest.json',payload)
    print(json.dumps({'diagnosticRows':len(rows),'eligibleRows':len(eligible),'validation':validation}))

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('mode',choices=['prepare','grade']);args=parser.parse_args()
    prepare() if args.mode=='prepare' else grade()
