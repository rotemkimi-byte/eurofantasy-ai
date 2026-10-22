import sys, unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from build_official_metrics import metrics
class OfficialMetrics(unittest.TestCase):
 def setUp(self):
  self.p={'points':12,'fieldGoalsAttempted2':10,'fieldGoalsMade2':3,'fieldGoalsAttempted3':4,'fieldGoalsMade3':2,'freeThrowsAttempted':0,'turnovers':2}
  self.t={'fieldGoalsAttempted2':50,'fieldGoalsAttempted3':21,'freeThrowsAttempted':20,'turnovers':9}
 def test_official_formula(self):
  x=metrics(self.p,self.t,1462,2400)
  self.assertEqual(x['fga'],14);self.assertEqual(x['threeAttempts'],4)
  self.assertAlmostEqual(x['usagePct'],100*16/(1462/2400*(71+.44*20+9)))
  self.assertAlmostEqual(x['efgPct'],100*6/14)
 def test_missing_and_zero_are_distinct(self):
  p={**self.p,'freeThrowsAttempted':None}
  x=metrics(p,self.t,1462,2400)
  self.assertIsNone(x['usagePct']);self.assertIsNone(x['tsPct']);self.assertEqual(x['fga'],14)
  self.assertIsNone(metrics(self.p,self.t,0,2400)['usagePct'])
 def test_overtime_and_incomplete_minutes(self):
  self.assertGreater(metrics(self.p,self.t,1462,2700)['usagePct'],metrics(self.p,self.t,1462,2400)['usagePct'])
  self.assertIsNone(metrics(self.p,self.t,1462,None)['usagePct'])
if __name__=='__main__':unittest.main()
