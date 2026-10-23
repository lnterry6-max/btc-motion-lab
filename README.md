# Motion / BTC — historical Bitcoin research

A polished, static GitHub Pages website for analyzing Bitcoin's **past** 5, 15, 30, and 60-minute price movements. It shows historical movement sizes (percent and dollar equivalents), distributions, and honestly scored machine-learning **backtests**. **It does not produce current-market forecasts, trade recommendations, betting signals, or execute trades.**

![Static GitHub Pages](https://img.shields.io/badge/host-GitHub%20Pages-395a83) ![Python](https://img.shields.io/badge/analytics-Python-395a83)

## What it measures

- Completed BTC-USD 5-minute OHLCV candles for approximately the last 58 days, from Yahoo Finance via `yfinance`.
- Four forward historical horizons: 5, 15, 30, and 60 minutes.
- Percent of past samples up/down, median absolute change, signed 10th–90th percentiles, and 95th percentile of absolute change.
- **Illustrative dollar equivalent** = historical percentage movement × latest *observed* Bitcoin close. This is **not a current forecast**.
- A historical price chart, movement histogram, and replay of held-out model predictions versus actual observed changes.
- **Data quality:** reject inconsistent OHLC candles, count missing intervals, report coverage, longest gap, and candle age at build time.
- **Stability diagnostics:** compare older/newer historical movement magnitudes and examine three chronological holdout slices plus error on non-overlapping test targets. These are not independently retrained walk-forward models.
- A chronological train (first 60%), validation (next 20%), and untouched test (last 20%). Target horizons are purged at split boundaries to avoid future-target leakage. Model choice (Ridge vs gradient boosting) uses **only validation MAE**.
- Out-of-sample mean absolute error (in percentage points) compared with a simple **predict zero change** baseline, and direction accuracy compared with a **majority-class** baseline. Both positive and negative improvements are displayed transparently.

> **Limitations:** 5-minute Yahoo Finance history is restricted to about 60 days. There can be gaps, delayed prices, missing volume, and vendor failures. Returns are overlapping (and therefore correlated), and regimes change. A single train/test split cannot establish future predictive skill. Direction accuracy alone is not a strategy. This site intentionally has no live signals or buy/sell decisions. Data usage is subject to the upstream vendor's terms.

## Publish to GitHub Pages

1. On GitHub, create a **new public repository** named `btc-motion-lab`, with **no starter README** (the project already contains one). This keeps your existing projects untouched.
2. Upload **all** files and folders in this project to the repository root, including the hidden `.github/workflows/deploy.yml` workflow. Or push using Git (below).
3. In the repository open **Settings → Pages → Build and deployment → Source → GitHub Actions**.
4. Open **Actions → Update historical report and deploy → Run workflow**. If permissions or Pages are disabled on the repo, enable the necessary permissions and retry.
5. When the workflow finishes successfully, open `https://YOUR-USERNAME.github.io/btc-motion-lab/` (replace YOUR-USERNAME with your actual GitHub username).

The scheduled workflow attempts an update every six hours at minute 37. GitHub does **not** guarantee exact execution times. A failed market-data request fails the build rather than publishing made-up values. The last successful site remains deployed.

### Push with Git instead of uploading files

From the unzipped project folder:

```sh
git init
git add .
git commit -m "Initialize BTC historical research dashboard"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/btc-motion-lab.git
git push -u origin main
```

## Run locally

With Python 3.11+:

```sh
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python -m unittest discover -s tests -v
python scripts/build_report.py
python -m http.server 8000 --directory site
```

Browse <http://localhost:8000/>. The initial empty site displays an explicit waiting state until the JSON report is built. Do **not** double-click `index.html` for local preview because a `file://` origin cannot reliably fetch JSON.

You can also analyze your own CSV of historical completed 5-minute candles, with `Date,Open,High,Low,Close,Volume` columns in UTC:

```sh
python scripts/build_report.py --input-csv history.csv --output site/data/report.json
```

## Files

```
site/index.html          Static dashboard
site/styles.css          Responsive design
site/app.js              Charting + horizon interaction (no external JS dependencies)
site/data/report.json    Generated only by the backend; never committed
scripts/build_report.py  Historical statistics and out-of-sample research
.github/workflows/deploy.yml  Scheduled build + deploy
requirements.txt         Python analysis dependencies
tests/test_report.py     Offline tests including no-lookahead checks
```

## Interpretation

If a past 15-minute move had a 90th percentile of +0.4%, this means **90% of measured past 15-minute returns were at or below +0.4%** in this sample. It **does not** mean there is a 90% probability the next 15-minute move will be at or below +0.4%. Historical patterns and price references can become outdated.

This project is for learning data science and evaluating models, not financial, investment, or wagering advice.
## Interpreting the new quality checks

Data quality is measured when the static report is built; the browser does not turn it into a live feed. Any incomplete OHLC bar is excluded rather than silently used, and missing intervals stay missing. High model accuracy on one past segment can still fail to generalize. Sliced holdout diagnostics and spaced-out evaluation targets help reveal instability; neither predicts the next market move.
