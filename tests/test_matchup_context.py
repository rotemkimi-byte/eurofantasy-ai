import sys, unittest, tempfile, json
from pathlib import Path
from datetime import timedelta
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
import build_matchup_context as m

class ContextTests(unittest.TestCase):
 def test_hard_games_use_only_prior_results(self):
  base={'season':'E2026','home':'A','away':'B','homeScore':120,'awayScore':60}
  games=[{**base,'gameCode':i,'start':f'2026-09-{i+1:02d}T12:00:00+00:00'} for i in range(6)]
  _,r=m.strength_history(games)
  _,past=m.strength_history(games[:3])
  self.assertEqual(r['B'][:3],past['B'])
  self.assertTrue(any(g['hard'] for g in r['B']))
  self.assertEqual(r['A'][0]['pregameWinProb'],round(m.sigmoid(3.2/7.2),5))
 def test_calibration_waits_and_rejects_no_gain(self):
  self.assertFalse(m.calibrate([])['active'])
  rows=[{'date':f'2026-01-{i//8+1:02d}','rawProb':.5,'logit':0,'won':i%2} for i in range(160)]
  r=m.calibrate(rows)
  self.assertFalse(r['active'])
  self.assertGreaterEqual(r['validationN'],30)
  self.assertEqual(sum(b['n'] for b in r['bins']),160)
 def test_calibration_can_validate_overconfidence(self):
  rows=[{'date':f'2026-01-{i//10+1:02d}','rawProb':.9,'logit':m.math.log(9),'won':int(i%10<6)} for i in range(200)]
  r=m.calibrate(rows)
  self.assertTrue(r['active'])
  self.assertLess(r['candidateBrier'],r['baselineBrier']*.98)
 def test_availability_not_assumed_active(self):
  roster=[{'name':'X','team':'A','pos':'C','price':18,'status':'out'},{'name':'Y','team':'A','pos':'G','price':18,'status':'questionable','probability_of_playing':1}]
  a=m.availability(roster,{},'A')
  self.assertGreater(a['marginPenalty'],0);self.assertLessEqual(a['marginPenalty'],3)
  self.assertEqual(a['missing'][1]['impactProxy'],0)
 def test_box_stats_real_and_missing_distinct(self):
  root=Path(__file__).resolve().parents[1]
  fixture=m.load(root/'data/backtest/cache/E2026-40-stats.json')
  roster=[{'name':'Sasha Vezenkov','team':'Olympiacos','pos':'F'}]
  game={'season':'E2026','gameCode':40,'start':'2026-10-09T18:15:00+00:00','home':'Olympiacos','away':'Anadolu Efes','homeScore':89,'awayScore':66}
  profiles,allowed,league=m.player_context([game],{40:fixture},roster)
  p=profiles[m.key('Sasha Vezenkov')]
  self.assertEqual(p['averages']['valuation'],7)
  self.assertEqual(p['averages']['points'],9)
  self.assertEqual(p['averages']['assistances'],0)
  self.assertAlmostEqual(p['avgMinutes'],21.7)
  self.assertEqual(p['averages']['fieldGoalsAttempted2'],5)
  self.assertEqual(allowed['Anadolu Efes']['attempts2'],47)
  self.assertGreater(league['rate2'],0)
  for row in fixture['local']['players']:row['stats'].pop('fieldGoalsMade2',None)
  _,allowed,_=m.player_context([game],{40:fixture},roster)
  self.assertNotIn('Anadolu Efes',allowed)
 def test_no_postgame_snapshot_or_overwrite(self):
  with tempfile.TemporaryDirectory() as d:
   root=Path(d);future=m.NOW+timedelta(hours=2);past=m.NOW-timedelta(days=1)
   games=[{'gameCode':1,'played':True,'utcDate':past.isoformat(),'local':{'club':{'name':'A'},'score':90},'road':{'club':{'name':'B'},'score':80}}]
   stats={k:0 for k in m.STAT_FIELDS};stats.update(timePlayed=1200,valuation=10,fieldGoalsAttempted2=5,fieldGoalsMade2=3)
   box={'local':{'players':[{'player':{'person':{'name':'X'}},'stats':stats}]},'road':{'players':[{'player':{'person':{'name':'Y'}},'stats':stats}]}}
   for path,obj in [('data/context/E2026-schedule.json',{'data':games}),('data/context/E2025-schedule.json',{'data':[]}),('data/players.json',[{'name':'X','team':'A','pos':'C','status':'active','price':10},{'name':'Y','team':'B','pos':'C','status':'active','price':10}]),('data/backtest/cache/E2026-1-stats.json',box),('data/matchups.json',{'matchups':{'A':{'opponent':'B','home':True,'margin':3},'B':{'opponent':'A','home':False,'margin':-3}}}),('data/learning/schedule.json',{'1':{'gameCode':1,'home':'A','away':'B','played':True,'start':past.isoformat()},'2':{'gameCode':2,'home':'A','away':'B','played':False,'start':future.isoformat()}})]:m.save(root/path,obj)
   j=m.build(root,offline=True)
   self.assertAlmostEqual(j['teams']['A']['winProb']+j['teams']['B']['winProb'],1)
   snaps=root/'data/context/team-snapshots';self.assertFalse((snaps/'E2026-1.json').exists())
   before=(snaps/'E2026-2.json').read_bytes();m.build(root,offline=True);self.assertEqual(before,(snaps/'E2026-2.json').read_bytes())

if __name__=='__main__':unittest.main()
