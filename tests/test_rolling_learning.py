import unittest,sys
from pathlib import Path
from datetime import datetime,timezone,timedelta
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
import rolling_learning as rolling
import fantasy_learning as learning
import tempfile,shutil,json
from unittest.mock import patch
class RollingTests(unittest.TestCase):
    def sample(self):
        rows=[]
        for game in range(18):
            start=datetime(2026,9,1,tzinfo=timezone.utc)+timedelta(days=game)
            for i in range(12):
                rows.append(learning.diagnosis({'gameCode':game+1,'round':game+1,'start':start.isoformat(),'snapshotAt':(start-timedelta(hours=1)).isoformat(),'baseMinutes':20,'actualMinutes':20,'basePir':15,'actualPir':20,'servedPir':15,'pos':'G','status':'active'}))
        return rows
    def test_forward_improvement(self):
        v=rolling.validate(self.sample());self.assertTrue(v['active']);self.assertGreaterEqual(v['games'],6)
        self.assertLess(v['candidateMae'],v['baselineMae']);self.assertTrue(all(f['trainingGames']<f['gameCode'] for f in v['folds']))
    def test_no_improvement(self):
        rows=self.sample()
        for r in rows:r['actualPir']=15;learning.diagnosis(r)
        self.assertFalse(rolling.validate(rows)['active'])
    def test_snapshot_cutoff(self):
        rows=self.sample()
        for r in rows:r['snapshotAt']='2026-08-01T00:00:00+00:00'
        self.assertEqual(rolling.validate(rows)['n'],0)
    def test_input_guards(self):
        created=learning.date('2026-09-01T12:00:00Z');kick=created+timedelta(hours=1)
        a={'complete':True,'asOf':created.isoformat(),'player':{'name':'Test','team':'A','pos':'G','price':10},'context':{},'match':{},'contextData':{'schema':'matchup-context-v1','season':'E2026','updated_at':created.isoformat(),'players':{}}}
        self.assertTrue(rolling.input_ok(a,created,kick,9));self.assertFalse(rolling.input_ok(a,kick,kick,9))
        a['recent']={'gameLog':[{'gameCode':9,'date':'2026-08-01T00:00:00Z'}]};self.assertFalse(rolling.input_ok(a,created,kick,9))
        a['recent']={};a['complete']=False;self.assertFalse(rolling.input_ok(a,created,kick,9))
    def test_quantile(self):
        self.assertIsNone(rolling.quantile([]));self.assertEqual(rolling.quantile(list(range(10))),8)
    def test_partial_replay_cannot_activate(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory);out=root/'data/learning';out.mkdir(parents=True)
            for name in ['personal-model-core.js','matchup-context-core.js','personal-model.js','scripts/fantasy_learning.py','scripts/replay-engine.cjs','rolling-learning.js']:
                target=root/name;target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(rolling.ROOT/name,target)
            rows=self.sample();schedule={}
            for r in rows:
                r.update({'name':'Test','key':learning.key('Test'),'team':'A','opponent':'B','features':{}})
                schedule[str(r['gameCode'])]={'gameCode':r['gameCode']}
                learning.save(out/f'snapshots/E2026-{r["gameCode"]}.json',{'predictions':[{'name':'Test','team':'A','opponent':'B','pos':'G','price':10,'status':'active'}]})
            learning.save(out/'schedule.json',schedule)
            with patch.object(rolling,'ROOT',root),patch.object(rolling,'OUT',out),patch.object(learning,'collect',return_value=(rows,[])):
                rolling.build()
            report=json.loads((out/'rolling.json').read_text());self.assertEqual(report['exactCount'],0);self.assertEqual(report['diagnostic']['n'],len(rows));self.assertFalse(report['validation']['active']);self.assertFalse(report['interval']['active'])
if __name__=='__main__':unittest.main()
