"""Observed context, pregame strength and calibration. No invented historical forecasts."""
import argparse, json, math, statistics, urllib.request, unicodedata, re, hashlib
from pathlib import Path
from datetime import datetime, timezone, timedelta
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor

ROOT = Path(__file__).resolve().parents[1]
VERSION = 'matchup-context-v1'
NOW = datetime.now(timezone.utc)

def load(path, default=None):
    try: return json.loads(Path(path).read_text())
    except (FileNotFoundError, json.JSONDecodeError): return default

def save(path, obj):
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    Path(path).write_text(json.dumps(obj, ensure_ascii=False, indent=2)+'\n')

def number(x):
    try:
        n=float(x)
        return n if math.isfinite(n) else None
    except (ValueError, TypeError): return None

def clip(x,a,b): return max(a,min(b,x))
def key(s):
    s=''.join(c for c in unicodedata.normalize('NFKD',str(s or '')) if not unicodedata.combining(c))
    return ' '.join(sorted(re.sub('[^a-z0-9]+',' ',s.lower()).split()))
def team(s):
    n=key(s)
    for needle,name in [('efes','Anadolu Efes'),('armani','Milano'),('milan','Milano'),('besiktas','Besiktas'),('crvena','Crvena Zvezda'),('dubai','Dubai'),('barcelona','Barcelona'),('bayern','Bayern Munich'),('fenerbahce','Fenerbahce'),('hapoel','Hapoel Tel Aviv'),('baskonia','Baskonia'),('asvel','ASVEL'),('maccabi','Maccabi Tel Aviv'),('olympiacos','Olympiacos'),('panathinaikos','Panathinaikos'),('paris','Paris'),('partizan','Partizan'),('real madrid','Real Madrid'),('valencia','Valencia'),('virtus','Virtus Bologna'),('zalgiris','Zalgiris'),('monaco','Monaco')]:
        if needle in n:return name
    return str(s or '')
def stamp(s):
    try:
        d=datetime.fromisoformat(str(s).replace('Z','+00:00'))
        return d if d.tzinfo else None
    except ValueError:return None

def api(season, path):
    req=urllib.request.Request(f'https://api-live.euroleague.net/v2/competitions/E/seasons/{season}/{path}',headers={'Accept':'application/json','User-Agent':'EuroFantasy-Context/1.0'})
    with urllib.request.urlopen(req,timeout=35) as response:return json.load(response)

def sigmoid(x):return 1/(1+math.exp(-clip(x,-30,30)))

def strength_history(games):
    """Opponent strength is frozen BEFORE each result; no look-ahead selection of hard games."""
    ratings=defaultdict(float); records=defaultdict(list); last_season=None
    for g in sorted(games,key=lambda g:(g['start'],g['gameCode'])):
        if g['season']!=last_season:
            if last_season is not None:
                for t in ratings:ratings[t]*=.65
            last_season=g['season']
        h,a=g['home'],g['away']; margin=ratings[h]-ratings[a]+3.2
        hp=sigmoid(margin/7.2); actual=g['homeScore']-g['awayScore']
        for t,o,p,d in [(h,a,hp,actual),(a,h,1-hp,-actual)]:
            if g['season']=='E2026':records[t].append({'opponent':o,'gameCode':g['gameCode'],'date':g['start'],'home':t==h,'pregameWinProb':round(p,5),'opponentRatingBefore':round(ratings[o],3),'hard':p<=.4,'won':d>0,'margin':d})
        residual=clip(actual-margin,-25,25)
        ratings[h]=clip(ratings[h]+.10*residual,-24,24)
        ratings[a]=clip(ratings[a]-.10*residual,-24,24)
    return dict(ratings),dict(records)

STAT_FIELDS=['points','valuation','fieldGoalsAttempted2','fieldGoalsMade2','fieldGoalsAttempted3','fieldGoalsMade3','freeThrowsAttempted','freeThrowsMade','assistances','turnovers','steals','blocksFavour','totalRebounds','foulsCommited']
def player_context(games, boxes, players):
    roster={key(p.get('name')):p for p in players if p.get('pos') in ['G','F','C']}
    logs=defaultdict(list); defense=defaultdict(list)
    for g in games:
        if g['season']!='E2026' or g['gameCode'] not in boxes:continue
        box=boxes[g['gameCode']]
        for side,t,opp in [('local',g['home'],g['away']),('road',g['away'],g['home'])]:
            shot=defaultdict(float);valid=defaultdict(int);played_rows=0
            for row in (box.get(side) or {}).get('players',[]):
                person=(row.get('player') or {}).get('person') or {};s=row.get('stats') or {}
                minutes=(number(s.get('timePlayed')) or 0)/60
                if minutes<=0:continue
                played_rows+=1
                fields={f:number(s.get(f)) for f in STAT_FIELDS}
                for f in ['fieldGoalsAttempted2','fieldGoalsMade2','fieldGoalsAttempted3','fieldGoalsMade3','freeThrowsAttempted','freeThrowsMade']:
                    if fields[f] is not None:shot[f]+=fields[f];valid[f]+=1
                k=key(person.get('name'));p=roster.get(k)
                # Transfers: old-club observations cannot describe current role.
                if p and team(p.get('team'))==t:
                    logs[k].append({'gameCode':g['gameCode'],'date':g['start'],'team':t,'opponent':opp,'minutes':minutes,'margin':g['homeScore']-g['awayScore'] if side=='local' else g['awayScore']-g['homeScore'],'height':number(person.get('height')),'weight':number(person.get('weight')),**fields})
            if played_rows and all(valid[f]==played_rows for f in ['fieldGoalsAttempted2','fieldGoalsMade2','fieldGoalsAttempted3','fieldGoalsMade3']):
                defense[opp].append({f:shot[f] if valid[f] else None for f in ['fieldGoalsAttempted2','fieldGoalsMade2','fieldGoalsAttempted3','fieldGoalsMade3','freeThrowsAttempted','freeThrowsMade']})
    profiles={};team_offense=defaultdict(list)
    for k,rows in logs.items():
        rows.sort(key=lambda r:(r['date'],r['gameCode']))
        sums={f:sum(r[f] for r in rows if r[f] is not None) for f in STAT_FIELDS}
        mins=sum(r['minutes'] for r in rows)
        counts={f:sum(r[f] is not None for r in rows) for f in STAT_FIELDS}
        avg={f:sums[f]/counts[f] if counts[f] else None for f in STAT_FIELDS}
        complete=[r for r in rows if all(r[f] is not None for f in ['fieldGoalsAttempted2','fieldGoalsAttempted3','freeThrowsAttempted','turnovers'])]
        events=lambda r:r['fieldGoalsAttempted2']+r['fieldGoalsAttempted3']+.44*r['freeThrowsAttempted']+r['turnovers']
        per_min=sum(events(r) for r in complete)/sum(r['minutes'] for r in complete) if complete else None
        prev=complete[:-2]; recent=complete[-2:]
        ref=sum(events(r) for r in prev)/sum(r['minutes'] for r in prev) if prev else None
        latest=sum(events(r) for r in recent)/sum(r['minutes'] for r in recent) if recent else None
        p=roster[k]
        profiles[k]={'name':p['name'],'team':team(p['team']),'pos':p['pos'],'games':len(rows),'avgMinutes':mins/len(rows),'averages':avg,'shotEventsPerMinute':per_min,'recentEventsPerMinute':latest,'previousEventsPerMinute':ref,'recentGames':len(recent),'previousGames':len(prev),'minutesSd':statistics.pstdev(r['minutes'] for r in rows) if len(rows)>1 else None,'height':rows[-1]['height'],'weight':rows[-1]['weight'],'logs':rows[-10:]}
        team_offense[team(p['team'])].append(k)
    for keys in team_offense.values():
        total=sum((profiles[k]['shotEventsPerMinute'] or 0)*profiles[k]['avgMinutes'] for k in keys)
        for k in keys:
            p=profiles[k];p['offensiveShareProxy']=p['shotEventsPerMinute']*p['avgMinutes']/total if total and p['shotEventsPerMinute'] is not None else None
    allowed={}
    for t,rows in defense.items():
        def summed(f):return sum(r[f] for r in rows if r[f] is not None)
        allowed[t]={'games':len(rows),'attempts2':summed('fieldGoalsAttempted2'),'made2':summed('fieldGoalsMade2'),'attempts3':summed('fieldGoalsAttempted3'),'made3':summed('fieldGoalsMade3')}
    all2=sum(x['attempts2'] for x in allowed.values());all3=sum(x['attempts3'] for x in allowed.values())
    league={'rate2':sum(x['made2'] for x in allowed.values())/all2 if all2 else None,'rate3':sum(x['made3'] for x in allowed.values())/all3 if all3 else None}
    return profiles,allowed,league

def availability(players, profiles, t):
    roster=[p for p in players if team(p.get('team'))==t and p.get('pos') in ['G','F','C']]
    impacts=[]
    for p in roster:
        if p.get('status') not in ['out','questionable']:continue
        profile=profiles.get(key(p['name'])); price=number(p.get('price')) or 0
        mins=profile['avgMinutes'] if profile else (27 if price>=14 else 23 if price>=10 else 19 if price>=7 else 14)
        missing=1 if p['status']=='out' else 1-clip(number(p.get('probability_of_playing')) if number(p.get('probability_of_playing')) is not None else .5,0,1)
        impact=clip((price-5)/10,0,1.5)*mins/25*missing
        impacts.append({'name':p['name'],'status':p['status'],'missingProbability':missing,'avgMinutes':round(mins,2),'sampleGames':profile['games'] if profile else 0,'impactProxy':round(impact,3)})
    return {'missing':impacts,'marginPenalty':round(clip(sum(x['impactProxy'] for x in impacts),0,3),3),'available':sum(p.get('status')=='active' for p in roster),'rosterCount':len(roster)}

def calibrate(records):
    rows=sorted(records,key=lambda r:r['date'])
    def score(data,a,b):return sum((sigmoid(a+b*r['logit'])-r['won'])**2 for r in data)/len(data)
    # Reliability buckets retain every frozen forecast, including this model version.
    bins=[]
    for lo in range(0,100,10):
        group=[r for r in rows if lo/100<=r['rawProb']<(lo+10)/100 or (lo==90 and r['rawProb']==1)]
        bins.append({'from':lo,'to':lo+10,'n':len(group),'predicted':sum(r['rawProb'] for r in group)/len(group) if group else None,'observed':sum(r['won'] for r in group)/len(group) if group else None})
    report={'active':False,'n':len(rows),'bins':bins,'modelVersion':VERSION,'reason':'needs-100-frozen-games','coefficients':{'intercept':0,'slope':1}}
    if len(rows)<100:return report
    split=int(len(rows)*.65);train,test=rows[:split],rows[split:]
    # Keep all games on a date in the same split.
    boundary=test[0]['date'][:10];train=[r for r in rows if r['date'][:10]<boundary];test=[r for r in rows if r['date'][:10]>=boundary]
    if len(train)<60 or len(test)<30 or len({r['date'][:10] for r in test})<6:return report
    a,b=0.,1.
    for _ in range(1200):
        errors=[sigmoid(a+b*r['logit'])-r['won'] for r in train]
        a-=.04*(sum(errors)/len(train)+.02*a)
        b-=.04*(sum(e*r['logit'] for e,r in zip(errors,train))/len(train)+.02*(b-1))
        a=clip(a,-1,1);b=clip(b,.4,1.8)
    base=score(test,0,1);candidate=score(test,a,b)
    report.update({'trainN':len(train),'validationN':len(test),'baselineBrier':base,'candidateBrier':candidate,'coefficients':{'intercept':a,'slope':b},'active':candidate<base*.98,'reason':'validated' if candidate<base*.98 else 'no-held-out-improvement'})
    return report

def build(root=ROOT,offline=False):
    warnings=[];all_games=[]
    model_version=VERSION+':'+hashlib.sha256(b''.join((root/p).read_bytes() for p in ['matchup-context-core.js','scripts/build_matchup_context.py','personal-model-core.js','.github/workflows/matchups-live.yml'] if (root/p).exists())).hexdigest()[:16]
    for season in ['E2025','E2026']:
        cache=root/f'data/context/{season}-schedule.json'
        try:
            payload=load(cache) if offline else api(season,'games?limit=500')
            if not payload:raise RuntimeError('No schedule cache')
            if not offline:save(cache,payload)
        except Exception as e:
            payload=load(cache,{'data':[]});warnings.append(f'{season}: schedule unavailable ({type(e).__name__})')
        for g in payload.get('data',[]):
            start=stamp(g.get('utcDate'));hs=number((g.get('local') or {}).get('score'));rs=number((g.get('road') or {}).get('score'))
            if not start or start>=NOW or not g.get('played') or hs is None or rs is None:continue
            all_games.append({'season':season,'gameCode':int(g['gameCode']),'start':start.isoformat(),'home':team(g['local']['club']['name']),'away':team(g['road']['club']['name']),'homeScore':hs,'awayScore':rs})
    boxes={};current=[g for g in all_games if g['season']=='E2026']
    def read_box(g):
        path=root/f'data/backtest/cache/E2026-{g["gameCode"]}-stats.json';box=load(path)
        if box is None and not offline:
            try:box=api('E2026',f'games/{g["gameCode"]}/stats');save(path,box)
            except Exception:return g['gameCode'],None
        return g['gameCode'],box
    with ThreadPoolExecutor(max_workers=4) as pool:
        for code,box in pool.map(read_box,current):
            if box:boxes[code]=box
            else:warnings.append(f'Box missing: E2026-{code}')
    players=load(root/'data/players.json',[])
    profiles,allowed,league=player_context(current,boxes,players)
    ratings,records=strength_history(all_games)
    matches=load(root/'data/matchups.json',{}).get('matchups',{})
    teaminfo={}
    for t in {team(p.get('team')) for p in players}:
        games=records.get(t,[]);hard=[g for g in games if g['hard']]
        teaminfo[t]={'availability':availability(players,profiles,t),'rating':ratings.get(t,0),'currentGames':len(games),'hardGames':len(hard),'hardWins':sum(g['won'] for g in hard),'hardHistory':hard,'recentHistory':games[-5:]}
    snapshots=root/'data/context/team-snapshots';snapshots.mkdir(parents=True,exist_ok=True)
    actual={(g['season'],g['gameCode']):g for g in all_games}
    evaluated=[]
    for path in snapshots.glob('*.json'):
        s=load(path,{});g=actual.get(('E2026',s.get('gameCode')))
        if not g or s.get('modelVersion')!=model_version or not stamp(s.get('created_at')) or stamp(s['created_at'])>=stamp(g['start']):continue
        p=number(s.get('rawProb'))
        if p is None or not 0<p<1:continue
        evaluated.append({'gameCode':g['gameCode'],'date':g['start'],'rawProb':p,'logit':math.log(p/(1-p)),'won':int(g['homeScore']>g['awayScore'])})
    calibration=calibrate(evaluated)
    calibration['modelVersion']=model_version
    for t,m in matches.items():
        t=team(t);o=team(m.get('opponent'))
        if t not in teaminfo or o not in teaminfo:continue
        # Opponent-adjusted margin shrinks toward existing model. Ratings require observed games.
        strength_margin=ratings.get(t,0)-ratings.get(o,0)+(3.2 if m.get('home') else -3.2)
        sample=min(teaminfo[t]['currentGames'],teaminfo[o]['currentGames'])
        strength_delta=clip((strength_margin-(number(m.get('margin')) or 0))*.25*sample/(sample+6),-2,2)
        roster_delta=teaminfo[o]['availability']['marginPenalty']-teaminfo[t]['availability']['marginPenalty']
        margin=(number(m.get('margin')) or 0)+strength_delta+roster_delta
        raw=sigmoid(margin/7.2);c=calibration['coefficients'];served=sigmoid((c['intercept'] if m.get('home') else -c['intercept'])+c['slope']*math.log(raw/(1-raw))) if calibration['active'] else raw
        teaminfo[t].update({'opponent':o,'home':bool(m.get('home')),'baseMargin':m.get('margin'),'strengthDelta':round(strength_delta,4),'rosterDelta':round(roster_delta,4),'margin':round(margin,4),'rawWinProb':raw,'winProb':served})
    # Save forecasts only before kickoff; never manufacture predictions for played games.
    schedule=load(root/'data/learning/schedule.json',{})
    for g in schedule.values():
        start=stamp(g.get('start'));t=team(g.get('home'));o=team(g.get('away'));m=teaminfo.get(t,{})
        if not start or g.get('played') or not NOW+timedelta(minutes=10)<start<=NOW+timedelta(hours=24):continue
        if m.get('opponent')!=o or m.get('home') is not True:continue
        path=snapshots/f'E2026-{g["gameCode"]}.json'
        if not path.exists():save(path,{'modelVersion':model_version,'gameCode':g['gameCode'],'home':t,'away':o,'kickoff':g['start'],'created_at':NOW.isoformat(),'rawProb':m['rawWinProb'],'servedProb':m['winProb'],'margin':m['margin'],'strengthDelta':m['strengthDelta'],'rosterDelta':m['rosterDelta']})
    result={'schema':VERSION,'modelVersion':model_version,'season':'E2026','updated_at':NOW.isoformat(),'players':profiles,'defense':allowed,'league':league,'teams':teaminfo,'calibration':calibration,'warnings':warnings,'currentGames':len(current),'boxGames':len(boxes)}
    # A failed scheduled API fetch must not wipe a previous usable dataset.
    if not current or not profiles:
        if (root/'data/matchup-context.json').exists():raise RuntimeError('Context refresh incomplete; preserving previous dataset')
        raise RuntimeError('No current-season observations; context cannot be built')
    save(root/'data/matchup-context.json',result)
    print(f'Context: {len(profiles)} players, {len(current)} games, {len(boxes)} boxes; calibration {len(evaluated)} frozen games')
    return result

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--offline',action='store_true');args=parser.parse_args();build(offline=args.offline)
