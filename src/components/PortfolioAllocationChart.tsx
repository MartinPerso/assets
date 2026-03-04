import { useEffect, useMemo, useRef, useState } from 'react'
import ReactECharts from 'echarts-for-react'
import type { EChartsOption } from 'echarts'
import type { PieSeriesOption } from 'echarts/charts'
import type { PortfolioComputation } from '../types/portfolio'
import { chartPalette } from './chartPalette'
import { clampIsoDate, formatIsoToInputDate } from '../utils/dates'
import {
  formatCurrency,
  formatCurrencyAmount,
  formatDecimal,
  formatPercent,
  formatSignedCurrency,
  formatSignedPercent,
} from '../utils/numbers'

type PortfolioAllocationChartProps = {
  valuation: PortfolioComputation
}

export function PortfolioAllocationChart({
  valuation,
}: PortfolioAllocationChartProps) {
  const maxVisibleLabels = 10
  const minDate = valuation.points[0]?.date
  const maxDate = valuation.points.at(-1)?.date
  const [selectedDate, setSelectedDate] = useState<string>()
  const [hiddenSymbols, setHiddenSymbols] = useState<string[]>([])
  const modifierKeyRef = useRef(false)
  const pointerModifierRef = useRef(false)

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      modifierKeyRef.current = event.metaKey || event.ctrlKey
    }

    const handleKeyUp = (event: KeyboardEvent) => {
      modifierKeyRef.current = event.metaKey || event.ctrlKey
    }

    const resetModifierKey = () => {
      modifierKeyRef.current = false
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    window.addEventListener('blur', resetModifierKey)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('blur', resetModifierKey)
    }
  }, [])

  const effectiveSelectedDate =
    minDate && maxDate ? clampIsoDate(selectedDate ?? maxDate, minDate, maxDate) : undefined
  const snapshot = effectiveSelectedDate
    ? valuation.points.find((point) => point.date === effectiveSelectedDate) ??
      valuation.points.at(-1)
    : undefined
  const slices = useMemo(() => {
    if (!snapshot || snapshot.totalValue <= 0) {
      return []
    }

    return Object.entries(snapshot.bySymbol)
      .map(([symbol, value]) => ({
        symbol,
        name: valuation.assetNames[symbol] ?? symbol,
        value,
        share: value / snapshot.totalValue,
        point: valuation.assetSeries[symbol]?.find((point) => point.date === snapshot.date),
      }))
      .filter((slice) => slice.value > 0)
      .sort((left, right) => right.value - left.value)
  }, [snapshot, valuation.assetNames, valuation.assetSeries])
  const visibleSlices = useMemo(() => {
    const hidden = new Set(hiddenSymbols)
    const nextVisibleSlices = slices.filter((slice) => !hidden.has(slice.symbol))
    return nextVisibleSlices.length > 0 ? nextVisibleSlices : slices
  }, [hiddenSymbols, slices])

  if (!minDate || !maxDate || !effectiveSelectedDate) {
    return (
      <div className="panel allocation-panel allocation-panel--empty">
        <div className="panel__header">
          <div>
            <p className="eyebrow">Allocation</p>
            <h2>No repartition yet</h2>
          </div>
        </div>
        <p className="allocation-panel__empty">
          Load price history to inspect your portfolio mix on a given day.
        </p>
      </div>
    )
  }

  if (!snapshot || snapshot.totalValue <= 0) {
    return (
      <div className="panel allocation-panel allocation-panel--empty">
        <div className="panel__header">
          <div>
            <p className="eyebrow">Allocation</p>
            <h2>Portfolio repartition</h2>
          </div>
          <label className="allocation-panel__date">
            <span>Date</span>
            <input
              type="date"
              min={minDate}
              max={maxDate}
              value={effectiveSelectedDate}
              onChange={(event) => setSelectedDate(event.target.value)}
            />
          </label>
        </div>
        <p className="allocation-panel__empty">
          No priced positions are available for {formatIsoToInputDate(effectiveSelectedDate)}.
        </p>
      </div>
    )
  }

  const sliceSymbols = slices.map((slice) => slice.symbol)
  const visibleSliceSymbols = visibleSlices.map((slice) => slice.symbol)
  const visibleSliceSymbolSet = new Set(visibleSliceSymbols)
  const visibleTotalValue = visibleSlices.reduce((sum, slice) => sum + slice.value, 0)
  const visibleShareBySymbol = new Map(
    visibleSlices.map((slice) => [
      slice.symbol,
      visibleTotalValue > 0 ? slice.value / visibleTotalValue : 0,
    ]),
  )

  const labeledSymbols = new Set(
    visibleSlices.slice(0, maxVisibleLabels).map((slice) => slice.symbol),
  )

  const option: EChartsOption = {
    backgroundColor: 'transparent',
    animationDuration: 300,
    color: chartPalette,
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(13, 27, 42, 0.94)',
      borderWidth: 0,
      textStyle: {
        color: '#f4f1de',
      },
      formatter: (params) => {
        if (Array.isArray(params)) {
          return ''
        }

        const value = typeof params.value === 'number' ? params.value : 0
        const percent = typeof params.percent === 'number' ? params.percent : 0
        const point = sliceForName(visibleSlices, params.name)?.point

        return [
          `<strong>${params.name}</strong>`,
          `<div>${formatCurrency(value)}</div>`,
          point ? `<div>Invested ${formatCurrency(point.investedAmount)}</div>` : '',
          formatOriginalAmount(point),
          point
            ? `<div>${formatSignedCurrency(point.gainLossAmount)} (${formatSignedPercent(point.gainLossRatio)})</div>`
            : '',
          `<div>${percent.toFixed(1)}% share</div>`,
        ]
          .filter(Boolean)
          .join('')
      },
    },
    legend: {
      show: false,
    },
    series: [
      {
        type: 'pie',
        radius: ['44%', '84%'],
        center: ['50%', '50%'],
        avoidLabelOverlap: false,
        minShowLabelAngle: 2,
        itemStyle: {
          borderColor: '#fffaf0',
          borderWidth: 3,
        },
        label: {
          show: false,
        },
        labelLine: {
          show: false,
        },
        data: visibleSlices.map((slice) => ({
          name: slice.name,
          value: slice.value,
          label: labeledSymbols.has(slice.symbol)
            ? {
                show: true,
                position: 'outside',
                alignTo: 'labelLine',
                edgeDistance: 10,
                formatter: `{name|${slice.name}}\n{share|${formatShare(visibleShareBySymbol.get(slice.symbol) ?? 0)} share}  {performance|${formatSignedPercent(slice.point?.gainLossRatio ?? 0)}}`,
                rich: {
                  name: {
                    color: '#16324f',
                    fontFamily: 'Space Grotesk, sans-serif',
                    fontSize: 12,
                    fontWeight: 700,
                    width: 130,
                    overflow: 'truncate',
                    lineHeight: 16,
                  },
                  percent: {
                    color: '#16324f',
                    fontFamily: 'Space Grotesk, sans-serif',
                    fontSize: 11,
                    fontWeight: 700,
                    lineHeight: 16,
                  },
                  share: {
                    color: '#5b7287',
                    fontFamily: 'Space Grotesk, sans-serif',
                    fontSize: 11,
                    fontWeight: 600,
                    lineHeight: 16,
                  },
                  performance: {
                    color: '#16324f',
                    fontFamily: 'Space Grotesk, sans-serif',
                    fontSize: 11,
                    fontWeight: 700,
                    lineHeight: 16,
                  },
                },
              }
            : {
                show: false,
              },
          labelLine: labeledSymbols.has(slice.symbol)
            ? {
                show: true,
                length: 14,
                length2: 10,
                smooth: false,
                lineStyle: {
                  color: '#9fb0bf',
                  width: 1.5,
                },
              }
            : {
                show: false,
              },
        })),
      } satisfies PieSeriesOption,
    ],
    graphic: [
      {
        type: 'text',
        left: 'center',
        top: '41%',
        style: {
          text: 'Total',
          fill: '#5b7287',
          fontFamily: 'Space Grotesk, sans-serif',
          fontSize: 14,
          fontWeight: 600,
        },
      },
      {
        type: 'text',
        left: 'center',
        top: '48%',
        style: {
          text: formatCurrency(visibleTotalValue),
          fill: '#16324f',
          fontFamily: 'Space Grotesk, sans-serif',
          fontSize: 20,
          fontWeight: 700,
        },
      },
    ],
  }

  function updateSelection(symbol: string, isolate: boolean) {
    if (isolate) {
      if (visibleSliceSymbols.length === 1 && visibleSliceSymbols[0] === symbol) {
        setHiddenSymbols([])
        return
      }

      setHiddenSymbols(sliceSymbols.filter((item) => item !== symbol))
      return
    }

    const isVisible = visibleSliceSymbolSet.has(symbol)
    const nextHiddenSymbols = isVisible
      ? [...new Set([...hiddenSymbols, symbol])]
      : hiddenSymbols.filter((item) => item !== symbol)

    setHiddenSymbols(nextHiddenSymbols.length === sliceSymbols.length ? [] : nextHiddenSymbols)
  }

  function handleAssetSelection(symbol: string) {
    updateSelection(symbol, pointerModifierRef.current || modifierKeyRef.current)
    pointerModifierRef.current = false
  }

  function updatePointerModifier(event: {
    metaKey?: boolean
    ctrlKey?: boolean
    event?: {
      metaKey?: boolean
      ctrlKey?: boolean
      event?: {
        metaKey?: boolean
        ctrlKey?: boolean
      }
    }
  }) {
    pointerModifierRef.current = Boolean(
      event.metaKey ||
        event.ctrlKey ||
        event.event?.metaKey ||
        event.event?.ctrlKey ||
        event.event?.event?.metaKey ||
        event.event?.event?.ctrlKey,
    )
  }

  function selectAllSlices() {
    setHiddenSymbols([])
  }

  function invertSliceSelection() {
    setHiddenSymbols(
      sliceSymbols.filter((symbol) => visibleSliceSymbolSet.has(symbol)),
    )
  }

  return (
    <>
      <div className="panel allocation-panel allocation-panel--chart">
        <div className="panel__header">
          <div>
            <p className="eyebrow">Allocation</p>
            <h2>Portfolio repartition</h2>
            <p className="chart-toolbar__hint">Cmd-click an asset to isolate it.</p>
          </div>
          <div className="allocation-panel__header-actions">
            <div className="chart-toolbar">
              <button
                type="button"
                className="button button--ghost"
                onClick={selectAllSlices}
              >
                Show all
              </button>
              <button
                type="button"
                className="button button--ghost"
                onClick={invertSliceSelection}
              >
                Invert
              </button>
            </div>
            <label className="allocation-panel__date">
              <span>Date</span>
              <input
                type="date"
                min={minDate}
                max={maxDate}
                value={effectiveSelectedDate}
                onChange={(event) => setSelectedDate(event.target.value)}
              />
            </label>
          </div>
        </div>

        <div className="allocation-panel__meta">
          Snapshot on {formatIsoToInputDate(snapshot.date)}
        </div>

        <div className="allocation-panel__chart-body">
          <ReactECharts
            option={option}
            onEvents={{
              mousedown: (params: {
                event?: {
                  metaKey?: boolean
                  ctrlKey?: boolean
                  event?: {
                    metaKey?: boolean
                    ctrlKey?: boolean
                  }
                }
              }) => {
                updatePointerModifier(params)
              },
              click: (params: { name?: string }) => {
                const slice = visibleSlices.find((item) => item.name === params.name)
                if (!slice) {
                  return
                }

                handleAssetSelection(slice.symbol)
              },
            }}
            style={{ height: 360, width: '100%' }}
          />
        </div>
      </div>

      <div className="panel allocation-panel allocation-panel--details">
        <div className="panel__header">
          <div>
            <p className="eyebrow">Allocation</p>
            <h2>Detailed table</h2>
          </div>
          <div className="allocation-panel__details-summary">
            <strong>{formatCurrency(visibleTotalValue)}</strong>
            <span>{visibleSlices.length} visible assets</span>
          </div>
        </div>

        <div className="allocation-panel__meta">
          Snapshot on {formatIsoToInputDate(snapshot.date)}
        </div>

        <div className="allocation-table" aria-label="Portfolio allocation details">
          <div className="allocation-table__header" aria-hidden="true">
            <span>Asset</span>
            <span>Value</span>
            <span>Invested</span>
            <span>Position</span>
            <span>P/L</span>
            <span>Share</span>
          </div>

          <div className="allocation-panel__legend">
            {slices.map((slice, index) => (
              <button
                key={slice.symbol}
                type="button"
                className={`allocation-table__row${
                  visibleSliceSymbolSet.has(slice.symbol)
                    ? ''
                    : ' allocation-table__row--muted'
                }`}
                onMouseDown={(event) => {
                  updatePointerModifier(event)
                }}
                onClick={() => handleAssetSelection(slice.symbol)}
              >
                <span className="allocation-table__asset">
                  <span
                    className="allocation-panel__swatch"
                    style={{
                      backgroundColor:
                        chartPalette[index % chartPalette.length],
                    }}
                  />
                  <span className="allocation-table__asset-text">
                    <strong>{slice.name}</strong>
                    <span>{slice.symbol}</span>
                  </span>
                </span>
                <span className="allocation-table__value">
                  <strong>{formatCurrency(slice.value)}</strong>
                  {formatOriginalAmountText(slice.point) ? (
                    <span>{formatOriginalAmountText(slice.point)}</span>
                  ) : null}
                </span>
                <span className="allocation-table__value">
                  <strong>
                    {slice.point ? formatCurrency(slice.point.investedAmount) : 'N/A'}
                  </strong>
                  {slice.point && formatAverageBuyText(slice.point) ? (
                    <span>{formatAverageBuyText(slice.point)}</span>
                  ) : null}
                </span>
                <span className="allocation-table__position">
                  {slice.point ? (
                    <>
                      <strong>{formatDecimal(slice.point.quantityHeld)}</strong>
                      <span>{formatCurrency(slice.point.close)}</span>
                      {formatOriginalPriceText(slice.point) ? (
                        <span>{formatOriginalPriceText(slice.point)}</span>
                      ) : null}
                    </>
                  ) : (
                    'N/A'
                  )}
                </span>
                <span
                  className={`allocation-table__performance ${
                    slice.point && slice.point.gainLossAmount < 0
                      ? 'allocation-table__performance--negative'
                      : 'allocation-table__performance--positive'
                  }`}
                >
                  <strong>
                    {slice.point ? formatSignedCurrency(slice.point.gainLossAmount) : 'N/A'}
                  </strong>
                  {slice.point ? (
                    <span>{formatSignedPercent(slice.point.gainLossRatio)}</span>
                  ) : null}
                </span>
                <span className="allocation-table__share">
                  {formatShare(visibleShareBySymbol.get(slice.symbol) ?? 0)}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}

function formatShare(value: number) {
  return formatPercent(value)
}

function formatOriginalAmount(point: PortfolioComputation['assetSeries'][string][number] | undefined) {
  const text = formatOriginalAmountText(point)

  return text ? `<div style="opacity:0.72">${text}</div>` : ''
}

function formatOriginalAmountText(
  point: PortfolioComputation['assetSeries'][string][number] | undefined,
) {
  if (!point?.originalClose || !point.originalCurrency || point.originalCurrency === 'EUR') {
    return undefined
  }

  return formatCurrencyAmount(
    point.quantityHeld * point.originalClose,
    point.originalCurrency,
  )
}

function formatOriginalPriceText(
  point: PortfolioComputation['assetSeries'][string][number],
) {
  if (!point.originalClose || !point.originalCurrency || point.originalCurrency === 'EUR') {
    return undefined
  }

  return formatCurrencyAmount(point.originalClose, point.originalCurrency)
}

function formatAverageBuyText(
  point: PortfolioComputation['assetSeries'][string][number],
) {
  if (point.quantityHeld <= 0 || point.investedAmount <= 0) {
    return undefined
  }

  if (
    !point.averageBuyPriceOriginal ||
    !point.originalCurrency ||
    point.originalCurrency === 'EUR'
  ) {
    return `Avg buy ${formatCurrency(point.averageBuyPrice)}`
  }

  return `Avg buy ${formatCurrency(point.averageBuyPrice)} (${formatCurrencyAmount(point.averageBuyPriceOriginal, point.originalCurrency)})`
}

function sliceForName(
  slices: Array<{
    name: string
    point: PortfolioComputation['assetSeries'][string][number] | undefined
  }>,
  name: string,
) {
  return slices.find((slice) => slice.name === name)
}
