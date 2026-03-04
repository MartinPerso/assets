import type { PricePoint } from '../../types/price'

export interface PriceProvider {
  readonly name: string
  readonly version: string
  getDailyHistory(input: {
    symbol: string
    from: string
    to: string
  }): Promise<PricePoint[]>
}
