import Dexie, { type Table } from 'dexie'
import type { PriceFetchMeta, PricePoint } from '../types/price'
import type { TransactionCsvRow } from '../types/transaction'

type RawCsvRecord = {
  key: 'current'
  value: string
  lastModified: string
}

type SettingRecord = {
  key: string
  value: string
  lastModified: string
}

export class PortfolioDb extends Dexie {
  transactions!: Table<TransactionCsvRow, string>
  rawCsv!: Table<RawCsvRecord, 'current'>
  settings!: Table<SettingRecord, string>
  prices!: Table<PricePoint, [string, string, string]>
  priceFetchMeta!: Table<PriceFetchMeta, [string, string]>

  constructor() {
    super('static-portfolio-tracker')

    this.version(1).stores({
      transactions: 'id,date,symbol,account',
      rawCsv: 'key',
      prices: '[provider+symbol+date],provider,symbol,date',
      priceFetchMeta: '[provider+symbol],provider,symbol',
    })

    this.version(2).stores({
      transactions: 'id,date,symbol,account',
      rawCsv: 'key',
      settings: 'key',
      prices: '[provider+symbol+date],provider,symbol,date',
      priceFetchMeta: '[provider+symbol],provider,symbol',
    })
  }
}

export const db = new PortfolioDb()
