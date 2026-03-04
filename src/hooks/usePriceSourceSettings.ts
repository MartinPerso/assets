import { create } from 'zustand'
import { settingsRepo } from '../data/settings-repo'

export const DEFAULT_GOOGLE_SHEET_CSV_URL =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vT_TBC4syT7AiFIO41kQI3uXOvhJZTeGAMl_sHjYjQa68uK-iQy27Y6GsAGlSLNV3_y5T7j39VhlDkj/pub?gid=0&single=true&output=csv'

type PriceSourceSettingsState = {
  googleSheetCsvUrl: string
  isReady: boolean
  isSaving: boolean
  error?: string
  loadFromCache: () => Promise<void>
  saveGoogleSheetCsvUrl: (value: string) => Promise<void>
}

const usePriceSourceSettingsStore = create<PriceSourceSettingsState>((set) => ({
  googleSheetCsvUrl: DEFAULT_GOOGLE_SHEET_CSV_URL,
  isReady: false,
  isSaving: false,

  async loadFromCache() {
    try {
      const cached = await settingsRepo.loadGoogleSheetCsvUrl()
      set({
        googleSheetCsvUrl: cached.value || DEFAULT_GOOGLE_SHEET_CSV_URL,
        isReady: true,
        error: undefined,
      })
    } catch (error) {
      set({
        googleSheetCsvUrl: DEFAULT_GOOGLE_SHEET_CSV_URL,
        isReady: true,
        error:
          error instanceof Error ? error.message : 'Unable to load the saved market data source',
      })
    }
  },

  async saveGoogleSheetCsvUrl(value) {
    const trimmed = value.trim()

    set({
      isSaving: true,
      error: undefined,
    })

    try {
      await settingsRepo.saveGoogleSheetCsvUrl(trimmed)

      set({
        googleSheetCsvUrl: trimmed,
        isSaving: false,
      })
    } catch (error) {
      set({
        isSaving: false,
        error:
          error instanceof Error ? error.message : 'Unable to save price source URL',
      })
    }
  },
}))

export function usePriceSourceSettings() {
  return usePriceSourceSettingsStore()
}
