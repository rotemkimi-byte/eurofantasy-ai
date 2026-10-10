"""Freeze complete projection inputs before kickoff, independent of legacy snapshots."""
import threading
from datetime import datetime,timezone,timedelta
from functools import partial
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from playwright.sync_api import sync_playwright
from rolling_learning import ROOT,OUT,engine_id,input_ok
from fantasy_learning import load,save,date,canon,key
now=datetime.now(timezone.utc);ident=engine_id()
schedule=load(OUT/'schedule.json',{})
games=[g for g in schedule.values() if not g['played'] and now+timedelta(minutes=10)<date(g['start'])<=now+timedelta(hours=24) and load(OUT/f'input-snapshots/E2026-{g["gameCode"]}.json',{}).get('engineId')!=ident]
if not games:print('No upcoming games needing complete input snapshots');raise SystemExit(0)
class Quiet(SimpleHTTPRequestHandler):
    def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(ROOT)))
threading.Thread(target=server.serve_forever,daemon=True).start()
try:
    with sync_playwright() as pw:
        browser=pw.chromium.launch(headless=True);page=browser.new_page()
        page.goto(f'http://127.0.0.1:{server.server_port}/index.html',wait_until='networkidle',timeout=60000)
        page.wait_for_function('window.__rollingReady && window.__replayCaptureReady && window.__learningReady && window.__matchupContextReady',timeout=60000)
        if page.evaluate('window.__rollingModelId')!=ident:raise RuntimeError('Rolling version mismatch')
        predictions=page.evaluate("() => players.filter(p=>['G','F','C'].includes(p.pos)).map(p=>({name:p.name,team:p.team,opponent:model(p).match?.opponent,input:model(p).replayInput}))")
        browser.close()
    created=datetime.now(timezone.utc)
    for g in games:
        if created>=date(g['start'])-timedelta(minutes=10):continue
        selected=[p for p in predictions if canon(p['team']) in [g['home'],g['away']] and canon(p.get('opponent'))==(g['away'] if canon(p['team'])==g['home'] else g['home']) and (p.get('input') or {}).get('match',{}).get('home')==(canon(p['team'])==g['home']) and input_ok(p.get('input'),created,date(g['start']),g['gameCode'])]
        if not selected:print('Skipped missing complete inputs',g['gameCode']);continue
        path=OUT/f'input-snapshots/E2026-{g["gameCode"]}.json';old=load(path)
        if old:
            archive=OUT/f'input-snapshots/archive/E2026-{g["gameCode"]}-{old.get("engineId","old")}.json'
            if not archive.exists():save(archive,old)
        save(path,{'schema':'frozen-replay-input-v1','season':'E2026','created_at':created.isoformat(),'engineId':ident,'gameCode':g['gameCode'],'predictions':selected})
        print('Frozen complete replay inputs',g['gameCode'],len(selected))
finally:server.shutdown()
