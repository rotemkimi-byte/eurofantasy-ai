import unittest,sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
import fantasy_learning as learning
import test_rolling_learning

class AuditTests(unittest.TestCase):
    def row(self,minutes,pir):
        return learning.diagnosis(dict(baseMinutes=20,basePir=20,actualMinutes=minutes,actualPir=pir,servedPir=22))
    def test_round_eight_accuracy_threshold(self):
        for rnd,error,hit in [(7,5,True),(8,3,True),(8,-3,True),(8,3.01,False),(8,-4,False)]:
            r=learning.diagnosis(dict(round=rnd,baseMinutes=20,basePir=20,actualMinutes=20,actualPir=20+error,servedPir=20))
            self.assertEqual(r['outcome']!='miss',hit)
            self.assertEqual(learning.metrics([r])['hits'],int(hit))
    def test_error_decomposition(self):
        for minutes,pir in [(0,0),(10,-3),(30,20),(25,38)]:
            r=self.row(minutes,pir)
            self.assertAlmostEqual(r['minutesContribution']+r['efficiencyContribution'],r['error'])
    def test_lucky_hit_is_not_component_success(self):
        self.assertEqual(self.row(30,20)['outcome'],'offsetting-errors')
        self.assertEqual(self.row(21,22)['outcome'],'components-aligned')
        self.assertEqual(self.row(20,35)['outcome'],'miss')
    def test_served_forecast_is_scored_separately(self):
        r={**self.row(20,22),'round':1,'gameCode':1,'modelId':'test'}
        report=learning.round_reviews([r],{'1':{'round':1,'played':True},'2':{'round':1,'played':False}})[0]
        self.assertFalse(report['complete']);self.assertEqual(report['served']['mae'],0)
        self.assertEqual(report['baseline']['mae'],2);self.assertEqual(report['gradedGames'],1)
    def test_recent_regression_blocks_activation(self):
        rows=test_rolling_learning.RollingTests().sample()
        for r in rows:
            if r['gameCode']>=13:r['actualPir']=15
            learning.diagnosis(r)
        self.assertFalse(learning.validate(rows)['active'])
    def test_inactive_players_do_not_satisfy_sample_gate(self):
        rows=test_rolling_learning.RollingTests().sample()
        for r in rows:r['status']='out'
        self.assertEqual(learning.validate(rows)['n'],0)
if __name__=='__main__':unittest.main()
