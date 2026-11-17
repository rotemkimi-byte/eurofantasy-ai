"""Separate identity audit. Original forecasts and learning snapshots stay immutable.
Counterfactual replay repairs only archived pregame inputs, never today's stats.
"""
import copy,hashlib,json,subprocess,statistics
from pathlib import Path
from datetime import timedelta
import fantasy_learning as L
from rolling_learning import input_ok
ROOT=L.ROOT

def git_json(ref,file):
    try:return json.loads(subprocess.check_output(['git','show',ref+':'+file],cwd=ROOT,stderr=subprocess.DEVNULL))
    except (subprocess.CalledProcessError,ValueError):return None

def run():
    files=list((ROOT/'data/learning/snapshots').rglob('*.json'))+list((ROOT/'data/learning/input-snapshots').rglob('*.json'))+list((ROOT/'data/backtest').glob('*.json'))
    hashes={str(p.relative_to(ROOT)):hashlib.sha256(p.read_bytes()).hexdigest() for p in files}
    schedule=L.load(ROOT/'data/learning/schedule.json',{})
    fixed,warnings=L.collect(schedule);key=L.key
    # Reproduce the former matcher without changing any archived values.
    import re,unicodedata
    def legacy(s):
        if isinstance(s,dict):s=s.get('name')
        return ' '.join(sorted(re.sub('[^a-z0-9]+',' ',''.join(c for c in unicodedata.normalize('NFKD',str(s or '')) if not unicodedata.combining(c)).lower()).split()))
    L.key=legacy
    try:before,_=L.collect(schedule)
    finally:L.key=key
    old={(r['gameCode'],r['name']):r for r in before};added=[r for r in fixed if (r['gameCode'],r['name']) not in old]
    candidates=[];skipped=[];archived={}
    for path in sorted((ROOT/'data/learning/input-snapshots').glob('E2026-*.json')):
        snapshot=L.load(path,{});code=snapshot.get('gameCode');g=schedule.get(str(code),{});kickoff=L.date(g.get('start'));created=L.date(snapshot.get('created_at'))
        if not g.get('played'):continue
        for p in snapshot.get('predictions',[]):
            a=p.get('input');name=p.get('name')
            if not input_ok(a,created,kickoff,code):skipped.append({'gameCode':code,'name':name,'reason':'no-complete-verified-pregame-input'});continue
            if (a.get('recent') or {}).get('currentSeasonGames',0)>0:continue
            cutoff=a['asOf']
            if cutoff not in archived:
                sha=subprocess.check_output(['git','log','-1','--format=%H','--before='+cutoff],cwd=ROOT,text=True).strip()
                archived[cutoff]=(sha,git_json(sha,'data/official-offense.json')) if sha else (None,None)
            sha,d=archived[cutoff]
            if not d or d.get('season')!='E2026' or not L.date(d.get('updated_at')) or L.date(d['updated_at'])>L.date(cutoff):
                skipped.append({'gameCode':code,'name':name,'reason':'no-published-pregame-official-archive'});continue
            matches=[q for k,q in d.get('players',{}).items() if key({'name':q.get('name',k),'playerCode':q.get('playerCode')})==key(a['player'])]
            if len(matches)!=1:continue
            games=[q for q in matches[0].get('games',[]) if q.get('minutes',0)>0 and L.num((q.get('stats') or {}).get('valuation')) is not None and L.date(q['date'])+timedelta(hours=4)<L.date(cutoff) and str(q['gameCode'])!=str(code)]
            if not games:continue
            corrected=copy.deepcopy(a)
            # Send the archived profile to the common JS recent-form builder.
            corrected['identityRepairProfile']={**matches[0],'games':games}
            actual=next((r for r in fixed if r['gameCode']==code and r['name']==name),None)
            if actual:candidates.append({'name':name,'gameCode':code,'input':corrected,'originalInput':a,'actualPir':actual['actualPir'],'actualMinutes':actual['actualMinutes'],'archiveCommit':sha,'archivePublishedAt':d['updated_at']})
    process=subprocess.run(['node',str(ROOT/'scripts/replay_identity_audit.cjs')],input=json.dumps(candidates),text=True,capture_output=True,check=True)
    replay=json.loads(process.stdout)
    def metrics(rows,pir='basePir',minutes='baseMinutes'):
        return {'n':len(rows),'pirMae':statistics.mean(abs(r['actualPir']-r[pir]) for r in rows) if rows else None,'minutesMae':statistics.mean(abs(r['actualMinutes']-r[minutes]) for r in rows) if rows else None}
    result={'schema':'identity-learning-audit-v1','season':'E2026','originalGrading':metrics(before),'correctedGrading':metrics(fixed),'newlyMatchedObservations':len(added),'affectedPlayers':sorted({r['name'] for r in added}),'sameSampleReplayBefore':metrics(replay,'originalPir','originalMinutes'),'sameSampleReplayAfter':metrics(replay,'correctedPir','correctedMinutes'),'replayRows':replay,'skipped':skipped,'warnings':warnings,'originalFileHashes':hashes,'originalsUnchanged':all(hashlib.sha256((ROOT/f).read_bytes()).hexdigest()==h for f,h in hashes.items()),'limitations':['Grading coverage changes are not a like-for-like accuracy improvement.','Counterfactual replay compares the same personal/context core with archived pregame form; it is not a complete reconstruction of historical weighted website forecasts.','Historical coefficients and tool weights are preserved. Identity code and registry participate in model fingerprints; old calibration is not eligible for the new identity engine.']}
    if not result['originalsUnchanged']:raise RuntimeError('Original archive changed')
    L.save(ROOT/'data/integrity/learning-identity-audit.json',result)
    print(json.dumps({k:v for k,v in result.items() if k in ['originalGrading','correctedGrading','newlyMatchedObservations','sameSampleReplayBefore','sameSampleReplayAfter','originalsUnchanged','affectedPlayers']}))
if __name__=='__main__':run()
