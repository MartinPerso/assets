import { db } from './db'

const GOOGLE_SHEET_CSV_URL_KEY = 'google-sheet-csv-url'

export const settingsRepo = {
  async loadGoogleSheetCsvUrl() {
    const record = await db.settings.get(GOOGLE_SHEET_CSV_URL_KEY)

    return {
      value: record?.value ?? '',
      lastModified: record?.lastModified,
    }
  },

  async saveGoogleSheetCsvUrl(value: string) {
    const lastModified = new Date().toISOString()

    await db.settings.put({
      key: GOOGLE_SHEET_CSV_URL_KEY,
      value,
      lastModified,
    })

    return lastModified
  },
}
