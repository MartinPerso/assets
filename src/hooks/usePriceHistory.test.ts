import { describe, expect, it } from 'vitest'
import { USD_EUR_FX_SYMBOL } from '../domain/symbols'
import { buildSymbolWindows } from './usePriceHistory'

describe('usePriceHistory symbol planning', () => {
  it('does not request FX for EUR-only portfolios', () => {
    const result = buildSymbolWindows([
      {
        id: '1',
        date: '2024-01-05',
        name: 'Amundi CAC 40 UCITS ETF',
        symbol: 'EPA:C40',
        quantity: 1,
        unitPrice: 100,
        account: 'Brokerage',
        comments: '',
      },
    ])

    expect(result.symbolWindows).toEqual({
      'EPA:C40': {
        from: '2024-01-05',
        to: expect.any(String),
      },
    })
    expect(result.unsupportedStatuses).toEqual([])
  })

  it('requests a shared FX symbol once for mixed EUR and USD portfolios', () => {
    const result = buildSymbolWindows([
      {
        id: '1',
        date: '2024-01-05',
        name: 'iShares MSCI World ETF',
        symbol: 'NYSEARCA:URTH',
        quantity: 1,
        unitPrice: 100,
        account: 'Brokerage',
        comments: '',
      },
      {
        id: '2',
        date: '2024-01-10',
        name: 'Amundi CAC 40 UCITS ETF',
        symbol: 'EPA:C40',
        quantity: 1,
        unitPrice: 100,
        account: 'Brokerage',
        comments: '',
      },
    ])

    expect(result.symbolWindows['NYSEARCA:URTH']).toEqual({
      from: '2024-01-05',
      to: expect.any(String),
    })
    expect(result.symbolWindows['EPA:C40']).toEqual({
      from: '2024-01-10',
      to: expect.any(String),
    })
    expect(result.symbolWindows[USD_EUR_FX_SYMBOL]).toEqual({
      from: '2024-01-05',
      to: expect.any(String),
    })
  })

  it('surfaces unsupported exchanges without requesting history for them', () => {
    const result = buildSymbolWindows([
      {
        id: '1',
        date: '2024-01-05',
        name: 'Unknown',
        symbol: 'INVALID_SYMBOL',
        quantity: 1,
        unitPrice: 100,
        account: 'Brokerage',
        comments: '',
      },
    ])

    expect(result.symbolWindows).toEqual({})
    expect(result.unsupportedStatuses).toEqual([
      {
        symbol: 'INVALID_SYMBOL',
        state: 'error',
        points: 0,
        message:
          'Unsupported quote currency for symbol "INVALID_SYMBOL". EUR valuation requires a supported quote currency mapping.',
      },
    ])
  })
})
