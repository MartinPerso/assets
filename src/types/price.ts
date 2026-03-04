export type PricePoint = {
  provider: string
  symbol: string
  date: string
  close: number
  currency?: string
}

export type PriceFetchMeta = {
  provider: string
  symbol: string
  earliestDate: string
  latestDate: string
  lastFetchedAt: string
}

export type SymbolPriceStatus = {
  symbol: string
  state: 'loading' | 'ready' | 'error'
  message?: string
  points: number
}
