import { DataGrid, type Column } from 'react-data-grid'
import type { TransactionCsvRow } from '../types/transaction'

type GridRow = TransactionCsvRow & {
  errorsSummary: string
}

type TransactionsGridProps = {
  rows: TransactionCsvRow[]
  errorsById: Record<string, string[]>
  invalidRowCount: number
  onRowsChange: (rows: TransactionCsvRow[]) => Promise<void>
}

const columns: Column<GridRow>[] = [
  { key: 'date', name: 'Date', editable: true, resizable: true },
  { key: 'name', name: 'Name', editable: true, resizable: true },
  { key: 'symbol', name: 'ISIN', editable: true, resizable: true },
  { key: 'quantity', name: 'Quantity', editable: true, resizable: true },
  { key: 'unitPrice', name: 'Price', editable: true, resizable: true },
  { key: 'account', name: 'Account', editable: true, resizable: true },
  { key: 'comments', name: 'Comments', editable: true, resizable: true },
  { key: 'errorsSummary', name: 'Errors', resizable: true },
]

export function TransactionsGrid({
  rows,
  errorsById,
  invalidRowCount,
  onRowsChange,
}: TransactionsGridProps) {
  const gridRows = rows.map((row) => ({
    ...row,
    errorsSummary: (errorsById[row.id] ?? []).join(' | '),
  }))

  return (
    <div className="panel panel--table">
      <div className="panel__header">
        <div>
          <p className="eyebrow">Transactions</p>
          <h2>Editable CSV ledger</h2>
        </div>
      </div>
      {invalidRowCount > 0 ? (
        <p className="panel__notice panel__notice--warning">
          {invalidRowCount} row{invalidRowCount === 1 ? '' : 's'} contain invalid data. Fix the highlighted entries in the grid to restore chart updates.
        </p>
      ) : null}
      <DataGrid
        className="rdg-light transactions-grid"
        columns={columns}
        rows={gridRows}
        rowHeight={42}
        headerRowHeight={44}
        enableVirtualization
        onRowsChange={(nextRows: GridRow[]) => {
          void onRowsChange(nextRows.map(stripErrorsSummary))
        }}
      />
    </div>
  )
}

function stripErrorsSummary(row: GridRow): TransactionCsvRow {
  return {
    id: row.id,
    date: row.date,
    name: row.name,
    symbol: row.symbol,
    quantity: row.quantity,
    unitPrice: row.unitPrice,
    account: row.account,
    comments: row.comments,
  }
}
