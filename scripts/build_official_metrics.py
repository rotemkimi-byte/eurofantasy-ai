"""Derived metrics from the official EuroLeague v2 box scores only."""
import argparse
from datetime import datetime, timezone
from build_matchup_context import ROOT, load, save, number, key, team, stamp, api
SOURCE='https://api-live.euroleague.net/v2/competitions/E/seasons/E2026/'
METHOD='https://mediagamecenter.euroleague.net/'
FIELDS=['points','fieldGoalsAttempted2','fieldGoalsMade2','fieldGoalsAttempted3','fieldGoalsMade3','freeThrowsAttempted','freeThrowsMade','turnovers','assistances','valuation']

def metrics(stats, total, player_seconds, game_seconds):
    def v(k):return number(stats.get(k))
    def t(k):return number(total.get(k))
    a2,a3,m2,m3,ft,turns=v('fieldGoalsAttempted2'),v('fieldGoalsAttempted3'),v('fieldGoalsMade2'),v('fieldGoalsMade3'),v('freeThrowsAttempted'),v('turnovers')
    fga=a2+a3 if a2 is not None and a3 is not None else None
    team_values=[t('fieldGoalsAttempted2'),t('fieldGoalsAttempted3'),t('freeThrowsAttempted'),t('turnovers')]
    team_fga=sum(team_values[:2]) if all(x is not None for x in team_values[:2]) else None
    team_events=team_values[0]+team_values[1]+.44*team_values[2]+team_values[3] if all(x is not None for x in team_values) else None
    events=fga+.44*ft+turns if fga is not None and ft is not None and turns is not None else None
    exposure=team_events*player_seconds/game_seconds if team_events is not None and game_seconds and player_seconds is not None else None
    return {'fga':fga,'threeAttempts':a3,'twoAttempts':a2,'freeThrowAttempts':ft,'assists':v('assistances'),'turnovers':turns,
      'usagePct':100*events/exposure if exposure and events is not None else None,
      'usageEvents':events,'usageExposure':exposure,
      'shotSharePct':100*fga/team_fga if team_fga and fga is not None else None,
      'threeAttemptSharePct':100*a3/fga if fga and a3 is not None else None,
      'efgPct':100*(m2+1.5*m3)/fga if fga and m2 is not None and m3 is not None else None,
      'tsPct':100*v('points')/(2*(fga+.44*ft)) if fga is not None and ft is not None and fga+.44*ft>0 and v('points') is not None else None}

def build(root=ROOT,offline=False):
    warnings=[]
    payload=load(root/'data/context/E2026-schedule.json',{})
    if not offline:
        try:payload=api('E2026','games?limit=500')
        except Exception:warnings.append('Official schedule refresh failed; using cached official schedule')
    profiles={};now=datetime.now(timezone.utc)
    for g in payload.get('data',[]):
        date=stamp(g.get('utcDate'))
        if not g.get('played') or not date or date>=now or g.get('season',{}).get('code')!='E2026':continue
        code=int(g['gameCode']);path=root/f'data/backtest/cache/E2026-{code}-stats.json';box=load(path)
        if box is None and not offline:
            try:box=api('E2026',f'games/{code}/stats');save(path,box)
            except Exception:warnings.append(f'Missing official box score {code}');continue
        if not box:continue
        for side,other in [('local','road'),('road','local')]:
            part=box.get(side) or {};rows=part.get('players') or [];total=part.get('total') or {}
            seconds=[number((r.get('stats') or {}).get('timePlayed')) for r in rows]
            game_seconds=sum(seconds)/5 if seconds and all(n is not None and n>=0 for n in seconds) else None
            # Incomplete player minutes cannot support Usage, including overtime.
            if game_seconds is not None and (game_seconds<2400 or abs((game_seconds-2400)%300)>.01):game_seconds=None
            for r in rows:
                p=r.get('player') or {};person=p.get('person') or {};stats=r.get('stats') or {};name=person.get('name');secs=number(stats.get('timePlayed'))
                if not name or secs is None:continue
                club=team((g.get(side) or {}).get('club',{}).get('name'))
                profile=profiles.setdefault(key(name),{'name':name,'playerCode':person.get('code'),'games':[]})
                profile['games'].append({'gameCode':code,'date':date.isoformat(),'round':g.get('roundNumber') or (g.get('round') if isinstance(g.get('round'),int) else (g.get('round') or {}).get('round')),'team':club,
                  'opponent':team((g.get(other) or {}).get('club',{}).get('name')),'home':side=='local',
                  'position':p.get('position'),'positionName':p.get('positionName'),'minutes':secs/60,
                  'stats':{f:number(stats.get(f)) for f in FIELDS},'metrics':metrics(stats,total,secs,game_seconds),
                  'source':SOURCE+f'games/{code}/stats'})
    for p in profiles.values():p['games'].sort(key=lambda g:g['date'])
    if not profiles:raise RuntimeError('No official box scores; previous dataset preserved')
    result={'schema':'official-offense-v1','season':'E2026','updated_at':now.isoformat(),'source':SOURCE,'methodSource':METHOD,
      'method':'USG=100*(FGA+0.44*FTA+TO)/(playerSeconds/gameSeconds*(teamFGA+0.44*teamFTA+teamTO)); eFG=100*(2PM+1.5*3PM)/FGA; TS=100*PTS/(2*(FGA+0.44*FTA))',
      'players':profiles,'warnings':warnings}
    save(root/'data/official-offense.json',result);print(f'Official offense: {len(profiles)} players; {sum(len(p["games"]) for p in profiles.values())} player games')
    return result

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--offline',action='store_true');args=parser.parse_args();build(offline=args.offline)
