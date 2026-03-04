import { describe, expect, it } from 'vitest'
import {
  getQuoteCurrencyForSymbol,
  getRequiredFxSymbols,
  isFxSymbol,
  toYahooFinanceSymbol,
  USD_EUR_FX_SYMBOL,
} from './symbols'

describe('symbol mapping', () => {
  it('maps supported symbols to Yahoo Finance symbols', () => {
    expect(toYahooFinanceSymbol('EPA:C40')).toBe('C40.PA')
    expect(toYahooFinanceSymbol('NYSEARCA:URTH')).toBe('URTH')
    expect(toYahooFinanceSymbol('AMS:IMEU')).toBe('IMEU.AS')
  })

  it('infers quote currencies for supported exchanges', () => {
    expect(getQuoteCurrencyForSymbol('NYSEARCA:URTH')).toBe('USD')
    expect(getQuoteCurrencyForSymbol('EPA:C40')).toBe('EUR')
    expect(getQuoteCurrencyForSymbol('AMS:IMEU')).toBe('EUR')
  })

  it('identifies required FX symbols for USD holdings', () => {
    expect(getRequiredFxSymbols(['EPA:C40'])).toEqual([])
    expect(getRequiredFxSymbols(['EPA:C40', 'NYSEARCA:URTH'])).toEqual([
      USD_EUR_FX_SYMBOL,
    ])
    expect(isFxSymbol(USD_EUR_FX_SYMBOL)).toBe(true)
  })

  it('rejects unsupported exchanges for quote-currency inference', () => {
    expect(() => getQuoteCurrencyForSymbol('INVALID_SYMBOL')).toThrow(
      'Unsupported quote currency for symbol "INVALID_SYMBOL"',
    )
  })
})
