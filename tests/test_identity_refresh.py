import json,sys,tempfile,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from build_player_identities import build
from cache_official_boxes import restore

class IdentityRefresh(unittest.TestCase):
 def test_partial_cache_preserves_official_identity_and_rebuild_is_deterministic(self):
  with tempfile.TemporaryDirectory() as d:
   root=Path(d);(root/'data/backtest/cache').mkdir(parents=True)
   (root/'data/players.json').write_text(json.dumps([{'name':'New Player','fantasy_id':99999,'pos':'G','team':'Paris'}]))
   official={'season':'E2026','players':{'old-key':{'name':'NEW, PLAYER','playerCode':'099999','games':[{'gameCode':901,'team':'Paris'}]}}}
   (root/'data/official-offense.json').write_text(json.dumps(official))
   first=build(root);self.assertEqual(first['unresolved'],[]);self.assertEqual(first['players'][0]['euroleagueId'],'099999')
   def fetch(season,path):
    self.assertEqual((season,path),('E2026','games/901/stats'))
    return {'local':{'players':[{'player':{'person':{'code':'099999','name':'NEW, PLAYER'},'club':{'name':'Paris Basketball'}}}]},'road':{'players':[]}}
   self.assertEqual(restore(root,fetch),[901]);self.assertEqual(build(root),first)
   self.assertEqual(restore(root,lambda *_:self.fail('Existing evidence fetched twice')),[])
   self.assertEqual(build(root),first)
 def test_invalid_evidence_is_not_saved(self):
  with tempfile.TemporaryDirectory() as d:
   root=Path(d);(root/'data').mkdir();(root/'data/official-offense.json').write_text(json.dumps({'season':'E2026','players':{'p':{'games':[{'gameCode':901}]}}}))
   with self.assertRaises(ValueError):restore(root,lambda *_:{'error':'missing'})
   self.assertFalse((root/'data/backtest/cache/E2026-901-stats.json').exists())

if __name__=='__main__':unittest.main()
