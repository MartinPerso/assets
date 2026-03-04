import { db } from './db'
import type { PriceFetchMeta, PricePoint } from '../types/price'

export const priceCacheRepo = {
  async getPrices(provider: string, symbol: string, from: string, to: string) {
    return db.prices
      .where('[provider+symbol+date]')
      .between([provider, symbol, from], [provider, symbol, to], true, true)
      .sortBy('date')
  },

  async deletePrices(provider: string, symbol: string, from: string, to: string) {
    await db.prices
      .where('[provider+symbol+date]')
      .between([provider, symbol, from], [provider, symbol, to], true, true)
      .delete()
  },

  async putPrices(points: PricePoint[]) {
    if (points.length === 0) {
      return
    }

    await db.prices.bulkPut(points)
  },

  async getMeta(provider: string, symbol: string) {
    return db.priceFetchMeta.get([provider, symbol])
  },

  async putMeta(meta: PriceFetchMeta) {
    await db.priceFetchMeta.put(meta)
  },
}
