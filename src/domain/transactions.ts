import { z } from 'zod'
import { parseInputDateToIso } from '../utils/dates'
import { parseLocaleNumber } from '../utils/numbers'
import type {
  Transaction,
  TransactionCsvRow,
  TransactionValidationSummary,
} from '../types/transaction'

const transactionSchema = z.object({
  id: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  name: z.string().min(1, 'Name is required'),
  symbol: z.string().min(1, 'ISIN / symbol is required'),
  quantity: z.number().refine((value) => value !== 0, 'Quantity must be different from 0'),
  unitPrice: z.number().nonnegative('Price must be zero or greater'),
  account: z.string(),
  comments: z.string(),
})

export function validateTransactionRows(
  rows: TransactionCsvRow[],
): TransactionValidationSummary {
  const validTransactions: Transaction[] = []
  const errorsById: Record<string, string[]> = {}
  const duplicateGroups = new Map<string, string[]>()

  rows.forEach((row) => {
    const messages: string[] = []
    let parsedDate: string | undefined

    try {
      parsedDate = parseInputDateToIso(row.date)
    } catch (error) {
      messages.push(error instanceof Error ? error.message : 'Invalid date')
    }

    const quantity = parseLocaleNumber(row.quantity)
    const unitPrice = parseLocaleNumber(row.unitPrice)

    if (quantity === undefined) {
      messages.push('Quantity must be a number')
    }

    if (unitPrice === undefined) {
      messages.push('Price must be a number')
    }

    if (!row.currency?.trim()) {
      messages.push('Currency is required')
    }

    if (messages.length === 0 && parsedDate !== undefined) {
      const result = transactionSchema.safeParse({
        id: row.id,
        date: parsedDate,
        name: row.name.trim(),
        symbol: row.symbol.trim().toUpperCase(),
        quantity,
        unitPrice,
        account: row.account.trim(),
        comments: row.comments.trim(),
      })

      if (result.success) {
        validTransactions.push(result.data)

        const signature = buildTransactionSignature(
          result.data,
          row.currency.trim().toUpperCase(),
        )
        const existingRows = duplicateGroups.get(signature) ?? []
        duplicateGroups.set(signature, [...existingRows, row.id])
      } else {
        messages.push(...result.error.issues.map((issue) => issue.message))
      }
    }

    if (messages.length > 0) {
      errorsById[row.id] = messages
    }
  })

  duplicateGroups.forEach((rowIds) => {
    if (rowIds.length < 2) {
      return
    }

    rowIds.forEach((rowId) => {
      const current = errorsById[rowId] ?? []
      errorsById[rowId] = [...current, 'Duplicate transaction row']
    })
  })

  return {
    validTransactions,
    errorsById,
    hasErrors: Object.keys(errorsById).length > 0,
  }
}

export function getTransactionDateBounds(transactions: Transaction[]) {
  if (transactions.length === 0) {
    return undefined
  }

  const dates = transactions.map((transaction) => transaction.date).sort()

  return {
    startDate: dates[0],
    endDate: dates.at(-1) ?? dates[0],
  }
}

function buildTransactionSignature(
  transaction: Transaction,
  currency: string,
): string {
  return [
    transaction.date,
    transaction.name,
    transaction.symbol,
    transaction.quantity,
    transaction.unitPrice,
    currency,
    transaction.account,
    transaction.comments,
  ].join('|')
}
