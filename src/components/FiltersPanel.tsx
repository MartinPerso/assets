type FiltersPanelProps = {
  accounts: string[]
  selectedAccounts: string[]
  onAccountsChange: (accounts: string[]) => void
  disabled?: boolean
}

export function FiltersPanel({
  accounts,
  selectedAccounts,
  onAccountsChange,
  disabled,
}: FiltersPanelProps) {
  return (
    <div className="panel filters-panel">
      <div className="panel__header">
        <div>
          <p className="eyebrow">Scope</p>
          <h2>Accounts</h2>
        </div>
      </div>

      <div className="filters-panel__section">
        <div className="filters-panel__heading">
          <span>Included in charts</span>
          <button
            type="button"
            className="text-button"
            onClick={() => onAccountsChange(accounts)}
            disabled={disabled}
          >
            Select all
          </button>
        </div>
        <div className="token-list">
          {accounts.map((account) => (
            <button
              key={account}
              type="button"
              className={`token ${
                selectedAccounts.includes(account) ? 'token--active' : ''
              }`}
              onClick={(event) =>
                onAccountsChange(
                  getNextAccountSelection(
                    selectedAccounts,
                    account,
                    accounts,
                    event.metaKey || event.ctrlKey,
                  ),
                )
              }
              disabled={disabled}
            >
              {account}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function toggleValue(current: string[], value: string, all: string[]) {
  if (current.includes(value)) {
    const next = current.filter((entry) => entry !== value)
    return next.length === 0 ? all : next
  }

  return [...current, value]
}

function getNextAccountSelection(
  current: string[],
  value: string,
  all: string[],
  isolate: boolean,
) {
  if (!isolate) {
    return toggleValue(current, value, all)
  }

  return current.length === 1 && current[0] === value ? all : [value]
}
