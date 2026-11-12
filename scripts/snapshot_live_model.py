"""Save the actual browser model before kickoff; never fabricate past forecasts."""
import json, threading
from datetime import datetime, timezone, timedelta
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from functools import partial
from pathlib import Path
from playwright.sync_api import sync_playwright
from fantasy_learning import ROOT, OUT, VERSION, load, save, canon, date, model_id
from unified_learning import engine_id as shadow_id, freeze_shadow

class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self,*args): pass

schedule=load(OUT/'schedule.json',{})
now=datetime.now(timezone.utc)
ident=model_id()
candidate_id=shadow_id()

def shadow_path(g):
    return OUT/f'shadow-snapshots/E2026-{g["gameCode"]}-{candidate_id}.json'

def needs_snapshot(g):
    old=load(OUT/f'snapshots/E2026-{g["gameCode"]}.json')
    return not old or old.get('algorithmSchema')!=2 or old.get('modelId')!=ident or not shadow_path(g).exists() or not (OUT/f'team-snapshots/E2026-{g["gameCode"]}.json').exists()

upcoming=[g for g in schedule.values() if not g['played'] and now+timedelta(minutes=10)<date(g['start'])<=now+timedelta(hours=24) and needs_snapshot(g)]
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
        page.wait_for_function('window.__weightedForecastReady && window.__stabilityModelPatched && window.__learningReady && window.__recentFormPatched && (!window.__matchupContextEnabled || window.__matchupContextReady) && (!window.__replayCaptureReady || window.__rollingReady)',timeout=45000)
        if page.evaluate('window.__learningModelId')!=ident: raise RuntimeError('Browser model version does not match source')
        weighted_defaults=page.evaluate('window.WeightedForecast.defaults')
        captured=page.evaluate('''() => ({forecasts:players.filter(p=>['G','F','C'].includes(p.pos)).map(p=>{
          const x=model(p),b=x.learning;
          return {name:p.name,team:p.team,pos:p.pos,opponent:x.match?.opponent,home:!!x.match?.home,status:p.status,price:p.price,
          expectedPir:x.expected,expectedMinutes:x.minutes,weightedForecast:x.weightedForecast??null,basePir:b?.basePir??x.weightedForecast?.base??x.expected,baseMinutes:b?.baseMinutes??x.minutes,
          correctionActive:!!b?.applied,modelSource:x.source,algorithmInputs:Object.fromEntries(["basePir","baseMin","injuryBoost","injuryUsagePct","missingStars","positionMatchPct","positionMatchup","minutes","recentForm","context"].map(k=>[k,x[k]??null])),features:{basePir:x.basePir,baseMin:x.baseMin,injuryBoost:x.injuryBoost,injuryUsagePct:x.injuryUsagePct,missingStars:x.missingStars,positionMatchPct:x.positionMatchPct,teamPoints:x.match?.teamPoints,margin:x.match?.margin,lastGameWeight:x.recentForm?.lastGameWeight,personalPrior:x.personalPrior,currentSeasonWeight:x.currentSeasonWeight,context:x.context?{involvementFactor:x.context.involvementFactor,defenseFactor:x.context.defenseFactor,defenseSample:x.context.defenseSample,rival:x.context.rival?.name,scenarios:x.context.scenarios,minutesCorrectionActive:x.context.minutesCorrectionActive}:null}};
        }),shadow:window.captureUnifiedForecast?.() ?? null})''')
        forecasts,shadow=captured['forecasts'],captured['shadow']
        created=datetime.now(timezone.utc)
        team_forecasts=page.evaluate('() => Object.fromEntries(Object.entries(MATCHUPS).map(([team,m])=>[team,{...m}]))')
        browser.close()
    for g in upcoming:
        if created>=date(g['start'])-timedelta(minutes=10):continue
        selected=[]
        for p in forecasts:
            team=canon(p['team']);opp=canon(p.get('opponent'))
            if team not in [g['home'],g['away']]:continue
            if opp!=(g['away'] if team==g['home'] else g['home']):continue
            if p['home']!=(team==g['home']):continue
            selected.append({**p,'team':team,'opponent':opp})
        if not selected or not all(p.get('weightedForecast') for p in selected):
            print('Skipped stale matchup or missing weighted data',g['gameCode']);continue
        team_path=OUT/f'team-snapshots/E2026-{g["gameCode"]}.json'
        team_map={canon(k):v for k,v in team_forecasts.items()}
        tm=team_map.get(g['home'],{})
        if not team_path.exists() and canon(tm.get('opponent'))==g['away'] and tm.get('home') is True:
            save(team_path,{'season':'E2026','created_at':created.isoformat(),'home':g['home'],'away':g['away'],'gameCode':g['gameCode'],'round':g['round'],'forecast':tm})
        if shadow:
            inputs={(p['name'],canon(p['team'])):p for p in shadow['predictions']}
            for p in selected:
                candidate=inputs.get((p['name'],p['team']))
                if candidate and canon(candidate.get('opponent'))==p['opponent'] and candidate.get('home')==p['home']:
                    p['shadowInput']=candidate.get('input')
        if shadow and any(p.get('shadowInput') for p in selected) and not shadow_path(g).exists():
            paired=freeze_shadow([p for p in selected if p.get('shadowInput')],created,shadow['completedCodes'],schedule)
            finished=datetime.now(timezone.utc)
            if finished<date(g['start'])-timedelta(minutes=10):
                save(shadow_path(g),{'shadowId':candidate_id,'season':'E2026','modelId':ident,
                    'gameCode':g['gameCode'],'created_at':finished.isoformat(),'input_cutoff':created.isoformat(),
                    'predictions':paired})
                print('Frozen shadow forecast',g['gameCode'],len(paired),'players')
        for p in selected:
            p.pop('shadowInput',None)
        player_path=OUT/f'snapshots/E2026-{g["gameCode"]}.json'
        old=load(player_path)
        if old and old.get('modelId')==ident and old.get('algorithmSchema')==2:continue
        if old:
            archive=OUT/f'snapshots/archive/E2026-{g["gameCode"]}-{old.get("modelId","legacy")}.json'
            if not archive.exists():save(archive,old)
        save(player_path,{'algorithmSchema':2,'weightedDefaults':weighted_defaults,'schema':VERSION,'season':'E2026','modelId':ident,'gameCode':g['gameCode'],'round':g['round'],'kickoff':g['start'],'created_at':created.isoformat(),'predictions':selected})
        print('Frozen live forecast',g['gameCode'],len(selected),'players')
finally:server.shutdown()
