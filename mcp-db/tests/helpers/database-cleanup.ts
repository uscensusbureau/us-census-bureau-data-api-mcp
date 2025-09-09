import { Client } from 'pg'

export const cleanupWithRetry = async (client: Client, tables: string[]) => {
  const maxRetries = 3

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      for (const table_name of tables) {
        await client.query(
          `TRUNCATE TABLE ${table_name} RESTART IDENTITY CASCADE`,
        )
      }
      return // Success
    } catch (error: unknown) {
      if (error.code === '40P01' && attempt < maxRetries) {
        // Deadlock code detected
        console.log(`Deadlock detected on attempt ${attempt}, retrying...`)
        await new Promise((resolve) => setTimeout(resolve, attempt * 100)) // Exponential backoff
      } else {
        throw error // Re-throw if not a deadlock or max retries exceeded
      }
    }
  }
}
