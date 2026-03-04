import { useEffect, useState } from 'react'
import samplePortfolioCsv from '../assets/sample-dca-etfs.csv?raw'
import { CsvUploader } from '../components/CsvUploader'
import { FiltersPanel } from '../components/FiltersPanel'
import { PortfolioAllocationChart } from '../components/PortfolioAllocationChart'
import { PortfolioChart } from '../components/PortfolioChart'
import { StatusBanner } from '../components/StatusBanner'
import { TransactionsGrid } from '../components/TransactionsGrid'
import { USD_EUR_FX_SYMBOL } from '../domain/symbols'
import { getTransactionDateBounds } from '../domain/transactions'
import { useGoogleSheetPreview } from '../hooks/useGoogleSheetPreview'
import { usePortfolioValuation } from '../hooks/usePortfolioValuation'
import { usePriceHistory } from '../hooks/usePriceHistory'
import {
  DEFAULT_GOOGLE_SHEET_CSV_URL,
  usePriceSourceSettings,
} from '../hooks/usePriceSourceSettings'
import { useTransactions } from '../hooks/useTransactions'
import { downloadTextFile } from '../utils/csv-format'
import { todayIso } from '../utils/dates'

const defaultGoogleSheetSymbols = ['NYSEARCA:URTH', 'AMS:IMEU', 'EPA:C40'] as const

export default function App() {
  const {
    rows,
    rawCsv,
    isReady,
    isSaving,
    error,
    loadFromCache,
    importCsv,
    replaceRows,
    validation,
  } = useTransactions()
  const {
    googleSheetCsvUrl,
    isSaving: isPriceSourceSaving,
    error: priceSourceError,
    loadFromCache: loadPriceSourceFromCache,
    saveGoogleSheetCsvUrl,
  } = usePriceSourceSettings()

  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([])
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle')
  const [googleSheetUrlInput, setGoogleSheetUrlInput] = useState<string>()

  useEffect(() => {
    void loadFromCache()
  }, [loadFromCache])

  useEffect(() => {
    void loadPriceSourceFromCache()
  }, [loadPriceSourceFromCache])

  useEffect(() => {
    if (copyState === 'idle') {
      return
    }

    const timeoutId = window.setTimeout(() => {
      setCopyState('idle')
    }, 2200)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [copyState])

  const validTransactions = validation.validTransactions
  const invalidRowCount = Object.keys(validation.errorsById).length
  const availableAccounts = [...new Set(validTransactions.map((item) => item.account))]
    .filter(Boolean)
    .sort()
  const availableSymbols = [...new Set(validTransactions.map((item) => item.symbol))].sort()
  const transactionBounds = getTransactionDateBounds(validTransactions)
  const today = todayIso()
  const effectiveAccounts = syncSelection(selectedAccounts, availableAccounts)
  const effectiveStartDate = transactionBounds?.startDate
  const effectiveEndDate = transactionBounds ? today : undefined

  const priceHistory = usePriceHistory(
    validation.hasErrors ? [] : validTransactions,
    googleSheetCsvUrl,
  )
  const googleSheetPreview = useGoogleSheetPreview(googleSheetCsvUrl)

  const valuation = usePortfolioValuation({
    transactions: validation.hasErrors ? [] : validTransactions,
    priceHistoryBySymbol: priceHistory.priceHistoryBySymbol,
    filters: {
      accounts: effectiveAccounts,
      symbols: [],
      startDate: effectiveStartDate,
      endDate: effectiveEndDate,
    },
  })

  const googleSheetSymbols =
    availableSymbols.length > 0 ? availableSymbols : [...defaultGoogleSheetSymbols]
  const googleSheetStartDate = transactionBounds?.startDate ?? '2024-01-01'
  const googleSheetUrlValue = googleSheetUrlInput ?? googleSheetCsvUrl
  const googleSheetGrid = buildGoogleSheetGrid(googleSheetSymbols, googleSheetStartDate)
  const googleSheetGridTsv = googleSheetGrid.rows.map((row) => row.join('\t')).join('\n')

  async function copyGoogleSheetTemplate() {
    try {
      await navigator.clipboard.writeText(googleSheetGridTsv)
      setCopyState('copied')
    } catch {
      setCopyState('error')
    }
  }

  async function saveGoogleSheetUrl() {
    await saveGoogleSheetCsvUrl(googleSheetUrlValue)
    setGoogleSheetUrlInput(undefined)
  }

  function fetchMarketDataAgain() {
    priceHistory.refresh()
    googleSheetPreview.refresh()
  }

  return (
    <main className="app-shell">
      <section className="hero">
        <div className="hero__copy">
          <p className="eyebrow">Static Portfolio Tracker</p>
          <h1>Track how your assets compound through time.</h1>
          <p className="hero__lede">
            Upload your transaction ledger, edit it in the browser, and follow
            valuation and allocation history from your published market-data sheet.
          </p>
        </div>

        <div className="hero__actions">
          <CsvUploader
            onUpload={importCsv}
            onLoadSample={() => importCsv(samplePortfolioCsv)}
            disabled={isSaving}
          />
          <button
            type="button"
            className="button button--secondary"
            onClick={() =>
              downloadTextFile(
                'portfolio-transactions.csv',
                rawCsv || 'Date,Name,ISIN,Quantity,Price,Account,Comments\n',
              )
            }
            disabled={rows.length === 0}
          >
            Download CSV
          </button>
          <button
            type="button"
            className="button button--ghost"
            onClick={priceHistory.refresh}
            disabled={
              rows.length === 0 ||
              validation.hasErrors ||
              !googleSheetCsvUrl.trim()
            }
          >
            Refresh prices
          </button>
        </div>
      </section>

      <StatusBanner
        rowCount={rows.length}
        invalidRowCount={invalidRowCount}
        sourceConfigured={Boolean(googleSheetCsvUrl.trim())}
        symbolStatuses={priceHistory.symbolStatuses}
        isLoadingPrices={priceHistory.isLoading}
        appError={error ?? priceSourceError}
      />

      <section className="workspace-stack">
        <section className="workspace-overview">
          <FiltersPanel
            accounts={availableAccounts}
            selectedAccounts={effectiveAccounts}
            onAccountsChange={setSelectedAccounts}
            disabled={validation.hasErrors || !isReady}
          />
          <PortfolioAllocationChart valuation={valuation} />
        </section>
        <PortfolioChart valuation={valuation} />
        <TransactionsGrid
          rows={rows}
          errorsById={validation.errorsById}
          invalidRowCount={invalidRowCount}
          onRowsChange={replaceRows}
        />
      </section>

      <details className="panel advanced-panel advanced-panel--full-width">
        <summary className="advanced-panel__summary">
          <div>
            <p className="eyebrow">Advanced</p>
            <h2>Market data source</h2>
          </div>
          <span className="advanced-panel__hint">Configure the published sheet</span>
        </summary>

        <div className="advanced-panel__content">
          <div className="notes-panel">
            <p>
              Use a published Google Sheets CSV as the market-data source for this
              static site. Portfolio values are normalized to EUR, so USD-quoted
              symbols also need the <code>{USD_EUR_FX_SYMBOL}</code> block in the
              same published sheet. The shared default remains available if you do
              not override it.
            </p>
            <label className="notes-panel__field">
              <span>Published CSV URL</span>
              <input
                type="url"
                value={googleSheetUrlValue}
                onChange={(event) => setGoogleSheetUrlInput(event.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/e/.../pub?...&output=csv"
                spellCheck={false}
                autoComplete="off"
              />
            </label>
            <div className="notes-panel__actions">
              <button
                type="button"
                className="button button--secondary"
                onClick={() => {
                  void saveGoogleSheetUrl()
                }}
                disabled={
                  isPriceSourceSaving || googleSheetUrlValue.trim() === googleSheetCsvUrl
                }
              >
                {isPriceSourceSaving ? 'Saving…' : 'Save source URL'}
              </button>
              <button
                type="button"
                className="button button--ghost"
                onClick={() => setGoogleSheetUrlInput(DEFAULT_GOOGLE_SHEET_CSV_URL)}
                disabled={isPriceSourceSaving}
              >
                Reset default
              </button>
              <button
                type="button"
                className="button button--ghost"
                onClick={fetchMarketDataAgain}
                disabled={!googleSheetCsvUrl.trim() || googleSheetPreview.isLoading}
              >
                {googleSheetPreview.isLoading ? 'Fetching…' : 'Fetch again'}
              </button>
            </div>
            <p>
              Active source: <code>{googleSheetCsvUrl || 'Not set'}</code>
            </p>
          </div>

          <div className="notes-panel notes-panel--muted">
            <div className="panel__header panel__header--compact">
              <div>
                <p className="eyebrow">Helper</p>
                <h2>Starter sheet</h2>
              </div>
              <button
                type="button"
                className="button button--ghost notes-panel__copy"
                onClick={() => {
                  void copyGoogleSheetTemplate()
                }}
              >
                {copyState === 'copied'
                  ? 'Copied'
                  : copyState === 'error'
                    ? 'Clipboard blocked'
                    : 'Copy grid'}
              </button>
            </div>
            <p>
              Paste this into an empty Google Sheet at <code>A1</code> to create a
              weekly <code>GOOGLEFINANCE</code> layout with an appended live latest
              quote using your current symbols, then publish that sheet as CSV. Keep
              the{' '}
              <code>{USD_EUR_FX_SYMBOL}</code> block because USD holdings are
              converted to EUR from it.
            </p>
            <details className="notes-panel__expand">
              <summary>Preview grid</summary>
              <div
                className="notes-panel__table-wrap"
                role="region"
                aria-label="Google Sheets starter grid"
              >
                <table className="notes-panel__sheet">
                  <thead>
                    <tr>
                      <th scope="col" className="notes-panel__sheet-corner" />
                      {googleSheetGrid.columnLabels.map((label) => (
                        <th key={label} scope="col" className="notes-panel__sheet-col">
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {googleSheetGrid.rows.map((row, rowIndex) => (
                      <tr key={`sheet-row-${rowIndex + 1}`}>
                        <th scope="row" className="notes-panel__sheet-row">
                          {rowIndex + 1}
                        </th>
                        {row.map((cell, cellIndex) => (
                          <td key={`${rowIndex}-${cellIndex}`}>{cell}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </div>

          {googleSheetCsvUrl.trim() ? (
            <div className="notes-panel notes-panel--muted">
              <div className="panel__header panel__header--compact">
                <div>
                  <p className="eyebrow">Debug</p>
                  <h2>Published Grid Sample</h2>
                </div>
              </div>
              <p>
                Live sample loaded from the active source for debugging:
                <code>{googleSheetCsvUrl}</code>
              </p>
              {googleSheetPreview.isLoading ? <p>Loading published sheet sample…</p> : null}
              {googleSheetPreview.error ? (
                <p className="notes-panel__source-preview-error">
                  {googleSheetPreview.error}
                </p>
              ) : null}
              {googleSheetPreview.preview ? (
                <>
                  <div
                    className="notes-panel__table-wrap"
                    role="region"
                    aria-label="Published Google Sheets grid sample"
                  >
                  <table className="notes-panel__sheet notes-panel__sheet--debug">
                    <thead>
                      <tr>
                        <th scope="col" className="notes-panel__sheet-corner" />
                        {googleSheetPreview.preview.columnLabels.map((label) => (
                          <th
                            key={`preview-col-${label}`}
                            scope="col"
                            className="notes-panel__sheet-col"
                          >
                            {label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {googleSheetPreview.preview.rows.map((row, rowIndex) => (
                        <tr key={`preview-row-${rowIndex + 1}`}>
                          <th scope="row" className="notes-panel__sheet-row">
                            {rowIndex + 1}
                          </th>
                          {row.map((cell, cellIndex) => (
                            <td key={`preview-${rowIndex}-${cellIndex}`}>{cell}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                  <p className="notes-panel__source-preview-meta">
                    Showing the first {googleSheetPreview.preview.rows.length} rows and{' '}
                    {googleSheetPreview.preview.columnLabels.length} columns from the active
                    CSV.
                    {googleSheetPreview.preview.hasMoreRows ||
                    googleSheetPreview.preview.hasMoreColumns
                      ? ' Additional rows or columns are available in the source.'
                      : ''}
                  </p>
                </>
              ) : null}
            </div>
          ) : null}
        </div>
      </details>
    </main>
  )
}

function syncSelection(current: string[], available: string[]) {
  if (available.length === 0) {
    return []
  }

  if (current.length === 0) {
    return available
  }

  const next = current.filter((entry) => available.includes(entry))

  return next.length > 0 ? next : available
}

function buildGoogleSheetGrid(symbols: string[], startDate: string) {
  const sheetSymbols = [...symbols, USD_EUR_FX_SYMBOL]
  const totalColumns = Math.max(sheetSymbols.length * 2, 2)
  const rows = Array.from({ length: 4 }, () => Array.from({ length: totalColumns }, () => ''))

  rows[0][0] = 'Start date'
  rows[0][1] = startDate

  sheetSymbols.forEach((symbol, index) => {
    const columnIndex = index * 2
    const columnLabel = toSpreadsheetColumnLabel(columnIndex)

    rows[2][columnIndex] = symbol
    rows[3][columnIndex] = buildGoogleFinanceSheetFormula(columnLabel)
  })

  return {
    rows,
    columnLabels: Array.from({ length: totalColumns }, (_, index) =>
      toSpreadsheetColumnLabel(index),
    ),
  }
}

function buildGoogleFinanceSheetFormula(columnLabel: string) {
  return `={GOOGLEFINANCE(${columnLabel}3,"price",$B$1,TODAY(),"WEEKLY");IFERROR({TEXT(TODAY(),"dd/mm/yyyy"),GOOGLEFINANCE(${columnLabel}3,"price")},{})}`
}

function toSpreadsheetColumnLabel(index: number) {
  let current = index + 1
  let label = ''

  while (current > 0) {
    const remainder = (current - 1) % 26
    label = String.fromCharCode(65 + remainder) + label
    current = Math.floor((current - 1) / 26)
  }

  return label
}
