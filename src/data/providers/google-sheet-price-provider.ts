import Papa from 'papaparse'
import { format, isValid, parse } from 'date-fns'
import {
  getQuoteCurrencyForSymbol,
  isFxSymbol,
  normalizeSymbol,
} from '../../domain/symbols'
import type { PricePoint } from '../../types/price'
import type { PriceProvider } from './price-provider'

const SHEET_PROVIDER_PREFIX = 'google-sheet-csv'
const IS_DEV = import.meta.env.DEV

export type GoogleSheetPreview = {
  rows: string[][]
  columnLabels: string[]
  hasMoreRows: boolean
  hasMoreColumns: boolean
}

export function createGoogleSheetPriceProvider(sheetCsvUrl: string): PriceProvider {
  const normalizedUrl = sheetCsvUrl.trim()
  const providerName = `${SHEET_PROVIDER_PREFIX}:${hashString(normalizedUrl)}:v2`
  let parsedHistoryPromise: Promise<Record<string, PricePoint[]>> | undefined

  return {
    name: providerName,
    version: '2',

    async getDailyHistory({ symbol, from, to }) {
      if (!normalizedUrl) {
        throw new Error('Add a published Google Sheets CSV URL to load market data.')
      }

      const historyBySymbol = await (parsedHistoryPromise ??=
        loadGoogleSheetHistory(normalizedUrl, providerName))
      const points = historyBySymbol[symbol] ?? []
      const filtered = points.filter((point) => point.date >= from && point.date <= to)

      if (filtered.length === 0) {
        logMissingSheetHistory({
          sheetCsvUrl: normalizedUrl,
          symbol,
          from,
          to,
          points,
          availableSymbols: Object.keys(historyBySymbol),
        })
        throw new Error(`No price history found for ${symbol} in the published sheet.`)
      }

      return filtered
    },
  }
}

export function parseGoogleSheetPriceCsv(csvText: string, providerName: string) {
  const rows = parseCsvRows(csvText)
  const symbolRow = rows[2] ?? []
  const headerRow = rows[3] ?? []
  const priceHistoryBySymbol: Record<string, PricePoint[]> = {}

  for (let columnIndex = 0; columnIndex < symbolRow.length; columnIndex += 2) {
    const symbol = normalizeSymbol(symbolRow[columnIndex] ?? '')

    if (!symbol) {
      continue
    }

    const dateHeader = headerRow[columnIndex]?.trim().toLowerCase()
    const closeHeader = headerRow[columnIndex + 1]?.trim().toLowerCase()

    if (dateHeader !== 'date' || closeHeader !== 'close') {
      continue
    }

    const points: PricePoint[] = []
    const currency = getCurrencyForSheetSymbol(symbol)

    if (!currency) {
      continue
    }

    for (let rowIndex = 4; rowIndex < rows.length; rowIndex += 1) {
      const rawDate = rows[rowIndex]?.[columnIndex]?.trim()
      const rawClose = rows[rowIndex]?.[columnIndex + 1]?.trim()

      if (!rawDate || !rawClose) {
        continue
      }

      const date = parseGoogleSheetDateToIso(rawDate)
      const close = Number(rawClose.replace(',', '.'))

      if (!date || !Number.isFinite(close) || close <= 0) {
        continue
      }

      points.push({
        provider: providerName,
        symbol,
        date,
        close,
        currency,
      })
    }

    if (points.length > 0) {
      priceHistoryBySymbol[symbol] = dedupePricePoints(points)
    }
  }

  return priceHistoryBySymbol
}

function getCurrencyForSheetSymbol(symbol: string) {
  if (isFxSymbol(symbol)) {
    return 'EUR' as const
  }

  try {
    return getQuoteCurrencyForSymbol(symbol)
  } catch {
    return undefined
  }
}

export function parseGoogleSheetPreviewCsv(
  csvText: string,
  limits: { maxRows?: number; maxColumns?: number } = {},
): GoogleSheetPreview {
  const maxRows = limits.maxRows ?? 6
  const maxColumns = limits.maxColumns ?? 6
  const rows = parseCsvRows(csvText)
  const previewRows = rows.slice(0, maxRows)
  const widestPreviewRow = previewRows.reduce(
    (maxWidth, row) => Math.max(maxWidth, row.length),
    0,
  )
  const previewColumnCount = Math.max(1, Math.min(maxColumns, widestPreviewRow))

  return {
    rows: previewRows.map((row) =>
      Array.from({ length: previewColumnCount }, (_, index) => row[index]?.trim() ?? ''),
    ),
    columnLabels: Array.from({ length: previewColumnCount }, (_, index) =>
      toSpreadsheetColumnLabel(index),
    ),
    hasMoreRows: rows.length > maxRows,
    hasMoreColumns: rows.some((row) => row.length > previewColumnCount),
  }
}

async function loadGoogleSheetHistory(sheetCsvUrl: string, providerName: string) {
  const response = await fetch(sheetCsvUrl, {
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new Error(`Unable to download the published Google Sheets CSV (${response.status}).`)
  }

  const csvText = await response.text()

  if (IS_DEV) {
    console.info('[prices] Downloaded published Google Sheet CSV', {
      providerName,
      sheetCsvUrl,
      bytes: csvText.length,
    })
  }

  return parseGoogleSheetPriceCsv(csvText, providerName)
}

function parseCsvRows(csvText: string) {
  const parsed = Papa.parse<string[]>(csvText, {
    skipEmptyLines: false,
  })

  if (parsed.errors.length > 0) {
    throw new Error(parsed.errors[0].message)
  }

  return parsed.data
}

function parseGoogleSheetDateToIso(value: string) {
  const trimmed = value.trim()
  const formats = ['dd/MM/yyyy HH:mm:ss', 'dd/MM/yyyy HH:mm', 'dd/MM/yyyy']

  for (const dateFormat of formats) {
    const parsed = parse(trimmed, dateFormat, new Date())

    if (isValid(parsed)) {
      return format(parsed, 'yyyy-MM-dd')
    }
  }

  return undefined
}

function dedupePricePoints(points: PricePoint[]) {
  const byDate = new Map<string, PricePoint>()

  points
    .sort((left, right) => left.date.localeCompare(right.date))
    .forEach((point) => {
      byDate.set(point.date, point)
    })

  return [...byDate.values()]
}

function hashString(value: string) {
  let hash = 0

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0
  }

  return hash.toString(36)
}

function logMissingSheetHistory(input: {
  sheetCsvUrl: string
  symbol: string
  from: string
  to: string
  points: PricePoint[]
  availableSymbols: string[]
}) {
  if (!IS_DEV) {
    return
  }

  const firstPoint = input.points[0]
  const lastPoint = input.points.at(-1)
  const matchingSymbols = input.availableSymbols.filter((entry) =>
    entry.includes(input.symbol.split(':').at(-1) ?? input.symbol),
  )

  console.groupCollapsed(`[prices] Missing sheet history for ${input.symbol}`)
  console.info('Requested window', {
    from: input.from,
    to: input.to,
  })
  console.info('Sheet source', input.sheetCsvUrl)
  console.info('Parsed symbols', {
    count: input.availableSymbols.length,
    sample: input.availableSymbols.slice(0, 20),
  })

  if (input.points.length > 0) {
    console.info('Symbol exists in parsed sheet but outside requested range', {
      points: input.points.length,
      firstDate: firstPoint?.date,
      lastDate: lastPoint?.date,
    })
  } else {
    console.info('Symbol not found in parsed sheet', {
      matchingSymbols,
    })
  }

  console.groupEnd()
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
