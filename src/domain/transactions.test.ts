import { describe, expect, it } from 'vitest'
import { validateTransactionRows } from './transactions'
import type { TransactionCsvRow } from '../types/transaction'

const validRow: TransactionCsvRow = {
  id: '1',
  date: '01/02/2024',
  name: 'iShares MSCI World ETF',
  symbol: 'NYSEARCA:URTH',
  quantity: '4',
  unitPrice: '93.07',
  account: 'Brokerage',
  comments: 'import',
}

describe('transaction validation', () => {
  it('accepts valid rows', () => {
    const result = validateTransactionRows([validRow])

    expect(result.hasErrors).toBe(false)
    expect(result.validTransactions[0]).toMatchObject({
      date: '2024-02-01',
      symbol: 'NYSEARCA:URTH',
      quantity: 4,
      unitPrice: 93.07,
    })
  })

  it('flags duplicate rows and invalid dates', () => {
    const result = validateTransactionRows([
      validRow,
      { ...validRow, id: '2' },
      { ...validRow, id: '3', date: '32/02/2024' },
    ])

    expect(result.hasErrors).toBe(true)
    expect(result.errorsById['1']).toContain('Duplicate transaction row')
    expect(result.errorsById['2']).toContain('Duplicate transaction row')
    expect(result.errorsById['3'][0]).toContain('Invalid date')
  })

  it('accepts sell rows with a negative quantity', () => {
    const result = validateTransactionRows([
      {
        ...validRow,
        id: 'sell-1',
        quantity: '-1.5',
      },
    ])

    expect(result.hasErrors).toBe(false)
    expect(result.validTransactions[0]).toMatchObject({
      quantity: -1.5,
    })
  })
})
