import { useRef } from 'react'

type CsvUploaderProps = {
  onUpload: (csvText: string) => Promise<void>
  onLoadSample: () => Promise<void>
  disabled?: boolean
}

export function CsvUploader({
  onUpload,
  onLoadSample,
  disabled,
}: CsvUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  function alertCsvLoadingError(error: unknown) {
    const reason =
      error instanceof Error && error.message
        ? error.message
        : 'Unknown CSV loading error.'

    window.alert(
      `CSV loading failed. The file was not imported.\n\nReason: ${reason}`,
    )
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]

    if (!file) {
      return
    }

    try {
      await onUpload(await file.text())
    } catch (error) {
      alertCsvLoadingError(error)
    } finally {
      if (inputRef.current) {
        inputRef.current.value = ''
      }
    }
  }

  async function handleLoadSample() {
    try {
      await onLoadSample()
    } catch (error) {
      alertCsvLoadingError(error)
    }
  }

  return (
    <div className="uploader">
      <input
        ref={inputRef}
        className="uploader__input"
        type="file"
        accept=".csv,text/csv"
        onChange={(event) => {
          void handleFileChange(event)
        }}
        disabled={disabled}
      />
      <button
        type="button"
        className="button button--primary"
        onClick={() => inputRef.current?.click()}
        disabled={disabled}
      >
        Upload CSV
      </button>
      <button
        type="button"
        className="button button--ghost"
        onClick={() => {
          void handleLoadSample()
        }}
        disabled={disabled}
      >
        Load sample
      </button>
    </div>
  )
}
