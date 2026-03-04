export function parseLocaleNumber(value: string): number | undefined {
  const trimmed = value.trim()

  if (!trimmed) {
    return undefined
  }

  const compact = trimmed.replace(/\s+/g, '')
  const lastComma = compact.lastIndexOf(',')
  const lastDot = compact.lastIndexOf('.')

  let normalized = compact

  if (lastComma > lastDot) {
    normalized = compact.replace(/\./g, '').replace(',', '.')
  } else if (lastDot > lastComma) {
    normalized = compact.replace(/,/g, '')
  } else {
    normalized = compact.replace(',', '.')
  }

  const parsed = Number(normalized)

  return Number.isFinite(parsed) ? parsed : undefined
}

export function formatDecimal(value: number, fractionDigits = 4): string {
  return value
    .toFixed(fractionDigits)
    .replace(/\.?0+$/, '')
}

export function formatCurrency(value: number): string {
  return formatCurrencyAmount(value, 'EUR')
}

export function formatCurrencyAmount(value: number, currency: string): string {
  return formatNumberAsCurrency(value, currency)
}

export function formatSignedCurrency(value: number, currency = 'EUR'): string {
  return formatNumberAsCurrency(value, currency, value === 0 ? 'auto' : 'always')
}

export function formatPercent(value: number, maximumFractionDigits = 1): string {
  return new Intl.NumberFormat('en-US', {
    style: 'percent',
    maximumFractionDigits,
  }).format(value)
}

export function formatSignedPercent(value: number, maximumFractionDigits = 1): string {
  return new Intl.NumberFormat('en-US', {
    style: 'percent',
    maximumFractionDigits,
    signDisplay: value === 0 ? 'auto' : 'always',
  }).format(value)
}

export function formatCompactNumber(value: number): string {
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value)
}

function formatNumberAsCurrency(
  value: number,
  currency: string,
  signDisplay?: 'auto' | 'always',
): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
    signDisplay,
  }).format(value)
}
