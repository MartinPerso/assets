import { create } from 'zustand'
import { parseCsvContent, serializeCsv } from '../domain/csv'
import { validateTransactionRows } from '../domain/transactions'
import { transactionsRepo } from '../data/transactions-repo'
import type { TransactionCsvRow } from '../types/transaction'

type TransactionState = {
  rows: TransactionCsvRow[]
  rawCsv: string
  isReady: boolean
  isSaving: boolean
  error?: string
  loadFromCache: () => Promise<void>
  importCsv: (csvText: string) => Promise<void>
  replaceRows: (rows: TransactionCsvRow[]) => Promise<void>
}

const useTransactionsStore = create<TransactionState>((set) => ({
  rows: [],
  rawCsv: '',
  isReady: false,
  isSaving: false,

  async loadFromCache() {
    try {
      const cached = await transactionsRepo.load()
      const normalizedRows = cached.rows.map(normalizeRow)
      set({
        rows: normalizedRows,
        rawCsv: cached.rawCsv,
        isReady: true,
        error: undefined,
      })
    } catch (error) {
      set({
        isReady: true,
        error:
          error instanceof Error ? error.message : 'Unable to load saved transactions',
      })
    }
  },

  async importCsv(csvText) {
    set({ isSaving: true, error: undefined })

    try {
      const rows = parseCsvContent(csvText).map(normalizeRow)
      const validation = validateTransactionRows(rows)

      if (validation.hasErrors) {
        throw buildImportValidationError(rows, validation.errorsById)
      }

      await transactionsRepo.save(rows, csvText)

      set({
        rows,
        rawCsv: csvText,
        isReady: true,
        isSaving: false,
      })
    } catch (error) {
      set({
        isSaving: false,
        error: error instanceof Error ? error.message : 'Unable to import CSV',
      })
      throw error
    }
  },

  async replaceRows(rows) {
    const normalizedRows = rows.map(normalizeRow)
    set({ rows: normalizedRows, isSaving: true, error: undefined })

    try {
      const rawCsv = serializeCsv(normalizedRows)
      await transactionsRepo.save(normalizedRows, rawCsv)

      set({
        rows: normalizedRows,
        rawCsv,
        isSaving: false,
      })
    } catch (error) {
      set({
        isSaving: false,
        error: error instanceof Error ? error.message : 'Unable to save changes',
      })
    }
  },
}))

function normalizeRow(row: TransactionCsvRow): TransactionCsvRow {
  return {
    ...row,
    currency: row.currency?.trim().toUpperCase() || 'EUR',
  }
}

function buildImportValidationError(
  rows: TransactionCsvRow[],
  errorsById: Record<string, string[]>,
): Error {
  const rowIndexById = new Map(rows.map((row, index) => [row.id, index]))
  const [firstRowId, firstMessages = []] = Object.entries(errorsById)[0] ?? []
  const firstMessage = firstMessages[0] ?? 'Invalid CSV data'
  const firstRowIndex = rowIndexById.get(firstRowId)
  const csvLine = firstRowIndex === undefined ? undefined : firstRowIndex + 2
  const rowHint = csvLine ? ` at CSV line ${csvLine}` : ''
  const issueCount = Object.keys(errorsById).length

  return new Error(
    `CSV validation failed${rowHint}: ${firstMessage}. Found ${issueCount} invalid row(s).`,
  )
}

export function useTransactions() {
  const state = useTransactionsStore()
  const validation = validateTransactionRows(state.rows)

  return {
    ...state,
    validation,
  }
}
