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

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]

    if (!file) {
      return
    }

    await onUpload(await file.text())

    if (inputRef.current) {
      inputRef.current.value = ''
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
          void onLoadSample()
        }}
        disabled={disabled}
      >
        Load sample
      </button>
    </div>
  )
}
