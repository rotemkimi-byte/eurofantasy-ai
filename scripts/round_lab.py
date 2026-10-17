"""Retrospective round bargains and exact fixed-lineup fantasy optimisation."""
from __future__ import annotations
import argparse, collections, datetime as dt, hashlib, json, math, re, subprocess, unicodedata
from pathlib import Path
import numpy as np
from scipy.optimize import Bounds, LinearConstraint, milp
from scipy.sparse import lil_matrix

ROOT=Path(__file__).resolve().parents[1]
SEASON='E2026'
BUDGETS=[80,90,100,105,110,115,120,125,130,140,150,None]
FORMATIONS=[(2,2,1),(1,2,2),(2,1,2),(1,3,1),(3,1,1)]
ROLES={'starter':1.,'captain':2.,'sixth':1.,'bench':.5,'coach':1.}
VERSION=1

def read(path,default=None):
    try:return json.loads(Path(path).read_text())
    except (OSError,ValueError):return default

def number(v):
    if v is None or isinstance(v,bool) or v=='':return None
    try:
        n=float(v);return n if math.isfinite(n) else None
    except (ValueError,TypeError):return None

def date(v):
    try:return dt.datetime.fromisoformat(str(v).replace('Z','+00:00')).astimezone(dt.timezone.utc)
    except (ValueError,TypeError):return None

def name_key(value):
    s=''.join(c for c in unicodedata.normalize('NFKD',str(value or '')) if not unicodedata.combining(c)).lower()
    return ' '.join(sorted(re.findall(r'[a-z0-9]+',s)))

ALIASES=[('efes','Anadolu Efes'),('armani','Milano'),('milan','Milano'),('besiktas','Besiktas'),('crvena','Crvena Zvezda'),('dubai','Dubai'),('barcelona','Barcelona'),('bayern','Bayern Munich'),('fenerbahce','Fenerbahce'),('hapoel','Hapoel Tel Aviv'),('baskonia','Baskonia'),('asvel','ASVEL'),('maccabi','Maccabi Tel Aviv'),('olympiacos','Olympiacos'),('panathinaikos','Panathinaikos'),('paris','Paris'),('partizan','Partizan'),('real madrid','Real Madrid'),('valencia','Valencia'),('virtus','Virtus Bologna'),('zalgiris','Zalgiris')]
def team(value):
    normalized=unicodedata.normalize('NFKD',str(value or '')).encode('ascii','ignore').decode().lower()
    return next((label for match,label in ALIASES if match in normalized),str(value or ''))

def coach_points(margin,ot=False):
    if margin==0:return None
    if margin>0:return 10 if ot or margin<=10 else 20 if margin<=20 else 25
    return -5 if ot or margin>=-10 else -10 if margin>=-20 else -20

def historical_market(root,start):
    """Never substitute today's price for the pre-round purchase price."""
    try:
        sha=subprocess.check_output(['git','log','-1','--format=%H',f'--before={start.isoformat()}','--','data/players.json'],cwd=root,text=True,stderr=subprocess.DEVNULL).strip()
        if not sha:return [],None
        rows=json.loads(subprocess.check_output(['git','show',f'{sha}:data/players.json'],cwd=root,stderr=subprocess.DEVNULL))
        rows=[p for p in rows if date(p.get('data_updated')) and date(p['data_updated'])<start]
        return rows,sha
    except (subprocess.SubprocessError,ValueError):return [],None

def collect_round(root,fixtures,current,now):
    round_no=int(fixtures[0]['round']);start=min(date(g['utcDate']) for g in fixtures)
    market,sha=historical_market(root,start)
    prices={name_key(p['name']):p for p in market}
    snapshot=read(root/f'data/backtest/predictions-round-{round_no:02d}.json',{})
    if snapshot.get('season')==SEASON and snapshot.get('round')==round_no and date(snapshot.get('created_at')) and date(snapshot['created_at'])<start:
        for p in snapshot.get('predictions',[]):prices.setdefault(name_key(p['name']),p)
    candidates={name_key(p['name']):p for p in current}
    candidates.update(prices)
    current_map={name_key(p['name']):p for p in current}
    games={};missing=[];played=0
    for g in fixtures:
        if g.get('played') is not True or date(g['utcDate'])>=now:continue
        played+=1;code=int(g['gameCode']);box=read(root/f'data/backtest/cache/{SEASON}-{code}-stats.json')
        if not box or any(not box.get(s,{}).get('players') or number(box.get(s,{}).get('total',{}).get('points')) is None for s in ['local','road']):missing.append(code);continue
        a,b=[number(box[s]['total']['points']) for s in ['local','road']]
        if a==b:missing.append(code);continue
        ot=any((number(box[s]['total'].get('timePlayed')) or 0)>2400 for s in ['local','road']) or any(any((number(v) or 0)>0 for v in g[s].get('partials',{}).get('extraPeriods',{}).values()) for s in ['local','road'])
        for side,other,score,against in [('local','road',a,b),('road','local',b,a)]:
            club=team(g[side]['club']['name']);opponent=team(g[other]['club']['name'])
            stats={name_key(r.get('player',{}).get('person',{}).get('name')):r for r in box[side].get('players',[])}
            games.setdefault(club,[]).append({'code':code,'opponent':opponent,'home':side=='local','stats':stats,'score':score,'against':against,'coach':box[side].get('coach',{}).get('name'),'coachPoints':coach_points(score-against,ot)})
    rows=[];unknown_prices=0
    for key,p in candidates.items():
        pos=p.get('pos');club=team(p.get('team'));team_games=games.get(club,[])
        if pos not in ['G','F','C','H'] or not team_games:continue
        price=number(prices.get(key,{}).get('price'))
        if price is None or price<=0:unknown_prices+=1;continue
        pir=minutes=points=0.;appearances=0;valid=True
        for g in team_games:
            if pos=='H':
                if name_key(g['coach'])!=key:valid=False;break
                points+=g['coachPoints'];appearances+=1;continue
            r=g['stats'].get(key)
            # A player absent from a complete final box score earns zero, not a fabricated PIR.
            if r is None:continue
            seconds=number(r.get('stats',{}).get('timePlayed'))
            val=number(r.get('stats',{}).get('valuation'))
            if seconds is None or (seconds>0 and val is None):valid=False;break
            val=0. if seconds==0 else val
            pir+=val;minutes+=seconds/60;points+=val*(1.1 if g['score']>g['against'] else 1);appearances+=int(seconds>0)
        if not valid:continue
        rows.append({'id':key,'name':p['name'],'team':club,'pos':pos,'price':round(price,1),'currentPrice':number(current_map.get(key,{}).get('price')),'pir':None if pos=='H' else round(pir,3),'points':round(points,3),'minutes':round(minutes,2),'played':appearances>0,'opponents':[{'name':g['opponent'],'home':g['home']} for g in team_games]})
    return {'round':round_no,'start':start.isoformat(),'complete':played==len(fixtures) and not missing,'playedGames':played,'totalGames':len(fixtures),'missingBoxes':missing,'unknownPrices':unknown_prices,'priceSource':'pre-round','priceCommit':sha,'players':rows,'solutions':{}}

def solve(rows,budget=None,time_limit=20):
    """MILP: one role per person, 4G/4F/2C, legal five, sixth, 4 bench, captain, coach."""
    eligible=[p for p in rows if p['pos'] in ['G','F','C','H'] and number(p.get('price')) is not None and p['price']>0 and number(p.get('points')) is not None]
    if any(sum(p['pos']==pos for p in eligible)<n for pos,n in [('G',4),('F',4),('C',2),('H',1)]):return {'status':'unavailable','reason':'אין מספיק שחקנים עם נתוני מחיר וניקוד מאומתים'}
    variables=[(i,role) for i,p in enumerate(eligible) for role in (['coach'] if p['pos']=='H' else ['starter','captain','sixth','bench'])]
    nv=len(variables);z0=nv;n=nv+len(FORMATIONS);constraints=[];lower=[];upper=[]
    def add(entries,lo,hi):constraints.append(entries);lower.append(lo);upper.append(hi)
    for i,p in enumerate(eligible):add({j:1 for j,(idx,_) in enumerate(variables) if idx==i},0,1)
    for pos,count in [('G',4),('F',4),('C',2),('H',1)]:add({j:1 for j,(i,_) in enumerate(variables) if eligible[i]['pos']==pos},count,count)
    for role,count in [('captain',1),('sixth',1),('bench',4)]:add({j:1 for j,(_,r) in enumerate(variables) if r==role},count,count)
    add({z0+k:1 for k in range(len(FORMATIONS))},1,1)
    for k,pos in enumerate(['G','F','C']):
        entries={j:1 for j,(i,r) in enumerate(variables) if eligible[i]['pos']==pos and r in ['starter','captain']}
        entries.update({z0+f:-formation[k] for f,formation in enumerate(FORMATIONS)});add(entries,0,0)
    for club in {p['team'] for p in eligible}:add({j:1 for j,(i,_) in enumerate(variables) if eligible[i]['team']==club},0,6)
    if budget is not None:add({j:round(eligible[i]['price']*10) for j,(i,_) in enumerate(variables)},0,round(budget*10))
    matrix=lil_matrix((len(constraints),n),dtype=float)
    for row,entries in enumerate(constraints):
        for col,v in entries.items():matrix[row,col]=v
    objective=np.zeros(n)
    for j,(i,role) in enumerate(variables):objective[j]=-eligible[i]['points']*ROLES[role]
    result=milp(objective,integrality=np.ones(n),bounds=Bounds(np.zeros(n),np.ones(n)),constraints=LinearConstraint(matrix.tocsr(),lower,upper),options={'time_limit':time_limit,'mip_rel_gap':0.0})
    if result.x is None:return {'status':'infeasible' if result.status==2 else 'unavailable','reason':'לא נמצא סגל בתקציב הזה' if result.status==2 else 'החישוב לא הושלם'}
    chosen=[]
    for j,(i,role) in enumerate(variables):
        if result.x[j]>.5:chosen.append({'id':eligible[i]['id'],'role':role,'multiplier':ROLES[role],'contribution':round(eligible[i]['points']*ROLES[role],3)})
    cost=sum(next(p['price'] for p in eligible if p['id']==r['id']) for r in chosen)
    return {'status':'optimal' if result.status==0 else 'feasible','score':round(sum(r['contribution'] for r in chosen),3),'cost':round(cost,1),'budget':budget,'formation':next(list(f) for k,f in enumerate(FORMATIONS) if result.x[z0+k]>.5),'roster':chosen,'gap':number(getattr(result,'mip_gap',None))}

def build(root=ROOT,budgets=BUDGETS):
    current=read(root/'data/players.json',[]);schedule=read(root/'data/context/E2026-schedule.json',{}).get('data',[])
    now=dt.datetime.now(dt.timezone.utc);groups=collections.defaultdict(list)
    for g in schedule:
        if g.get('season',{}).get('code',SEASON)==SEASON and date(g.get('utcDate')):groups[int(g['round'])].append(g)
    old=read(root/'data/round-lab.json',{});cached={r['round']:r for r in old.get('rounds',[])};rounds=[]
    for rn,fixtures in sorted(groups.items()):
        if not any(g.get('played') is True and date(g['utcDate'])<now for g in fixtures):continue
        report=collect_round(root,fixtures,current,now)
        fingerprint=hashlib.sha256(json.dumps([VERSION,report['players'],report['complete'],budgets],sort_keys=True).encode()).hexdigest()
        prior=cached.get(rn)
        if prior and prior.get('fingerprint')==fingerprint and all(s.get('status')!='feasible' for s in prior.get('solutions',{}).values()):report['solutions']=prior['solutions']
        else:
            for budget in budgets:
                report['solutions']['unlimited' if budget is None else str(budget)]=solve(report['players'],budget)
            print(f"Round {rn}: {len(report['players'])} priced participants; {sum(s['status']=='optimal' for s in report['solutions'].values())} optimal rosters",flush=True)
        report['fingerprint']=fingerprint;rounds.append(report)
    if not rounds:raise RuntimeError('No completed games for the current season')
    out={'season':SEASON,'version':VERSION,'updatedAt':now.isoformat(),'budgets':budgets,'rules':{'formations':FORMATIONS,'positionCounts':{'G':4,'F':4,'C':2},'clubLimit':6,'captain':2,'bench':.5,'sixth':1,'coach':1,'staticLineup':True,'source':'https://fantaking.gitbook.io/euroleague-fantasy-challenge-rules'},'rounds':rounds}
    target=root/'data/round-lab.json'
    if {k:v for k,v in old.items() if k!='updatedAt'}=={k:v for k,v in out.items() if k!='updatedAt'}:
        print('Round report unchanged');return old
    target.write_text(json.dumps(out,ensure_ascii=False,separators=(',',':'))+'\n')
    print(f'Saved {target}: {len(rounds)} rounds')
    return out

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--quick',action='store_true');args=parser.parse_args()
    build(budgets=[100,None] if args.quick else BUDGETS)
