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
      set({
        rows: cached.rows,
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
      const rows = parseCsvContent(csvText)
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
    set({ rows, isSaving: true, error: undefined })

    try {
      const rawCsv = serializeCsv(rows)
      await transactionsRepo.save(rows, rawCsv)

      set({
        rows,
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

export function useTransactions() {
  const state = useTransactionsStore()
  const validation = validateTransactionRows(state.rows)

  return {
    ...state,
    validation,
  }
}
