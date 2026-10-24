import sys,unittest
from datetime import datetime,timezone
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from build_official_metrics import team_results,standings_rows
class TeamExport(unittest.TestCase):
 def test_nested_official_standings(self):
  rows=standings_rows({'data':[{'standings':[{'position':'2','club':{'name':'FC Barcelona'}}]}]})
  self.assertEqual(rows,[{'team':'Barcelona','rank':2}])
  self.assertEqual(standings_rows({'data':[{'position':0,'club':{'name':'Unknown'}}]}),[])
 def test_finished_regular_season_only(self):
  base={'gameCode':1,'played':True,'utcDate':'2026-10-01T18:00:00Z','season':{'code':'E2026'},'phaseType':{'code':'RS'},'round':1,'local':{'club':{'name':'Paris Basketball'},'score':80,'standingsScore':75},'road':{'club':{'name':'FC Barcelona'},'score':78,'standingsScore':75}}
  payload={'data':[base,{**base,'gameCode':2,'played':False},{**base,'gameCode':3,'season':{'code':'E2025'}},{**base,'gameCode':4,'utcDate':'2099-01-01T12:00:00Z'},{**base,'gameCode':5,'phaseType':{'code':'PO'}}]}
  rows=team_results(payload,datetime(2026,10,24,tzinfo=timezone.utc));self.assertEqual(len(rows),1);self.assertEqual(rows[0]['home'],'Paris');self.assertEqual(rows[0]['homeScore'],80);self.assertEqual(rows[0]['homeStandingsScore'],75)
if __name__=='__main__':unittest.main()
