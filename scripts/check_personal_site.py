"""Browser integration check: site and backtest core must agree on every player."""
import json
import subprocess
import threading
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from playwright.sync_api import sync_playwright
from fantasy_learning import ROOT

class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass

expected = json.loads(subprocess.check_output(['node', 'scripts/forecast_players.cjs'], cwd=ROOT, text=True))
server = ThreadingHTTPServer(('127.0.0.1', 0), partial(QuietHandler, directory=str(ROOT)))
threading.Thread(target=server.serve_forever, daemon=True).start()
try:
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True)
        page = browser.new_page()
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.route('https://**/*', lambda route: route.abort())
        page.goto(f'http://127.0.0.1:{server.server_port}/index.html', wait_until='networkidle')
        page.wait_for_function('window.__personalModelReady && window.__stabilityModelPatched && window.__learningReady', timeout=60000)
        actual = page.evaluate("() => players.filter(p=>['G','F','C'].includes(p.pos)).map(p=>{const x=model(p);return {name:p.name,expectedPir:x.expected,expectedMinutes:x.minutes,personal:x.personalModel};})")
        by_name = {p['name']: p for p in actual}
        for p in expected['predictions']:
            a = by_name[p['name']]
            assert a['personal'], p['name']
            assert abs(a['expectedPir'] - p['expectedPir']) < 1e-7, (p['name'], a, p)
            assert abs(a['expectedMinutes'] - p['expectedMinutes']) < 1e-7, (p['name'], a, p)
        assert not errors, errors
        page.evaluate("showPlayer('Elijah Bryant')")
        # Historical metrics live inside a collapsed details section.
        # Open it before testing visible text; inner_text excludes hidden content.
        details = page.locator('#modalBody .forecast-results details.secondaryDetails')
        details.locator('summary').click()
        assert details.evaluate('(el) => el.open'), 'Forecast details did not open'
        page.wait_for_function("document.querySelector('#modalBody').innerText.includes('בסיס אישי 2025/26')", timeout=10000)
        browser.close()
    print(f'Browser model matches shared backtest core for {len(actual)} players')
finally:
    server.shutdown()
