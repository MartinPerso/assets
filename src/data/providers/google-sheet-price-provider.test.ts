import { describe, expect, it } from 'vitest'
import {
  parseGoogleSheetPreviewCsv,
  parseGoogleSheetPriceCsv,
} from './google-sheet-price-provider'
import { USD_EUR_FX_SYMBOL } from '../../domain/symbols'

describe('google sheet price provider', () => {
  it('parses repeated Date/Close column pairs into price points', () => {
    const csv = [
      'Start date,2024-01-01,,,',
      ',,,,',
      'NYSEARCA:URTH,,AMS:IMEU,',
      'Date,Close,Date,Close',
      '05/01/2024 16:00:00,181.18,05/01/2024 17:40:00,29.24',
      '12/01/2024 16:00:00,185.92,12/01/2024 17:40:00,30.16',
      '19/01/2024 16:00:00,191.56,19/01/2024 17:40:00,30.18',
    ].join('\n')

    const result = parseGoogleSheetPriceCsv(csv, 'provider-test')

    expect(result['NYSEARCA:URTH']).toEqual([
      {
        provider: 'provider-test',
        symbol: 'NYSEARCA:URTH',
        date: '2024-01-05',
        close: 181.18,
        currency: 'USD',
      },
      {
        provider: 'provider-test',
        symbol: 'NYSEARCA:URTH',
        date: '2024-01-12',
        close: 185.92,
        currency: 'USD',
      },
      {
        provider: 'provider-test',
        symbol: 'NYSEARCA:URTH',
        date: '2024-01-19',
        close: 191.56,
        currency: 'USD',
      },
    ])

    expect(result['AMS:IMEU']).toEqual([
      {
        provider: 'provider-test',
        symbol: 'AMS:IMEU',
        date: '2024-01-05',
        close: 29.24,
        currency: 'EUR',
      },
      {
        provider: 'provider-test',
        symbol: 'AMS:IMEU',
        date: '2024-01-12',
        close: 30.16,
        currency: 'EUR',
      },
      {
        provider: 'provider-test',
        symbol: 'AMS:IMEU',
        date: '2024-01-19',
        close: 30.18,
        currency: 'EUR',
      },
    ])
  })

  it('parses the shared USD to EUR FX block as a reusable symbol', () => {
    const csv = [
      'Start date,2024-01-01,,,',
      ',,,,',
      `${USD_EUR_FX_SYMBOL},,,,`,
      'Date,Close,,,',
      '05/01/2024 16:00:00,0.9124,,,',
      '12/01/2024 16:00:00,0.9188,,,',
    ].join('\n')

    const result = parseGoogleSheetPriceCsv(csv, 'provider-test')

    expect(result[USD_EUR_FX_SYMBOL]).toEqual([
      {
        provider: 'provider-test',
        symbol: USD_EUR_FX_SYMBOL,
        date: '2024-01-05',
        close: 0.9124,
        currency: 'EUR',
      },
      {
        provider: 'provider-test',
        symbol: USD_EUR_FX_SYMBOL,
        date: '2024-01-12',
        close: 0.9188,
        currency: 'EUR',
      },
    ])
  })

  it('skips incomplete or invalid rows', () => {
    const csv = [
      'Start date,2024-01-01',
      ',',
      'NYSEARCA:URTH,',
      'Date,Close',
      '05/01/2024 16:00:00,367.75',
      ',388.47',
      '19/01/2024 16:00:00,',
      'invalid,398.67',
    ].join('\n')

    const result = parseGoogleSheetPriceCsv(csv, 'provider-test')

    expect(result['NYSEARCA:URTH']).toEqual([
      {
        provider: 'provider-test',
        symbol: 'NYSEARCA:URTH',
        date: '2024-01-05',
        close: 367.75,
        currency: 'USD',
      },
    ])
  })

  it('keeps the appended latest quote when it duplicates the latest history date', () => {
    const csv = [
      'Start date,2024-01-01',
      ',',
      'NYSEARCA:URTH,',
      'Date,Close',
      '01/03/2026 16:00:00,398.67',
      '04/03/2026 16:00:00,401.15',
      '04/03/2026,405.22',
    ].join('\n')

    const result = parseGoogleSheetPriceCsv(csv, 'provider-test')

    expect(result['NYSEARCA:URTH']).toEqual([
      {
        provider: 'provider-test',
        symbol: 'NYSEARCA:URTH',
        date: '2026-03-01',
        close: 398.67,
        currency: 'USD',
      },
      {
        provider: 'provider-test',
        symbol: 'NYSEARCA:URTH',
        date: '2026-03-04',
        close: 405.22,
        currency: 'USD',
      },
    ])
  })

  it('parses a latest quote row emitted as a formatted date string', () => {
    const csv = [
      'Start date,2024-01-01',
      ',',
      'NYSEARCA:URTH,',
      'Date,Close',
      '01/03/2026 16:00:00,398.67',
      '04/03/2026,405.22',
    ].join('\n')

    const result = parseGoogleSheetPriceCsv(csv, 'provider-test')

    expect(result['NYSEARCA:URTH']).toEqual([
      {
        provider: 'provider-test',
        symbol: 'NYSEARCA:URTH',
        date: '2026-03-01',
        close: 398.67,
        currency: 'USD',
      },
      {
        provider: 'provider-test',
        symbol: 'NYSEARCA:URTH',
        date: '2026-03-04',
        close: 405.22,
        currency: 'USD',
      },
    ])
  })

  it('extracts a rectangular preview sample from the raw csv', () => {
    const csv = [
      'Start date,2024-01-01,AMS:IMEU,,EPA:C40,,EXTRA',
      ',,,,,,',
      'AMS:IMEU,,EPA:C40,,NYSEARCA:URTH,,',
      'Date,Close,Date,Close,Date,Close,Ignored',
      '05/01/2024 17:40:00,29.24,05/01/2024 17:40:00,119.14,05/01/2024 16:00:00,133.63,tail',
      '12/01/2024 17:40:00,30.16,12/01/2024 17:40:00,123.44,12/01/2024 16:00:00,135.07,tail',
      '19/01/2024 17:40:00,30.18,19/01/2024 17:40:00,122.46,19/01/2024 16:00:00,136.45,tail',
    ].join('\n')

    const result = parseGoogleSheetPreviewCsv(csv, {
      maxRows: 4,
      maxColumns: 5,
    })

    expect(result.columnLabels).toEqual(['A', 'B', 'C', 'D', 'E'])
    expect(result.rows).toEqual([
      ['Start date', '2024-01-01', 'AMS:IMEU', '', 'EPA:C40'],
      ['', '', '', '', ''],
      ['AMS:IMEU', '', 'EPA:C40', '', 'NYSEARCA:URTH'],
      ['Date', 'Close', 'Date', 'Close', 'Date'],
    ])
    expect(result.hasMoreRows).toBe(true)
    expect(result.hasMoreColumns).toBe(true)
  })
})
