import { useEffect, useMemo, useRef, useState } from 'react'
import ReactECharts, { type EChartsInstance } from 'echarts-for-react'
import { chartPalette } from './chartPalette'
import {
  formatCurrency,
  formatCurrencyAmount,
  formatSignedCurrency,
  formatSignedPercent,
} from '../utils/numbers'
import type { PortfolioComputation } from '../types/portfolio'

type PortfolioChartProps = {
  valuation: PortfolioComputation
}

type TooltipRow = {
  seriesId: string
  seriesName: string
  value: [string, number]
}

export function PortfolioChart({ valuation }: PortfolioChartProps) {
  const chartRef = useRef<EChartsInstance | null>(null)
  const modifierKeyRef = useRef(false)
  const isApplyingSelectionRef = useRef(false)
  const [legendSelection, setLegendSelection] = useState<Record<string, boolean>>({})

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

  const symbols = Object.keys(valuation.assetSeries).sort((left, right) => {
    const leftValue = valuation.assetSeries[left].at(-1)?.marketValue ?? 0
    const rightValue = valuation.assetSeries[right].at(-1)?.marketValue ?? 0
    return rightValue - leftValue
  })
  const symbolMetadata = symbols.map((symbol, index) => ({
    symbol,
    name: valuation.assetNames[symbol] ?? symbol,
    color: chartPalette[index % chartPalette.length],
  }))
  const legendNames = [...new Set([...symbolMetadata.map((item) => item.name), 'Total'])]
  const legendSelected = useMemo(
    () =>
      Object.fromEntries(
        legendNames.map((name) => [name, legendSelection[name] !== false]),
      ),
    [legendNames, legendSelection],
  )
  const selectedAssetMetadata = symbolMetadata.filter(
    (item) => legendSelected[item.name] !== false,
  )
  const overlaySeries = buildInvestedOverlaySeries({
    valuation,
    symbols,
    selectedAssets: selectedAssetMetadata,
  })

  useEffect(() => {
    setLegendSelection((previous) => {
      const next = Object.fromEntries(
        legendNames.map((name) => [name, previous[name] !== false]),
      )

      return areSameLegendSelection(previous, next) ? previous : next
    })
  }, [legendNames])

  if (valuation.points.length === 0) {
    return (
      <div className="panel panel--chart chart-empty">
        <div className="panel__header">
          <div>
            <p className="eyebrow">Valuation</p>
            <h2>No chart yet</h2>
          </div>
        </div>
        <p>
          Upload valid transactions to load price history and render the stacked
          valuation view.
        </p>
      </div>
    )
  }

  const option = {
    backgroundColor: 'transparent',
    animationDuration: 400,
    color: symbolMetadata.map((item) => item.color),
    textStyle: {
      fontFamily: 'Space Grotesk, sans-serif',
    },
    grid: {
      left: 24,
      right: 24,
      top: 48,
      bottom: 36,
      containLabel: true,
    },
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(13, 27, 42, 0.94)',
      borderWidth: 0,
      textStyle: {
        color: '#f4f1de',
      },
      formatter: (params: TooltipRow[]) => {
        const rows = [...params]
          .filter((row) => !String(row.seriesId).endsWith('__invested'))
          .sort((left, right) => right.value[1] - left.value[1])
        const total = rows.find((row) => row.seriesName === 'Total')
        const date = rows[0]?.value[0]

        return [
          `<strong>${date ?? ''}</strong>`,
          total ? `<div>Total: ${formatCurrency(total.value[1])}</div>` : '',
          ...rows
            .filter((row) => row.seriesName !== 'Total' && row.value[1] > 0)
            .map(
              (row) => {
                const point = getPointForSeries(valuation, row.seriesName, date)
                const originalAmount = formatOriginalAmount(point)
                const performance = point
                  ? ` <span style="opacity:0.72">Invested ${formatCurrency(point.investedAmount)} | ${formatSignedCurrency(point.gainLossAmount)} (${formatSignedPercent(point.gainLossRatio)})</span>`
                  : ''

                return `<div>${row.seriesName}: ${formatCurrency(row.value[1])}${originalAmount ? ` <span style="opacity:0.72">(${originalAmount})</span>` : ''}${performance}</div>`
              },
            ),
        ].join('')
      },
    },
    legend: {
      top: 4,
      data: legendNames,
      selected: legendSelected,
      textStyle: {
        color: '#16324f',
      },
    },
    xAxis: {
      type: 'time',
      axisLabel: {
        color: '#52677a',
      },
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        color: '#52677a',
        formatter: (value: number) => formatCurrency(value),
      },
      splitLine: {
        lineStyle: {
          color: 'rgba(22, 50, 79, 0.08)',
        },
      },
    },
    dataZoom: [
      {
        type: 'slider',
        height: 18,
        bottom: 8,
      },
    ],
    series: [
      ...symbolMetadata.map(({ symbol, name, color }, index) => ({
        id: `${symbol}__value`,
        name,
        type: 'line',
        stack: 'portfolio',
        symbol: 'none',
        smooth: false,
        showSymbol: false,
        areaStyle: {
          opacity: 0.82,
        },
        lineStyle: {
          width: 1.2,
          color,
        },
        itemStyle: {
          color,
        },
        z: 2 + index,
        data: valuation.assetSeries[symbol].map((point) => [point.date, point.marketValue]),
      })),
      {
        id: 'portfolio__total',
        name: 'Total',
        type: 'line',
        symbol: 'none',
        smooth: false,
        showSymbol: false,
        lineStyle: {
          width: 2.4,
          color: '#0d1b2a',
        },
        itemStyle: {
          color: '#0d1b2a',
        },
        data: valuation.points.map((point) => [point.date, point.totalValue]),
      },
      ...overlaySeries,
    ],
  }

  function handleLegendSelectionChange(params: {
    name?: string
    selected?: Record<string, boolean>
    event?: {
      event?: {
        metaKey?: boolean
        ctrlKey?: boolean
      }
      metaKey?: boolean
      ctrlKey?: boolean
    }
  }) {
    const modifierPressed =
      modifierKeyRef.current ||
      Boolean(
        params.event?.metaKey ||
          params.event?.ctrlKey ||
          params.event?.event?.metaKey ||
          params.event?.event?.ctrlKey,
      )

    if (isApplyingSelectionRef.current) {
      return
    }

    if (!modifierPressed || !params.name) {
      if (params.selected) {
        const selected = params.selected

        setLegendSelection((previous) => {
          const next = toLegendSelection(selected, legendNames, previous)

          return areSameLegendSelection(previous, next) ? previous : next
        })
      }

      return
    }

    const chart = chartRef.current
    if (!chart) {
      return
    }

    isApplyingSelectionRef.current = true

    try {
      const visibleNames = legendNames.filter((name) => params.selected?.[name] !== false)

      if (visibleNames.length === 0) {
        for (const name of legendNames) {
          chart.dispatchAction({
            type: 'legendSelect',
            name,
          })
        }
        setLegendSelection(
          Object.fromEntries(legendNames.map((name) => [name, true])),
        )
        return
      }

      for (const name of legendNames) {
        chart.dispatchAction({
          type: name === params.name ? 'legendSelect' : 'legendUnSelect',
          name,
        })
      }
      setLegendSelection(
        Object.fromEntries(legendNames.map((name) => [name, name === params.name])),
      )
    } finally {
      isApplyingSelectionRef.current = false
    }
  }

  function selectAllSeries() {
    const chart = chartRef.current
    if (!chart) {
      return
    }

    for (const name of legendNames) {
      chart.dispatchAction({
        type: 'legendSelect',
        name,
      })
    }
  }

  function invertSeriesSelection() {
    const chart = chartRef.current
    if (!chart) {
      return
    }

    chart.dispatchAction({ type: 'legendInverseSelect' })
  }

  return (
    <div className="panel panel--chart">
      <div className="panel__header">
        <div>
          <p className="eyebrow">Valuation</p>
          <h2>Stacked portfolio evolution</h2>
          <p className="chart-toolbar__hint">Cmd-click a legend item to isolate it.</p>
        </div>
        <div className="chart-toolbar">
          <button
            type="button"
            className="button button--ghost"
            onClick={selectAllSeries}
          >
            Show all
          </button>
          <button
            type="button"
            className="button button--ghost"
            onClick={invertSeriesSelection}
          >
            Invert
          </button>
        </div>
      </div>
      <ReactECharts
        option={option}
        onChartReady={(instance) => {
          chartRef.current = instance
        }}
        onEvents={{ legendselectchanged: handleLegendSelectionChange }}
        replaceMerge={['series', 'legend']}
        style={{ height: 520, width: '100%' }}
      />
    </div>
  )
}

function getPointForSeries(
  valuation: PortfolioComputation,
  seriesName: string,
  date: string | undefined,
) {
  if (!date) {
    return undefined
  }

  const symbol = Object.keys(valuation.assetNames).find(
    (candidate) => (valuation.assetNames[candidate] ?? candidate) === seriesName,
  )

  return symbol
    ? valuation.assetSeries[symbol]?.find((point) => point.date === date)
    : undefined
}

function formatOriginalAmount(point: PortfolioComputation['assetSeries'][string][number] | undefined) {
  if (!point?.originalClose || !point.originalCurrency || point.originalCurrency === 'EUR') {
    return undefined
  }

  return formatCurrencyAmount(
    point.quantityHeld * point.originalClose,
    point.originalCurrency,
  )
}

function buildInvestedOverlaySeries(input: {
  valuation: PortfolioComputation
  symbols: string[]
  selectedAssets: Array<{ symbol: string; name: string; color: string }>
}) {
  if (input.selectedAssets.length === 1) {
    const selectedAsset = input.selectedAssets[0]
    const series = input.valuation.assetSeries[selectedAsset.symbol] ?? []

    return [
      {
        id: `${selectedAsset.symbol}__invested`,
        name: selectedAsset.name,
        type: 'line',
        symbol: 'none',
        smooth: false,
        showSymbol: false,
        silent: true,
        lineStyle: {
          width: 1.4,
          type: 'dashed',
          color: selectedAsset.color,
          opacity: 0.92,
        },
        itemStyle: {
          color: selectedAsset.color,
        },
        emphasis: {
          disabled: true,
        },
        z: 52,
        data: series.map((point) => [point.date, point.investedAmount] as [string, number]),
      },
    ]
  }

  const totalInvestedSeries = input.valuation.points.map((point, pointIndex) => {
    const investedTotal = input.symbols.reduce((sum, symbol) => {
      return sum + (input.valuation.assetSeries[symbol]?.[pointIndex]?.investedAmount ?? 0)
    }, 0)

    return [point.date, investedTotal] as [string, number]
  })

  return [
    {
      id: 'portfolio__invested_total',
      name: 'Total',
      type: 'line',
      symbol: 'none',
      smooth: false,
      showSymbol: false,
      silent: true,
      lineStyle: {
        width: 1.5,
        type: 'dashed',
        color: '#0d1b2a',
        opacity: 0.86,
      },
      itemStyle: {
        color: '#0d1b2a',
      },
      emphasis: {
        disabled: true,
      },
      z: 52,
      data: totalInvestedSeries,
    },
  ]
}

function areSameLegendSelection(
  left: Record<string, boolean>,
  right: Record<string, boolean>,
) {
  const leftKeys = Object.keys(left)
  const rightKeys = Object.keys(right)

  if (leftKeys.length !== rightKeys.length) {
    return false
  }

  return leftKeys.every((key) => left[key] === right[key])
}

function toLegendSelection(
  selected: Record<string, boolean>,
  legendNames: string[],
  previous: Record<string, boolean>,
) {
  return Object.fromEntries(
    legendNames.map((name) => [name, selected[name] ?? previous[name] ?? true]),
  )
}
