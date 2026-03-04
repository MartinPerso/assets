import { db } from './db'
import type { TransactionCsvRow } from '../types/transaction'

export const transactionsRepo = {
  async load() {
    const [rows, rawCsv] = await Promise.all([
      db.transactions.orderBy('date').toArray(),
      db.rawCsv.get('current'),
    ])

    return {
      rows,
      rawCsv: rawCsv?.value ?? '',
      lastModified: rawCsv?.lastModified,
    }
  },

  async save(rows: TransactionCsvRow[], rawCsv: string) {
    const lastModified = new Date().toISOString()

    await db.transaction('rw', db.transactions, db.rawCsv, async () => {
      await db.transactions.clear()
      await db.transactions.bulkPut(rows)
      await db.rawCsv.put({
        key: 'current',
        value: rawCsv,
        lastModified,
      })
    })

    return lastModified
  },
}
