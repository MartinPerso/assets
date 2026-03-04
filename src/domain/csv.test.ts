import { describe, expect, it } from 'vitest'
import { parseCsvContent, serializeCsv } from './csv'

describe('csv parsing', () => {
  it('parses standard and decimal-comma rows', () => {
    const rows = parseCsvContent(`Date,Name,ISIN,Quantity,Price,Account,Comments
01/02/2024,iShares MSCI World ETF,NYSEARCA:URTH,4,93.07,Demo CTO,import
01/02/2024,Amundi MSCI Europe UCITS ETF,AMS:IMEU,11,"15,654",Demo CTO,import`)

    expect(rows).toHaveLength(2)
    expect(rows[1].unitPrice).toBe('15,654')
  })

  it('round-trips the expected CSV headers', () => {
    const rows = parseCsvContent(`Date,Name,ISIN,Quantity,Price,Account,Comments
01/02/2024,iShares MSCI World ETF,NYSEARCA:URTH,4,93.07,Demo CTO,import`)

    const csv = serializeCsv(rows)

    expect(csv).toContain('Date,Name,ISIN,Quantity,Price,Account,Comments')
    expect(csv).toContain('01/02/2024,iShares MSCI World ETF,NYSEARCA:URTH,4,93.07,Demo CTO,import')
  })
})
