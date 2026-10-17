import importlib.util,itertools,unittest
from pathlib import Path
spec=importlib.util.spec_from_file_location('round_lab',Path(__file__).resolve().parents[1]/'scripts/round_lab.py');lab=importlib.util.module_from_spec(spec);spec.loader.exec_module(lab)

class RoundLabTest(unittest.TestCase):
 def sample(self):
  rows=[]
  for pos,count in [('G',5),('F',5),('C',3),('H',2)]:
   for i in range(count):rows.append({'id':f'{pos}{i}','pos':pos,'name':f'{pos} {i}','team':f'team {i%3}','price':4+i,'points':(i+1)*3+ord(pos)%5})
  return rows
 def test_exact_optimum_against_exhaustive_rosters(self):
  rows=self.sample();budget=65;best=-float('inf')
  groups={p:[r for r in rows if r['pos']==p] for p in ['G','F','C','H']}
  for gs,fs,cs,coach in itertools.product(itertools.combinations(groups['G'],4),itertools.combinations(groups['F'],4),itertools.combinations(groups['C'],2),groups['H']):
   roster=list(gs+fs+cs)
   if sum(p['price'] for p in roster)+coach['price']>budget:continue
   if any(sum(p['team']==club for p in roster+[coach])>6 for club in {p['team'] for p in roster+[coach]}):continue
   for starters in itertools.combinations(roster,5):
    counts=tuple(sum(p['pos']==pos for p in starters) for pos in ['G','F','C'])
    if counts not in lab.FORMATIONS:continue
    remaining=[p for p in roster if p not in starters]
    score=sum(p['points'] for p in starters)+max(p['points'] for p in starters)+coach['points']+.5*sum(p['points'] for p in remaining)+.5*max(p['points'] for p in remaining)
    best=max(best,score)
  out=lab.solve(rows,budget);self.assertEqual(out['status'],'optimal');self.assertAlmostEqual(out['score'],best)
  selected={p['id']:p for p in rows};self.assertEqual(len(out['roster']),11);self.assertEqual(len({r['id'] for r in out['roster']}),11)
  self.assertLessEqual(out['cost'],budget)
  for role,count in [('captain',1),('starter',4),('sixth',1),('bench',4),('coach',1)]:self.assertEqual(sum(r['role']==role for r in out['roster']),count)
 def test_infeasible_budget(self):self.assertEqual(lab.solve(self.sample(),10)['status'],'infeasible')
 def test_missing_coach(self):self.assertEqual(lab.solve([p for p in self.sample() if p['pos']!='H'])['status'],'unavailable')
 def test_name_matching(self):self.assertEqual(lab.name_key('VALANČIŪNAS, JONAS'),lab.name_key('Jonas Valanciunas'))
 def test_coach_boundaries(self):
  for margin,expected in [(1,10),(10,10),(11,20),(20,20),(21,25),(-1,-5),(-10,-5),(-11,-10),(-20,-10),(-21,-20)]:self.assertEqual(lab.coach_points(margin),expected)
  self.assertEqual(lab.coach_points(15,True),10);self.assertEqual(lab.coach_points(-15,True),-5)

if __name__=='__main__':unittest.main()
