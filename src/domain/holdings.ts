import { eachIsoDay } from '../utils/dates'
import type { Transaction } from '../types/transaction'

export type DailyHoldingsPoint = {
  date: string
  quantities: Record<string, number>
}

export function buildDailyHoldings(
  transactions: Transaction[],
  startDate: string,
  endDate: string,
): DailyHoldingsPoint[] {
  const days = eachIsoDay(startDate, endDate)
  const sortedTransactions = [...transactions].sort((left, right) =>
    left.date.localeCompare(right.date),
  )

  const runningHoldings = new Map<string, number>()
  let transactionIndex = 0

  return days.map((date) => {
    while (
      transactionIndex < sortedTransactions.length &&
      sortedTransactions[transactionIndex].date <= date
    ) {
      const transaction = sortedTransactions[transactionIndex]
      runningHoldings.set(
        transaction.symbol,
        (runningHoldings.get(transaction.symbol) ?? 0) + transaction.quantity,
      )
      transactionIndex += 1
    }

    return {
      date,
      quantities: Object.fromEntries(runningHoldings.entries()),
    }
  })
}
