import type { SymbolPriceStatus } from '../types/price'

type StatusBannerProps = {
  rowCount: number
  invalidRowCount: number
  sourceConfigured: boolean
  symbolStatuses: SymbolPriceStatus[]
  isLoadingPrices: boolean
  appError?: string
}

export function StatusBanner({
  rowCount,
  invalidRowCount,
  sourceConfigured,
  symbolStatuses,
  isLoadingPrices,
  appError,
}: StatusBannerProps) {
  const hasRows = rowCount > 0
  const hasSymbolError = symbolStatuses.some((status) => status.state === 'error')

  return (
    <section className="status-strip">
      <div className="status-card">
        <span className="status-card__label">Portfolio</span>
        <strong>{hasRows ? 'Portfolio loaded' : 'No portfolio yet'}</strong>
        <span className="status-card__meta">
          {hasRows
            ? `${rowCount} transaction${rowCount === 1 ? '' : 's'} ready to chart.`
            : 'Upload a CSV or load the sample portfolio to begin.'}
        </span>
      </div>
      <div className="status-card">
        <span className="status-card__label">Market data</span>
        <strong>
          {getMarketDataTitle({
            sourceConfigured,
            isLoadingPrices,
            hasRows,
            hasSymbolError,
            symbolStatuses,
          })}
        </strong>
        <span className="status-card__meta">
          {getMarketDataMeta({
            sourceConfigured,
            hasRows,
            symbolStatuses,
          })}
        </span>
      </div>
      {invalidRowCount > 0 ? (
        <p className="status-strip__warning">
          {invalidRowCount} row{invalidRowCount === 1 ? '' : 's'} need attention before charts can update.
        </p>
      ) : null}
      {appError ? <p className="status-strip__error">{appError}</p> : null}
    </section>
  )
}

function getMarketDataTitle(input: {
  sourceConfigured: boolean
  isLoadingPrices: boolean
  hasRows: boolean
  hasSymbolError: boolean
  symbolStatuses: SymbolPriceStatus[]
}) {
  if (!input.sourceConfigured) {
    return 'Source missing'
  }

  if (input.isLoadingPrices) {
    return 'Updating prices'
  }

  if (input.hasSymbolError) {
    return 'Refresh issue'
  }

  if (input.symbolStatuses.length > 0) {
    return 'Source ready'
  }

  return input.hasRows ? 'Waiting for pricing' : 'Waiting for portfolio'
}

function getMarketDataMeta(input: {
  sourceConfigured: boolean
  hasRows: boolean
  symbolStatuses: SymbolPriceStatus[]
}) {
  if (!input.sourceConfigured) {
    return 'Add the published Google Sheets CSV URL in Advanced settings.'
  }

  if (!input.hasRows) {
    return 'Market data will load once a portfolio is available.'
  }

  if (input.symbolStatuses.length === 0) {
    return 'Upload valid transactions to request history from the sheet.'
  }

  return summarizeSymbolStatuses(input.symbolStatuses)
}

function summarizeSymbolStatuses(symbolStatuses: SymbolPriceStatus[]) {
  const readyCount = symbolStatuses.filter((status) => status.state === 'ready').length
  const loadingCount = symbolStatuses.filter((status) => status.state === 'loading').length
  const errorStatuses = symbolStatuses.filter((status) => status.state === 'error')
  const missingInSheet = errorStatuses.filter((status) =>
    status.message?.includes('No price history found'),
  )
  const otherErrors = errorStatuses.filter(
    (status) => !status.message?.includes('No price history found'),
  )
  const parts: string[] = []

  if (readyCount > 0) {
    parts.push(`${readyCount} symbol${readyCount === 1 ? '' : 's'} ready`)
  }

  if (missingInSheet.length > 0) {
    const sample = missingInSheet
      .slice(0, 3)
      .map((status) => status.symbol)
      .join(', ')
    const remainder = missingInSheet.length - Math.min(missingInSheet.length, 3)

    parts.push(
      `${missingInSheet.length} missing from the sheet${sample ? ` (${sample}${remainder > 0 ? ` +${remainder} more` : ''})` : ''}`,
    )
  }

  if (otherErrors.length > 0) {
    parts.push(
      `${otherErrors.length} update error${otherErrors.length === 1 ? '' : 's'}`,
    )
  }

  if (loadingCount > 0) {
    parts.push(`${loadingCount} loading`)
  }

  if (parts.length === 0) {
    return 'Prices are available from the published sheet.'
  }

  if (errorStatuses.length > 0) {
    parts.push('Saved local prices stay in use when updates are missing.')
  }

  return parts.join(' • ')
}
