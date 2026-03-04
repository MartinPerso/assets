import {
  getQuoteCurrencyForSymbol,
  isFxSymbol,
  USD_EUR_FX_SYMBOL,
} from './symbols'
import { eachIsoDay, todayIso } from '../utils/dates'
import type { PortfolioComputation, PortfolioFilters } from '../types/portfolio'
import type { PricePoint } from '../types/price'
import type { Transaction } from '../types/transaction'

type PriceHistoryBySymbol = Record<string, PricePoint[]>
type PositionState = {
  quantity: number
  investedAmount: number
  investedAmountOriginal: number
}

export function computePortfolioValuation(input: {
  transactions: Transaction[]
  priceHistoryBySymbol: PriceHistoryBySymbol
  filters: PortfolioFilters
}): PortfolioComputation {
  const transactions = input.transactions.filter((transaction) => {
    const accountMatch =
      input.filters.accounts.length === 0 ||
      input.filters.accounts.includes(transaction.account)
    const symbolMatch =
      input.filters.symbols.length === 0 ||
      input.filters.symbols.includes(transaction.symbol)

    return accountMatch && symbolMatch
  })

  if (transactions.length === 0) {
    return {
      points: [],
      assetSeries: {},
      assetNames: {},
    }
  }

  const sortedTransactions = [...transactions].sort((left, right) =>
    left.date.localeCompare(right.date),
  )

  const startDate = input.filters.startDate ?? sortedTransactions[0].date
  const endDate = input.filters.endDate ?? todayIso()
  const days = eachIsoDay(startDate, endDate)
  const assetNames = Object.fromEntries(
    sortedTransactions.map((transaction) => [transaction.symbol, transaction.name]),
  )
  const symbols = [...new Set(sortedTransactions.map((transaction) => transaction.symbol))]
  const assetSeries: PortfolioComputation['assetSeries'] = {}
  const pricePointers = new Map<string, number>()
  const lastKnownClose = new Map<string, number>()
  let usdEurRate: number | undefined
  const sortedPriceHistory = Object.fromEntries(
    Object.entries(input.priceHistoryBySymbol).map(([symbol, points]) => [
      symbol,
      [...points].sort((left, right) => left.date.localeCompare(right.date)),
    ]),
  )
  const fxPoints = sortedPriceHistory[USD_EUR_FX_SYMBOL] ?? []
  const positionStateBySymbol = new Map<string, PositionState>()
  let transactionIndex = 0

  const points = days.map((date) => {
    let totalValue = 0
    const bySymbol: Record<string, number> = {}

    let fxIndex = pricePointers.get(USD_EUR_FX_SYMBOL) ?? 0

    while (fxIndex < fxPoints.length && fxPoints[fxIndex].date <= date) {
      usdEurRate = fxPoints[fxIndex].close
      fxIndex += 1
    }

    pricePointers.set(USD_EUR_FX_SYMBOL, fxIndex)

    while (
      transactionIndex < sortedTransactions.length &&
      sortedTransactions[transactionIndex].date <= date
    ) {
      const transaction = sortedTransactions[transactionIndex]
      const currentState =
        positionStateBySymbol.get(transaction.symbol) ?? createEmptyPositionState()

      applyTransaction(currentState, transaction, {
        unitPriceInEur: getTransactionUnitPriceInEur(
          transaction,
          usdEurRate,
          fxPoints,
        ),
      })

      positionStateBySymbol.set(transaction.symbol, currentState)
      transactionIndex += 1
    }

    symbols.forEach((symbol) => {
      const positionState = positionStateBySymbol.get(symbol) ?? createEmptyPositionState()
      const quantityHeld = positionState.quantity
      const pricePoints = sortedPriceHistory[symbol] ?? []
      let priceIndex = pricePointers.get(symbol) ?? 0

      while (
        priceIndex < pricePoints.length &&
        pricePoints[priceIndex].date <= date
      ) {
        lastKnownClose.set(symbol, pricePoints[priceIndex].close)
        priceIndex += 1
      }

      pricePointers.set(symbol, priceIndex)

      const originalClose = lastKnownClose.get(symbol)
      const close = getEffectiveCloseInEur(
        symbol,
        originalClose,
        usdEurRate,
      )
      const originalCurrency = getOriginalCurrency(symbol)
      const investedAmount = quantityHeld > 0 ? positionState.investedAmount : 0
      const averageBuyPrice = quantityHeld > 0 ? investedAmount / quantityHeld : 0
      const averageBuyPriceOriginal =
        quantityHeld > 0 && originalCurrency
          ? positionState.investedAmountOriginal / quantityHeld
          : undefined
      const marketValue = quantityHeld * close
      const gainLossAmount = marketValue - investedAmount
      const gainLossRatio = investedAmount > 0 ? gainLossAmount / investedAmount : 0

      totalValue += marketValue
      bySymbol[symbol] = marketValue

      const currentSeries = assetSeries[symbol] ?? []
      assetSeries[symbol] = [
        ...currentSeries,
        {
          date,
          symbol,
          assetName: assetNames[symbol] ?? symbol,
          quantityHeld,
          close,
          originalClose,
          originalCurrency,
          investedAmount,
          averageBuyPrice,
          averageBuyPriceOriginal,
          gainLossAmount,
          gainLossRatio,
          marketValue,
        },
      ]
    })

    return {
      date,
      totalValue,
      bySymbol,
    }
  })

  return {
    points,
    assetSeries,
    assetNames,
  }
}

function getEffectiveCloseInEur(
  symbol: string,
  close: number | undefined,
  usdEurRate: number | undefined,
) {
  if (close === undefined) {
    return 0
  }

  let currency: 'EUR' | 'USD'

  try {
    currency = getQuoteCurrencyForSymbol(symbol)
  } catch {
    return 0
  }

  if (currency === 'EUR' || isFxSymbol(symbol)) {
    return close
  }

  if (usdEurRate === undefined) {
    return 0
  }

  return close * usdEurRate
}

function getOriginalCurrency(symbol: string) {
  try {
    return getQuoteCurrencyForSymbol(symbol)
  } catch {
    return undefined
  }
}

function createEmptyPositionState(): PositionState {
  return {
    quantity: 0,
    investedAmount: 0,
    investedAmountOriginal: 0,
  }
}

function applyTransaction(
  state: PositionState,
  transaction: Transaction,
  input: {
    unitPriceInEur: number
  },
) {
  if (transaction.quantity > 0) {
    state.quantity += transaction.quantity
    state.investedAmount += transaction.quantity * input.unitPriceInEur
    state.investedAmountOriginal += transaction.quantity * transaction.unitPrice
    return
  }

  const sellQuantity = Math.min(-transaction.quantity, Math.max(state.quantity, 0))
  const averageBuyPrice = state.quantity > 0 ? state.investedAmount / state.quantity : 0
  const averageBuyPriceOriginal =
    state.quantity > 0 ? state.investedAmountOriginal / state.quantity : 0

  state.quantity += transaction.quantity
  state.investedAmount = Math.max(
    0,
    state.investedAmount - sellQuantity * averageBuyPrice,
  )
  state.investedAmountOriginal = Math.max(
    0,
    state.investedAmountOriginal - sellQuantity * averageBuyPriceOriginal,
  )

  if (state.quantity <= 0) {
    state.investedAmount = 0
    state.investedAmountOriginal = 0
  }
}

function getTransactionUnitPriceInEur(
  transaction: Transaction,
  usdEurRate: number | undefined,
  fxPoints: PricePoint[],
) {
  try {
    const currency = getQuoteCurrencyForSymbol(transaction.symbol)

    if (currency === 'EUR' || isFxSymbol(transaction.symbol)) {
      return transaction.unitPrice
    }

    if (usdEurRate !== undefined) {
      return transaction.unitPrice * usdEurRate
    }

    const fallbackRate = fxPoints.find((point) => point.date >= transaction.date)?.close

    return fallbackRate !== undefined ? transaction.unitPrice * fallbackRate : 0
  } catch {
    return 0
  }
}
