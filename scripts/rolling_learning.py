"""Current-core historical replay. Partial reconstructions never activate corrections."""
import hashlib,json,math,statistics,subprocess
from pathlib import Path
from datetime import datetime,timezone,timedelta
import fantasy_learning as learning
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'data/learning'

def engine_id():
    names=['personal-model-core.js','matchup-context-core.js','personal-model.js','scripts/fantasy_learning.py','scripts/replay-engine.cjs','rolling-learning.js']
    return hashlib.sha256(b''.join(n.encode()+(ROOT/n).read_bytes() for n in names)).hexdigest()[:20]

def quantile(values,p=.8):
    values=sorted(values)
    return values[min(len(values)-1,max(0,math.ceil((len(values)+1)*p)-1))] if values else None

def validate(rows):
    rows=[r for r in rows if r.get('status')=='active' and r.get('baseMinutes',0)>=5]
    history=[];scored=[];folds=[]
    for start,code in sorted({(r['start'],r['gameCode']) for r in rows}):
        test=[r for r in rows if r['gameCode']==code]
        cutoff=min(learning.date(r['snapshotAt']) for r in test)
        available=[r for r in history if learning.date(r['start'])+timedelta(hours=4)<cutoff]
        if len(available)>=60 and len({r['gameCode'] for r in available})>=6:
            coeff=learning.fit(available)
            residuals=[abs(r['actualPir']-learning.adjusted(r,coeff)[0]) for r in available]
            radius=quantile(residuals)
            base_radius=quantile([abs(r['error']) for r in available])
            fold=[]
            for r in test:
                pred,minutes=learning.adjusted(r,coeff)
                z={'gameCode':code,'baseError':abs(r['error']),'candidateError':abs(r['actualPir']-pred),'covered':abs(r['actualPir']-pred)<=radius,'baseCovered':abs(r['error'])<=base_radius,'radius':radius,'width':radius*2,'minutesError':abs(r['actualMinutes']-minutes)}
                fold.append(z);scored.append(z)
            folds.append({'gameCode':code,'round':test[0]['round'],'trainingN':len(available),'trainingGames':len({r['gameCode'] for r in available}),'testN':len(test),'baselineMae':statistics.mean(r['baseError'] for r in fold),'candidateMae':statistics.mean(r['candidateError'] for r in fold)})
        history+=test
    n=len(scored);games=len({r['gameCode'] for r in scored})
    before=statistics.mean(r['baseError'] for r in scored) if n else None
    after=statistics.mean(r['candidateError'] for r in scored) if n else None
    coverage=statistics.mean(r['covered'] for r in scored) if n else None
    active=n>=60 and games>=6 and after<before*.98
    # Require improvement in the latest held-out half as well, to avoid stale pooled wins.
    tail=folds[len(folds)//2:]
    recent_ok=bool(tail) and sum(f['candidateMae']*f['testN'] for f in tail)<sum(f['baselineMae']*f['testN'] for f in tail)
    active=active and recent_ok
    return {'n':n,'games':games,'baselineMae':before,'candidateMae':after,'active':active,'reason':'validated' if active else 'collecting-or-no-improvement','folds':folds,'intervalCoverage':coverage if active else statistics.mean(r['baseCovered'] for r in scored) if n else None}

def input_ok(a,created,kickoff,code):
    if not isinstance(a,dict) or not a.get('complete') or not learning.date(a.get('asOf')):return False
    if not created or not kickoff or not learning.date(a['asOf'])<=created<kickoff:return False
    for field in ['player','context','match','contextData']:
        if not isinstance(a.get(field),dict):return False
    p=a['player']
    if p.get('pos') not in ['G','F','C'] or not p.get('name') or not p.get('team') or learning.num(p.get('price')) is None:return False
    d=a['contextData'];stamp=learning.date(d.get('updated_at'))
    if d.get('schema')!='matchup-context-v1' or d.get('season')!='E2026' or not stamp or stamp>learning.date(a['asOf']):return False
    logs=(a.get('recent') or {}).get('gameLog',[])
    for p in d.get('players',{}).values():
        if p:logs=logs+p.get('logs',[])
    for log in logs:
        when=learning.date(log.get('date'))
        if log.get('gameCode')==code or not when or when>=learning.date(a['asOf']):return False
    return True

def build():
    schedule=learning.load(OUT/'schedule.json',{})
    rows,_=learning.collect(schedule)
    exact=[];partial=[];missing=0
    prior=learning.load(ROOT/'data/player-history.json',{})
    use_prior=prior.get('schema')=='player-history-v1' and prior.get('season')=='E2025' and prior.get('complete') is True
    for r in rows:
        g=schedule[str(r['gameCode'])]
        snap=learning.load(OUT/f'input-snapshots/E2026-{r["gameCode"]}.json',{})
        saved=next((p for p in snap.get('predictions',[]) if learning.key(p['name'])==r['key']),None)
        created=learning.date(snap.get('created_at'));kickoff=learning.date(r['start'])
        if snap.get('schema')=='frozen-replay-input-v1' and snap.get('season')=='E2026' and snap.get('gameCode')==r['gameCode'] and saved and learning.canon(saved.get('team'))==r['team'] and input_ok(saved.get('input'),created,kickoff,r['gameCode']):
            exact.append({**r,'snapshotAt':snap['created_at'],'status':saved['input']['player'].get('status'),'pos':saved['input']['player'].get('pos'),'input':saved['input'],'replayKind':'exact-frozen-input'});continue
        old=learning.load(OUT/f'snapshots/E2026-{r["gameCode"]}.json')
        if not old:old=learning.load(ROOT/f'data/backtest/predictions-round-{r["round"]}.json',{})
        p=next((p for p in old.get('predictions',[]) if learning.key(p['name'])==r['key']),None)
        if not p or learning.num(p.get('price')) is None:missing+=1;continue
        cutoff=learning.date(r['snapshotAt'])
        previous=[x for x in rows if x['key']==r['key'] and x['team']==r['team'] and learning.date(x['start'])+timedelta(hours=4)<cutoff and x['actualMinutes']>0]
        previous=sorted({x['gameCode']:x for x in previous}.values(),key=lambda x:x['start'])
        minutes=sum(x['actualMinutes'] for x in previous);pir=sum(x['actualPir'] for x in previous)
        recent={'latestSeason':'E2026','currentSeasonGames':len(previous),'season':{'pirPerMinute':pir/minutes if minutes else None,'avgMinutes':minutes/len(previous) if previous else None},'gameLog':[]}
        last=previous[-5:]
        if last:recent['last5']={'games':len(last),'avgPir':statistics.mean(x['actualPir'] for x in last),'avgMinutes':statistics.mean(x['actualMinutes'] for x in last)}
        f=r.get('features') or {}
        context={'injuryBoost':f.get('injuryBoost',0),'injuryUsagePct':f.get('injuryUsagePct',0),'positionPct':f.get('positionMatchPct',0),'teamPct':f.get('teamMatchPct',0),'margin':f.get('margin',0)}
        a={'player':{k:p.get(k) for k in ['name','team','pos','price','status','opponent']},'recent':recent,'history':prior.get('players',{}).get(r['key']) if use_prior else None,'context':context,'config':{},'match':{'opponent':r['opponent'],'margin':f.get('margin',0)},'contextData':None,'asOf':r['snapshotAt'],'complete':False}
        partial.append({**r,'input':a,'replayKind':'partial-reconstruction'})
    candidates=exact+partial
    if candidates:
        process=subprocess.run(['node',str(ROOT/'scripts/replay-engine.cjs')],input=json.dumps(candidates),text=True,capture_output=True,check=True)
        replay=[learning.diagnosis(r) for r in json.loads(process.stdout)]
    else:replay=[]
    exact=[r for r in replay if r['replayKind']=='exact-frozen-input'];partial=[r for r in replay if r['replayKind']=='partial-reconstruction']
    validation=validate(exact);coeff=learning.fit(exact)
    residuals=[abs(r['actualPir']-(learning.adjusted(r,coeff)[0] if validation['active'] else r['basePir'])) for r in exact if r['status']=='active' and r['baseMinutes']>=5]
    interval={'active':validation['n']>=60 and validation['games']>=6 and validation['intervalCoverage'] is not None and .75<=validation['intervalCoverage']<=.9,'targetCoverage':.8,'coverage':validation['intervalCoverage'],'n':validation['n'],'radius':quantile(residuals)}
    report={'schema':'rolling-learning-v1','season':'E2026','engineId':engine_id(),'updated_at':datetime.now(timezone.utc).isoformat(),'exactCount':len(exact),'diagnostic':learning.metrics(partial),'missingInputs':missing,'validation':validation,'coefficients':coeff,'interval':interval,'limitations':['Partial historical reconstructions exclude unrecoverable pregame defensive context and momentum configuration; never activate live corrections.','Exact replay tests the current shared player projection with frozen pregame matchup inputs; it does not backtest a changed team-matchup generator.']}
    report['rounds']=[{'round':rnd,'kind':kind,**learning.metrics([r for r in replay if r['round']==rnd and r['replayKind']==kind])} for rnd in sorted({r['round'] for r in replay}) for kind in ['exact-frozen-input','partial-reconstruction']]
    report['largestMisses']=[{k:v for k,v in r.items() if k!='input'} for r in sorted(replay,key=lambda r:abs(r['error']),reverse=True)[:10]]
    learning.save(OUT/'rolling.json',report)
    (ROOT/'rolling-model-version.js').write_text('window.__rollingModelId='+json.dumps(report['engineId'])+';\n')
    print(json.dumps({'partial':len(partial),'exact':len(exact),'missing':missing,'validation':validation,'interval':interval}))
if __name__=='__main__':build()
