# Static Portfolio Tracker

Static portfolio tracker built with React and Vite. The site runs entirely in the browser, reads historical prices from a published Google Sheets CSV, and can be deployed to GitHub Pages.

## Features

- upload a transaction CSV
- edit transactions directly in the browser
- download the updated CSV
- load price history from a published Google Sheets CSV
- compute daily portfolio valuation in EUR
- render valuation and allocation charts
- filter by account, asset, and date range
- keep transactions, market-data source settings, and downloaded prices in local browser storage for convenience

## CSV format

```csv
Date,Name,ISIN,Quantity,Price,Account,Comments
15/01/2024,iShares MSCI World ETF,NYSEARCA:URTH,12.253056,133.63,Demo CTO,Quarterly DCA demo - 1500 EUR contribution - USD/EUR 0.9161
```

Notes:

- `Date` uses `dd/MM/yyyy`
- `ISIN` is treated as a market symbol for v1, for example `NYSEARCA:URTH`, `AMS:IMEU`, or `EPA:C40`
- `Price` supports either `.` decimals or quoted `,` decimals

## Development

Use Node `22.12+` (Vite 7 requirement).

```bash
npm install
npm run dev
```

## Verification

```bash
npm run test
npm run build
```

## Deployment

This repo is configured for GitHub Pages project-site deployment at `https://martinperso.github.io/assets/`.

- Vite uses `base: '/assets/'`
- GitHub Actions workflow `.github/workflows/deploy.yml` builds and deploys on every push to `main`

No manual publish step is required after pushing to `main`.

## Market data source

The app expects a published Google Sheets CSV where symbols are arranged in repeating `Date` / `Close` column pairs.

You can:

- keep the default shared sheet URL
- override it in the app’s Advanced section
- use the built-in starter grid helper to generate a compatible Google Sheets layout

EUR is the reporting currency. EUR-quoted exchanges such as `AMS` and `EPA` are used as-is. USD-quoted exchanges such as `NYSEARCA` are converted to EUR through a `CURRENCY:USDEUR` block in the same published sheet.

Use a sheet formula that appends the live `GOOGLEFINANCE(symbol, "price")` quote after the weekly history block so the latest trading day can override the delayed weekly series in the published CSV.

Example sheet layout:

```csv
Start date,2024-01-01,,,,,,
,,,,,,,
AMS:IMEU,,EPA:C40,,NYSEARCA:URTH,,CURRENCY:USDEUR,
Date,Close,Date,Close,Date,Close,Date,Close
19/01/2024 17:40:00,29.24,19/01/2024 17:40:00,119.14,19/01/2024 16:00:00,133.63,20/01/2024 23:58:00,0.9161
27/02/2026 17:40:00,39.30,27/02/2026 17:40:00,148.80,27/02/2026 16:00:00,190.84,28/02/2026 23:58:00,0.8462
```

If you add symbols from other exchanges, the app will mark them as unsupported until a quote-currency mapping is defined.
