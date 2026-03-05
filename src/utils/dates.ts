import {
  addDays,
  eachDayOfInterval,
  format,
  isValid,
  parse,
  parseISO,
} from 'date-fns'

export const INPUT_DATE_FORMAT = 'dd/MM/yyyy'
const STRICT_INPUT_DATE_PATTERN = /^\d{2}\/\d{2}\/\d{4}$/

export function parseInputDateToIso(value: string): string {
  const trimmed = value.trim()

  if (!STRICT_INPUT_DATE_PATTERN.test(trimmed)) {
    throw new Error(`Invalid date "${value}". Expected format: ${INPUT_DATE_FORMAT}`)
  }

  const parsed = parse(trimmed, INPUT_DATE_FORMAT, new Date())

  if (!isValid(parsed)) {
    throw new Error(`Invalid date "${value}". Expected format: ${INPUT_DATE_FORMAT}`)
  }

  return format(parsed, 'yyyy-MM-dd')
}

export function formatIsoToInputDate(value: string): string {
  const parsed = parseISO(value)

  if (!isValid(parsed)) {
    return value
  }

  return format(parsed, INPUT_DATE_FORMAT)
}

export function todayIso(): string {
  return format(new Date(), 'yyyy-MM-dd')
}

export function shiftIsoDays(value: string, amount: number): string {
  return format(addDays(parseISO(value), amount), 'yyyy-MM-dd')
}

export function compareIsoDates(left: string, right: string): number {
  if (left === right) {
    return 0
  }

  return left < right ? -1 : 1
}

export function minIsoDate(values: string[]): string | undefined {
  return [...values].sort(compareIsoDates)[0]
}

export function maxIsoDate(values: string[]): string | undefined {
  return [...values].sort(compareIsoDates).at(-1)
}

export function clampIsoDate(
  value: string,
  min: string,
  max: string,
): string {
  if (value < min) {
    return min
  }

  if (value > max) {
    return max
  }

  return value
}

export function eachIsoDay(start: string, end: string): string[] {
  if (start > end) {
    return []
  }

  return eachDayOfInterval({
    start: parseISO(start),
    end: parseISO(end),
  }).map((date) => format(date, 'yyyy-MM-dd'))
}
