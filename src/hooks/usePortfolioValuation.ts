import { useDeferredValue } from 'react'
import { computePortfolioValuation } from '../domain/valuation'
import type { PortfolioFilters } from '../types/portfolio'
import type { PricePoint } from '../types/price'
import type { Transaction } from '../types/transaction'

export function usePortfolioValuation(input: {
  transactions: Transaction[]
  priceHistoryBySymbol: Record<string, PricePoint[]>
  filters: PortfolioFilters
}) {
  const deferredTransactions = useDeferredValue(input.transactions)

  return computePortfolioValuation({
    transactions: deferredTransactions,
    priceHistoryBySymbol: input.priceHistoryBySymbol,
    filters: input.filters,
  })
}
