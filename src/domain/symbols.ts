const YAHOO_SUFFIX_BY_EXCHANGE: Record<string, string> = {
  EPA: '.PA',
  AMS: '.AS',
  NASDAQ: '',
  NYSE: '',
  NYSEARCA: '',
  ETR: '.DE',
  XETRA: '.DE',
}

const QUOTE_CURRENCY_BY_EXCHANGE: Record<string, 'EUR' | 'USD'> = {
  AMS: 'EUR',
  EPA: 'EUR',
  ETR: 'EUR',
  NASDAQ: 'USD',
  NYSE: 'USD',
  NYSEARCA: 'USD',
  XETRA: 'EUR',
}

export const USD_EUR_FX_SYMBOL = 'CURRENCY:USDEUR'

export function normalizeSymbol(symbol: string): string {
  return symbol.trim().toUpperCase()
}

export function isFxSymbol(symbol: string) {
  return normalizeSymbol(symbol) === USD_EUR_FX_SYMBOL
}

export function getQuoteCurrencyForSymbol(symbol: string): 'EUR' | 'USD' {
  const normalized = normalizeSymbol(symbol)

  if (isFxSymbol(normalized)) {
    return 'EUR'
  }

  const parsed = parseSymbolParts(normalized, QUOTE_CURRENCY_BY_EXCHANGE)

  if (!parsed) {
    throw new Error(`Unsupported quote currency for symbol "${symbol}"`)
  }

  return QUOTE_CURRENCY_BY_EXCHANGE[parsed.exchange]
}

export function getRequiredFxSymbols(symbols: string[]) {
  const needsUsdEur = symbols.some((symbol) => getQuoteCurrencyForSymbol(symbol) === 'USD')

  return needsUsdEur ? [USD_EUR_FX_SYMBOL] : []
}

export function toYahooFinanceSymbol(symbol: string) {
  const normalized = normalizeSymbol(symbol)
  const parsed = parseSymbolParts(normalized, YAHOO_SUFFIX_BY_EXCHANGE)

  if (!parsed) {
    throw new Error(`Unsupported symbol format "${symbol}"`)
  }

  return `${parsed.ticker}${YAHOO_SUFFIX_BY_EXCHANGE[parsed.exchange]}`
}

function parseSymbolParts(
  symbol: string,
  supportedExchanges: Record<string, unknown>,
) {
  const parts = symbol.split(':')

  if (parts.length !== 2) {
    return undefined
  }

  const [left, right] = parts

  if (!left || !right) {
    return undefined
  }

  if (supportedExchanges[left] !== undefined) {
    return {
      exchange: left,
      ticker: right,
    }
  }

  if (supportedExchanges[right] !== undefined) {
    return {
      exchange: right,
      ticker: left,
    }
  }

  return undefined
}
