import { startTransition, useEffect, useState } from 'react'
import {
  parseGoogleSheetPreviewCsv,
  type GoogleSheetPreview,
} from '../data/providers/google-sheet-price-provider'

type GoogleSheetPreviewState = {
  isLoading: boolean
  preview?: GoogleSheetPreview
  error?: string
  refresh: () => void
}

export function useGoogleSheetPreview(
  googleSheetCsvUrl: string,
): GoogleSheetPreviewState {
  const [preview, setPreview] = useState<GoogleSheetPreview>()
  const [error, setError] = useState<string>()
  const [isLoading, setIsLoading] = useState(false)
  const [refreshToken, setRefreshToken] = useState(0)

  useEffect(() => {
    let cancelled = false
    const normalizedUrl = googleSheetCsvUrl.trim()

    if (!normalizedUrl) {
      setPreview(undefined)
      setError(undefined)
      setIsLoading(false)
      return
    }

    setPreview(undefined)
    setError(undefined)
    setIsLoading(true)

    async function loadPreview() {
      try {
        const response = await fetch(normalizedUrl, {
          cache: 'no-store',
        })

        if (!response.ok) {
          throw new Error(
            `Unable to download the published Google Sheets CSV (${response.status}).`,
          )
        }

        const csvText = await response.text()
        const nextPreview = parseGoogleSheetPreviewCsv(csvText)

        if (cancelled) {
          return
        }

        startTransition(() => {
          setPreview(nextPreview)
          setError(undefined)
          setIsLoading(false)
        })
      } catch (loadError) {
        if (cancelled) {
          return
        }

        startTransition(() => {
          setPreview(undefined)
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'Unable to load the published Google Sheets preview.',
          )
          setIsLoading(false)
        })
      }
    }

    void loadPreview()

    return () => {
      cancelled = true
    }
  }, [googleSheetCsvUrl, refreshToken])

  return {
    isLoading,
    preview,
    error,
    refresh: () => {
      startTransition(() => {
        setRefreshToken((token) => token + 1)
      })
    },
  }
}
