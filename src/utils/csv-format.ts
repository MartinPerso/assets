import { formatIsoToInputDate } from './dates'
import { formatDecimal } from './numbers'
import type { TransactionCsvRow } from '../types/transaction'

export const CSV_HEADERS = [
  'Date',
  'Name',
  'ISIN',
  'Quantity',
  'Price',
  'Account',
  'Comments',
] as const

export function rowsToCsvRecords(rows: TransactionCsvRow[]) {
  return rows.map((row) => ({
    Date: formatMaybeIsoDate(row.date),
    Name: row.name.trim(),
    ISIN: row.symbol.trim(),
    Quantity: row.quantity.trim(),
    Price: row.unitPrice.trim(),
    Account: row.account.trim(),
    Comments: row.comments.trim(),
  }))
}

export function formatMaybeIsoDate(value: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? formatIsoToInputDate(value)
    : value.trim()
}

export function formatNumberForCsv(value: number): string {
  return formatDecimal(value, 6)
}

export function downloadTextFile(filename: string, contents: string) {
  const blob = new Blob([contents], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')

  anchor.href = url
  anchor.download = filename
  anchor.click()

  URL.revokeObjectURL(url)
}
