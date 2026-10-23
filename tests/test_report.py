import sys
import unittest
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from build_report import build_report, clean_candles, indicators


class HistoricalReportTests(unittest.TestCase):
    def setUp(self):
        rng = np.random.default_rng(12)
        index = pd.date_range('2025-01-01', periods=1800, freq='5min', tz='UTC')
        close = 70000 * np.exp(np.cumsum(rng.normal(0, 0.001, len(index))))
        self.raw = pd.DataFrame({
            'Open': close, 'High': close * 1.0005,
            'Low': close * 0.9995, 'Close': close,
            'Volume': rng.uniform(1, 10, len(index)),
        }, index=index)
        self.now = index[-1] + pd.Timedelta(minutes=6)

    def test_complete_candles_and_missing_bars(self):
        data = self.raw.drop(self.raw.index[150])
        clean = clean_candles(data, self.now)
        self.assertTrue(pd.isna(clean.loc[self.raw.index[150], 'Close']))
        self.assertEqual(len(clean), 1800)
        self.assertTrue(clean['Close'].index.is_monotonic_increasing)

    def test_future_candles_excluded(self):
        clean = clean_candles(self.raw, self.raw.index[-1] + pd.Timedelta(minutes=2))
        self.assertEqual(len(clean), 1799)

    def test_report_uses_historical_windows_and_purges_boundaries(self):
        clean = clean_candles(self.raw, self.now)
        report = build_report(clean)
        self.assertEqual(set(report['horizons']), {'5', '15', '30', '60'})
        self.assertEqual(report['report_type'], 'historical_backtest_only')
        self.assertEqual(report['horizons']['5']['distribution']['samples'], 1799)
        self.assertEqual(report['horizons']['60']['distribution']['samples'], 1788)
        for h, data in report['horizons'].items():
            b = data['backtest']
            self.assertEqual(b['status'], 'ok')
            self.assertGreater(b['holdout_sample_count'], 100)
            self.assertGreater(b['holdout_start_utc'], report['data_start_utc'])
            self.assertIn('model_mae_pct_points', b)
            self.assertIn('zero_move_baseline_mae_pct_points', b)
            self.assertGreater(len(b['replay']), 0)

    def test_features_do_not_consume_future(self):
        first = indicators(self.raw)
        edited = self.raw.copy()
        edited.loc[edited.index[-10:], 'Close'] *= 2
        second = indicators(edited)
        pd.testing.assert_frame_equal(first.iloc[:-11], second.iloc[:-11])


if __name__ == '__main__':
    unittest.main()
