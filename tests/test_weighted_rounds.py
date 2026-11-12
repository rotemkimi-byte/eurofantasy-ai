import sys
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from weighted_rounds import build, game_rows


class WeightedRoundsTest(unittest.TestCase):
    def test_open_round_includes_only_completed_games(self):
        game = {'gameCode': 1, 'round': 11, 'played': True, 'start': '2026-11-11T19:00:00Z'}
        future = {**game, 'gameCode': 2, 'played': False}
        snapshot = {'algorithmSchema': 2, 'created_at': '2026-11-11T18:00:00Z'}
        with patch('weighted_rounds.load', return_value=snapshot) as load, \
                patch('pathlib.Path.exists', return_value=True), \
                patch('weighted_rounds.actuals', return_value={}), \
                patch('weighted_rounds.game_rows', return_value=[[3, 2, 1, [None] * 22]]):
            round_report = build({'1': game, '2': future})['rounds'][0]
        self.assertFalse(round_report['complete'])
        self.assertEqual(round_report['scheduled'], 2)
        self.assertEqual([g['gameCode'] for g in round_report['games']], [1])
        load.assert_called_once()

    def test_only_compatible_pregame_forecasts_join_results(self):
        game = {'gameCode': 1, 'start': '2026-11-11T19:00:00Z', 'home': 'Paris', 'away': 'ASVEL'}
        player = {
            'name': 'Test Player', 'team': 'Paris', 'opponent': 'ASVEL',
            'weightedForecast': {'base': 8, 'scale': 2.4, 'signals': [0.5] + [None] * 21}
        }
        snapshot = {
            'gameCode': 1, 'created_at': '2026-11-11T18:00:00Z', 'season': 'E2026',
            'algorithmSchema': 2, 'predictions': [player]
        }
        observed = {'player test': {'team': 'Paris', 'actualPir': -1}}
        self.assertEqual(game_rows(game, snapshot, observed), [[-1, 8.0, 2.4, player['weightedForecast']['signals']]])
        self.assertEqual(game_rows(game, {**snapshot, 'created_at': game['start']}, observed), [])
        self.assertEqual(game_rows(game, {**snapshot, 'algorithmSchema': 1}, observed), [])
        self.assertEqual(game_rows(game, {**snapshot, 'gameCode': 2}, observed), [])
        self.assertEqual(game_rows(game, snapshot, {'player test': {'team': 'ASVEL', 'actualPir': 1}}), [])


if __name__ == '__main__':
    unittest.main()
