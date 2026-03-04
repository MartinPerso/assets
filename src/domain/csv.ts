import Papa from 'papaparse'
import { CSV_HEADERS, rowsToCsvRecords } from '../utils/csv-format'
import type { TransactionCsvRow } from '../types/transaction'

type CsvRowRecord = Record<(typeof CSV_HEADERS)[number], string>

export function parseCsvContent(csvText: string): TransactionCsvRow[] {
  const parsed = Papa.parse<CsvRowRecord>(csvText, {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (header) => header.trim(),
  })

  if (parsed.errors.length > 0) {
    throw new Error(parsed.errors[0].message)
  }

  const fields = parsed.meta.fields ?? []
  const missingHeaders = CSV_HEADERS.filter((header) => !fields.includes(header))

  if (missingHeaders.length > 0) {
    throw new Error(
      `Missing CSV header(s): ${missingHeaders.join(', ')}. Expected ${CSV_HEADERS.join(', ')}.`,
    )
  }

  return parsed.data.map((row, index) => ({
    id: createRowId(index),
    date: row.Date?.trim() ?? '',
    name: row.Name?.trim() ?? '',
    symbol: row.ISIN?.trim() ?? '',
    quantity: row.Quantity?.trim() ?? '',
    unitPrice: row.Price?.trim() ?? '',
    account: row.Account?.trim() ?? '',
    comments: row.Comments?.trim() ?? '',
  }))
}

export function serializeCsv(rows: TransactionCsvRow[]): string {
  return Papa.unparse(rowsToCsvRecords(rows), {
    columns: [...CSV_HEADERS],
    newline: '\n',
  })
}

function createRowId(index: number): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return `row-${index}-${Math.random().toString(36).slice(2, 10)}`
}
