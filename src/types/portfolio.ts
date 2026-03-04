export type AssetValuationPoint = {
  date: string
  symbol: string
  assetName: string
  quantityHeld: number
  close: number
  originalClose?: number
  originalCurrency?: string
  investedAmount: number
  averageBuyPrice: number
  averageBuyPriceOriginal?: number
  gainLossAmount: number
  gainLossRatio: number
  marketValue: number
}

export type PortfolioSeriesPoint = {
  date: string
  totalValue: number
  bySymbol: Record<string, number>
}

export type PortfolioComputation = {
  points: PortfolioSeriesPoint[]
  assetSeries: Record<string, AssetValuationPoint[]>
  assetNames: Record<string, string>
}

export type PortfolioFilters = {
  accounts: string[]
  symbols: string[]
  startDate?: string
  endDate?: string
}
