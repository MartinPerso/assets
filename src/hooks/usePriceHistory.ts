import { startTransition, useDeferredValue, useEffect, useState } from 'react'
import {
  getQuoteCurrencyForSymbol,
  getRequiredFxSymbols,
} from '../domain/symbols'
import { priceCacheRepo } from '../data/price-cache-repo'
import { createGoogleSheetPriceProvider } from '../data/providers/google-sheet-price-provider'
import type { PriceProvider } from '../data/providers/price-provider'
import { todayIso } from '../utils/dates'
import type { PricePoint, SymbolPriceStatus } from '../types/price'
import type { Transaction } from '../types/transaction'

const IS_DEV = import.meta.env.DEV

type PriceState = {
  isLoading: boolean
  priceHistoryBySymbol: Record<string, PricePoint[]>
  symbolStatuses: SymbolPriceStatus[]
  refresh: () => void
}

export function usePriceHistory(
  transactions: Transaction[],
  googleSheetCsvUrl: string,
): PriceState {
  const deferredTransactions = useDeferredValue(transactions)
  const [refreshToken, setRefreshToken] = useState(0)
  const [priceHistoryBySymbol, setPriceHistoryBySymbol] = useState<
    Record<string, PricePoint[]>
  >({})
  const [symbolStatuses, setSymbolStatuses] = useState<SymbolPriceStatus[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const symbolRequest = buildSymbolWindows(deferredTransactions)
  const requestDescriptor = JSON.stringify(symbolRequest.symbolWindows)
  const unsupportedDescriptor = JSON.stringify(symbolRequest.unsupportedStatuses)

  useEffect(() => {
    let cancelled = false
    const provider = createGoogleSheetPriceProvider(googleSheetCsvUrl)
    const symbolWindows = JSON.parse(requestDescriptor) as Record<
      string,
      { from: string; to: string }
    >
    const unsupportedStatuses = JSON.parse(unsupportedDescriptor) as SymbolPriceStatus[]

    async function loadHistory() {
      const symbols = Object.keys(symbolWindows)

      if (symbols.length === 0 && unsupportedStatuses.length === 0) {
        setPriceHistoryBySymbol({})
        setSymbolStatuses([])
        setIsLoading(false)
        return
      }

      if (!googleSheetCsvUrl.trim()) {
        setPriceHistoryBySymbol({})
        setSymbolStatuses(
          [
            ...symbols.map((symbol) => ({
              symbol,
              state: 'error' as const,
              points: 0,
              message: 'Add a published Google Sheets CSV URL.',
            })),
            ...unsupportedStatuses,
          ],
        )
        setIsLoading(false)
        return
      }

      setIsLoading(symbols.length > 0)
      setSymbolStatuses(
        [
          ...symbols.map((symbol) => ({
            symbol,
            state: 'loading' as const,
            points: 0,
          })),
          ...unsupportedStatuses,
        ],
      )

      const nextHistory: Record<string, PricePoint[]> = {}
      const nextStatuses: SymbolPriceStatus[] = [...unsupportedStatuses]

      for (const symbol of symbols) {
        const window = symbolWindows[symbol]

        try {
          const result = await ensureSymbolHistory(
            provider,
            symbol,
            window.from,
            window.to,
          )
          nextHistory[symbol] = result.points
          nextStatuses.push(result.status)
        } catch (error) {
          if (IS_DEV) {
            console.groupCollapsed(`[prices] Failed to refresh ${symbol}`)
            console.info('Request', {
              symbol,
              from: window.from,
              to: window.to,
              provider: provider.name,
              sheetCsvUrl: googleSheetCsvUrl,
            })
            console.error(error)
            console.groupEnd()
          }

          nextHistory[symbol] = []
          nextStatuses.push({
            symbol,
            state: 'error',
            points: 0,
            message:
              error instanceof Error ? error.message : 'Unable to fetch price history',
          })
        }
      }

      if (cancelled) {
        return
      }

      startTransition(() => {
        setPriceHistoryBySymbol(nextHistory)
        setSymbolStatuses(nextStatuses)
        setIsLoading(false)
      })
    }

    void loadHistory()

    return () => {
      cancelled = true
    }
  }, [googleSheetCsvUrl, refreshToken, requestDescriptor, unsupportedDescriptor])

  return {
    isLoading,
    priceHistoryBySymbol,
    symbolStatuses,
    refresh: () => {
      startTransition(() => {
        setRefreshToken((token) => token + 1)
      })
    },
  }
}

async function ensureSymbolHistory(
  provider: PriceProvider,
  symbol: string,
  from: string,
  to: string,
) {
  const cached = await priceCacheRepo.getPrices(provider.name, symbol, from, to)

  if (IS_DEV) {
    console.info('[prices] Resolving symbol history', {
      symbol,
      from,
      to,
      provider: provider.name,
      cachedPoints: cached.length,
      strategy: 'full-rebuild-from-published-csv',
    })
  }

  try {
    const fetched = await provider.getDailyHistory({
      symbol,
      from,
      to,
    })
    const rebuilt = dedupePricePoints(fetched)

    await priceCacheRepo.deletePrices(provider.name, symbol, from, to)
    await priceCacheRepo.putPrices(rebuilt)
    await priceCacheRepo.putMeta({
      provider: provider.name,
      symbol,
      earliestDate: rebuilt[0]?.date ?? from,
      latestDate: rebuilt.at(-1)?.date ?? to,
      lastFetchedAt: new Date().toISOString(),
    })

    return {
      points: rebuilt,
      status: {
        symbol,
        state: 'ready' as const,
        points: rebuilt.length,
        message:
          cached.length > 0
            ? 'Rebuilt from the published sheet.'
            : 'Loaded from the published sheet.',
      },
    }
  } catch (error) {
    if (cached.length > 0) {
      if (IS_DEV) {
        console.groupCollapsed(`[prices] Refresh failed, using cache for ${symbol}`)
        console.info('Request', {
          symbol,
          from,
          to,
          provider: provider.name,
          cachedPoints: cached.length,
          strategy: 'full-rebuild-from-published-csv',
        })
        console.error(error)
        console.groupEnd()
      }

      return {
        points: cached,
        status: {
          symbol,
          state: 'error' as const,
          points: cached.length,
          message:
            error instanceof Error
              ? `${error.message} Using saved local prices for now.`
              : 'Update failed. Using saved local prices for now.',
        },
      }
    }

    throw error
  }
}

export function buildSymbolWindows(transactions: Transaction[]) {
  const symbolWindows: Record<string, { from: string; to: string }> = {}
  const unsupportedSymbols = new Set<string>()
  const unsupportedStatuses: SymbolPriceStatus[] = []
  let earliestUsdTransactionDate: string | undefined
  const today = todayIso()
  const uniqueSymbols = [...new Set(transactions.map((transaction) => transaction.symbol))]

  uniqueSymbols.forEach((symbol) => {
    try {
      getQuoteCurrencyForSymbol(symbol)
    } catch (error) {
      unsupportedSymbols.add(symbol)
      unsupportedStatuses.push({
        symbol,
        state: 'error',
        points: 0,
        message:
          error instanceof Error
            ? `${error.message}. EUR valuation requires a supported quote currency mapping.`
            : 'Unsupported quote currency. EUR valuation requires a supported quote currency mapping.',
      })
    }
  })

  transactions.forEach((transaction) => {
    if (unsupportedSymbols.has(transaction.symbol)) {
      return
    }

    if (getQuoteCurrencyForSymbol(transaction.symbol) === 'USD') {
      earliestUsdTransactionDate = [earliestUsdTransactionDate, transaction.date]
        .filter(Boolean)
        .sort()[0]
    }

    const current = symbolWindows[transaction.symbol]

    if (!current) {
      symbolWindows[transaction.symbol] = {
        from: transaction.date,
        to: today,
      }
      return
    }

    if (transaction.date < current.from) {
      symbolWindows[transaction.symbol] = {
        ...current,
        from: transaction.date,
      }
    }
  })

  const fxSymbols = getRequiredFxSymbols(Object.keys(symbolWindows))

  fxSymbols.forEach((symbol) => {
    if (!earliestUsdTransactionDate) {
      return
    }

    symbolWindows[symbol] = {
      from: earliestUsdTransactionDate,
      to: today,
    }
  })

  return {
    symbolWindows,
    unsupportedStatuses: dedupeStatuses(unsupportedStatuses),
  }
}

function dedupeStatuses(statuses: SymbolPriceStatus[]) {
  const bySymbol = new Map<string, SymbolPriceStatus>()

  statuses.forEach((status) => {
    bySymbol.set(status.symbol, status)
  })

  return [...bySymbol.values()]
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
