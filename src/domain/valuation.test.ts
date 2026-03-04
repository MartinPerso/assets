import { describe, expect, it } from 'vitest'
import { computePortfolioValuation } from './valuation'
import { USD_EUR_FX_SYMBOL } from './symbols'

describe('portfolio valuation', () => {
  it('aggregates mixed EUR and USD holdings in EUR using forward-filled FX', () => {
    const result = computePortfolioValuation({
      transactions: [
        {
          id: '1',
          date: '2024-01-01',
          name: 'iShares MSCI World ETF',
          symbol: 'NYSEARCA:URTH',
          quantity: 2,
          unitPrice: 100,
          account: 'Brokerage',
          comments: '',
        },
        {
          id: '2',
          date: '2024-01-03',
          name: 'Amundi MSCI Europe UCITS ETF',
          symbol: 'AMS:IMEU',
          quantity: 1,
          unitPrice: 200,
          account: 'Brokerage',
          comments: '',
        },
        {
          id: '3',
          date: '2024-01-02',
          name: 'Amundi CAC 40 UCITS ETF',
          symbol: 'EPA:C40',
          quantity: 3,
          unitPrice: 150,
          account: 'Brokerage',
          comments: '',
        },
      ],
      priceHistoryBySymbol: {
        'NYSEARCA:URTH': [
          {
            provider: 'test',
            symbol: 'NYSEARCA:URTH',
            date: '2024-01-01',
            close: 10,
            currency: 'USD',
          },
          {
            provider: 'test',
            symbol: 'NYSEARCA:URTH',
            date: '2024-01-02',
            close: 11,
            currency: 'USD',
          },
        ],
        'AMS:IMEU': [
          {
            provider: 'test',
            symbol: 'AMS:IMEU',
            date: '2024-01-03',
            close: 20,
            currency: 'EUR',
          },
        ],
        'EPA:C40': [
          {
            provider: 'test',
            symbol: 'EPA:C40',
            date: '2024-01-02',
            close: 30,
            currency: 'EUR',
          },
        ],
        [USD_EUR_FX_SYMBOL]: [
          {
            provider: 'test',
            symbol: USD_EUR_FX_SYMBOL,
            date: '2024-01-02',
            close: 0.9,
            currency: 'EUR',
          },
          {
            provider: 'test',
            symbol: USD_EUR_FX_SYMBOL,
            date: '2024-01-03',
            close: 0.92,
            currency: 'EUR',
          },
        ],
      },
      filters: {
        accounts: ['Brokerage'],
        symbols: ['NYSEARCA:URTH', 'AMS:IMEU', 'EPA:C40'],
        startDate: '2024-01-01',
        endDate: '2024-01-03',
      },
    })

    expect(result.points).toHaveLength(3)
    expect(result.points[0].totalValue).toBe(0)
    expect(result.points[1].totalValue).toBeCloseTo(109.8)
    expect(result.points[2].totalValue).toBeCloseTo(130.24)
    expect(result.assetSeries['NYSEARCA:URTH']).toHaveLength(3)
    expect(result.assetSeries['AMS:IMEU']).toHaveLength(3)
    expect(result.assetSeries['EPA:C40']).toHaveLength(3)
    expect(result.assetSeries['NYSEARCA:URTH'][0].marketValue).toBe(0)
    expect(result.assetSeries['NYSEARCA:URTH'][1].marketValue).toBeCloseTo(19.8)
    expect(result.assetSeries['NYSEARCA:URTH'][2].marketValue).toBeCloseTo(20.24)
    expect(result.assetSeries['NYSEARCA:URTH'][1].investedAmount).toBeCloseTo(180)
    expect(result.assetSeries['NYSEARCA:URTH'][1].averageBuyPrice).toBeCloseTo(90)
    expect(result.assetSeries['NYSEARCA:URTH'][1].averageBuyPriceOriginal).toBeCloseTo(100)
    expect(result.assetSeries['NYSEARCA:URTH'][1].gainLossAmount).toBeCloseTo(-160.2)
    expect(result.assetSeries['NYSEARCA:URTH'][1].gainLossRatio).toBeCloseTo(-0.89)
    expect(result.assetSeries['AMS:IMEU'][0].marketValue).toBe(0)
    expect(result.assetSeries['AMS:IMEU'][1].marketValue).toBe(0)
    expect(result.assetSeries['AMS:IMEU'][2].marketValue).toBeCloseTo(20)
    expect(result.assetSeries['EPA:C40'][1].marketValue).toBe(90)
    expect(result.assetSeries['EPA:C40'][2].marketValue).toBe(90)
    expect(result.assetSeries['EPA:C40'][2].investedAmount).toBe(450)
    expect(result.assetSeries['EPA:C40'][2].averageBuyPrice).toBeCloseTo(150)
    expect(result.assetSeries['EPA:C40'][2].gainLossAmount).toBe(-360)
    expect(result.assetSeries['EPA:C40'][2].gainLossRatio).toBeCloseTo(-0.8)
  })

  it('leaves unsupported exchanges unvalued instead of throwing', () => {
    const result = computePortfolioValuation({
      transactions: [
        {
          id: '1',
          date: '2024-01-01',
          name: 'Unknown',
          symbol: 'INVALID_SYMBOL',
          quantity: 2,
          unitPrice: 100,
          account: 'Brokerage',
          comments: '',
        },
      ],
      priceHistoryBySymbol: {
        INVALID_SYMBOL: [
          {
            provider: 'test',
            symbol: 'INVALID_SYMBOL',
            date: '2024-01-01',
            close: 10,
          },
        ],
      },
      filters: {
        accounts: ['Brokerage'],
        symbols: ['INVALID_SYMBOL'],
        startDate: '2024-01-01',
        endDate: '2024-01-01',
      },
    })

    expect(result.points[0].totalValue).toBe(0)
    expect(result.assetSeries['INVALID_SYMBOL'][0].marketValue).toBe(0)
  })

  it('preserves weighted average cost when a partial sell happens', () => {
    const result = computePortfolioValuation({
      transactions: [
        {
          id: '1',
          date: '2024-01-01',
          name: 'Amundi CAC 40 UCITS ETF',
          symbol: 'EPA:C40',
          quantity: 2,
          unitPrice: 100,
          account: 'Brokerage',
          comments: '',
        },
        {
          id: '2',
          date: '2024-01-02',
          name: 'Amundi CAC 40 UCITS ETF',
          symbol: 'EPA:C40',
          quantity: 2,
          unitPrice: 200,
          account: 'Brokerage',
          comments: '',
        },
        {
          id: '3',
          date: '2024-01-03',
          name: 'Amundi CAC 40 UCITS ETF',
          symbol: 'EPA:C40',
          quantity: -1,
          unitPrice: 250,
          account: 'Brokerage',
          comments: '',
        },
      ],
      priceHistoryBySymbol: {
        'EPA:C40': [
          { provider: 'test', symbol: 'EPA:C40', date: '2024-01-01', close: 100, currency: 'EUR' },
          { provider: 'test', symbol: 'EPA:C40', date: '2024-01-02', close: 200, currency: 'EUR' },
          { provider: 'test', symbol: 'EPA:C40', date: '2024-01-03', close: 190, currency: 'EUR' },
        ],
      },
      filters: {
        accounts: ['Brokerage'],
        symbols: ['EPA:C40'],
        startDate: '2024-01-01',
        endDate: '2024-01-03',
      },
    })

    expect(result.assetSeries['EPA:C40'][2].quantityHeld).toBe(3)
    expect(result.assetSeries['EPA:C40'][2].investedAmount).toBeCloseTo(450)
    expect(result.assetSeries['EPA:C40'][2].averageBuyPrice).toBeCloseTo(150)
    expect(result.assetSeries['EPA:C40'][2].marketValue).toBeCloseTo(570)
    expect(result.assetSeries['EPA:C40'][2].gainLossAmount).toBeCloseTo(120)
    expect(result.assetSeries['EPA:C40'][2].gainLossRatio).toBeCloseTo(120 / 450)
  })
})
