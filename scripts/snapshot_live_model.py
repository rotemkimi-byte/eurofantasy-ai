"""Save the actual browser model before kickoff; never fabricate past forecasts."""
import json, threading
from datetime import datetime, timezone, timedelta
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from functools import partial
from pathlib import Path
from playwright.sync_api import sync_playwright
from fantasy_learning import ROOT, OUT, VERSION, load, save, canon, date, model_id

class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self,*args): pass

schedule=load(OUT/'schedule.json',{})
now=datetime.now(timezone.utc)
upcoming=[g for g in schedule.values() if not g['played'] and now+timedelta(minutes=10)<date(g['start'])<=now+timedelta(hours=24) and (not (OUT/f'snapshots/E2026-{g["gameCode"]}.json').exists() or not (OUT/f'team-snapshots/E2026-{g["gameCode"]}.json').exists())]
if not upcoming:
    print('No new games within 24 hours; existing frozen forecasts preserved.')
    raise SystemExit(0)
server=ThreadingHTTPServer(('127.0.0.1',0),partial(QuietHandler,directory=str(ROOT)))
threading.Thread(target=server.serve_forever,daemon=True).start()
try:
    with sync_playwright() as pw:
        browser=pw.chromium.launch(headless=True)
        page=browser.new_page()
        page.goto(f'http://127.0.0.1:{server.server_port}/index.html',wait_until='networkidle',timeout=60000)
        page.wait_for_function('window.__stabilityModelPatched && window.__learningReady && window.__recentFormPatched',timeout=45000)
        if page.evaluate('window.__learningModelId')!=model_id(): raise RuntimeError('Browser model version does not match source')
        forecasts=page.evaluate('''() => players.filter(p=>['G','F','C'].includes(p.pos)).map(p=>{
          const x=model(p),b=x.learning;
          return {name:p.name,team:p.team,pos:p.pos,opponent:x.match?.opponent,home:!!x.match?.home,status:p.status,price:p.price,
          expectedPir:x.expected,expectedMinutes:x.minutes,basePir:b?.basePir??x.expected,baseMinutes:b?.baseMinutes??x.minutes,
          correctionActive:!!b?.applied,modelSource:x.source,features:{basePir:x.basePir,baseMin:x.baseMin,injuryBoost:x.injuryBoost,injuryUsagePct:x.injuryUsagePct,missingStars:x.missingStars,positionMatchPct:x.positionMatchPct,teamPoints:x.match?.teamPoints,margin:x.match?.margin,lastGameWeight:x.recentForm?.lastGameWeight}};
        })''')
        team_forecasts=page.evaluate('() => Object.fromEntries(Object.entries(MATCHUPS).map(([team,m])=>[team,{...m}]))')
        browser.close()
    for g in upcoming:
        created=datetime.now(timezone.utc)
        if created>=date(g['start'])-timedelta(minutes=10):continue
        selected=[]
        for p in forecasts:
            team=canon(p['team']);opp=canon(p.get('opponent'))
            if team not in [g['home'],g['away']]:continue
            if opp!=(g['away'] if team==g['home'] else g['home']):continue
            if p['home']!=(team==g['home']):continue
            selected.append({**p,'team':team,'opponent':opp})
        if not selected:print('Skipped stale or missing matchup',g['gameCode']);continue
        team_path=OUT/f'team-snapshots/E2026-{g["gameCode"]}.json'
        team_map={canon(k):v for k,v in team_forecasts.items()}
        tm=team_map.get(g['home'],{})
        if not team_path.exists() and canon(tm.get('opponent'))==g['away'] and tm.get('home') is True:
            save(team_path,{'season':'E2026','created_at':created.isoformat(),'home':g['home'],'away':g['away'],'gameCode':g['gameCode'],'round':g['round'],'forecast':tm})
        player_path=OUT/f'snapshots/E2026-{g["gameCode"]}.json'
        if player_path.exists():continue
        save(player_path,{'schema':VERSION,'season':'E2026','modelId':model_id(),'gameCode':g['gameCode'],'round':g['round'],'kickoff':g['start'],'created_at':created.isoformat(),'predictions':selected})
        print('Frozen live forecast',g['gameCode'],len(selected),'players')
finally:server.shutdown()
