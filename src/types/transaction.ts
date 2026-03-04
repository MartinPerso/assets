export type TransactionCsvRow = {
  id: string
  date: string
  name: string
  symbol: string
  quantity: string
  unitPrice: string
  account: string
  comments: string
  errorsSummary?: string
}

export type Transaction = {
  id: string
  date: string
  name: string
  symbol: string
  quantity: number
  unitPrice: number
  account: string
  comments: string
}

export type TransactionValidationSummary = {
  validTransactions: Transaction[]
  errorsById: Record<string, string[]>
  hasErrors: boolean
}
