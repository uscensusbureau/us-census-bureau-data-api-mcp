export function buildCitation(url: string): string {
  const apiKey = process.env.CENSUS_API_KEY

  if (!apiKey) {
    return `Source: U.S. Census Bureau Data API (${url})`
  }

  const urlWithoutAPIKey = url.replaceAll(`key=${apiKey}`, 'key=REDACTED')
  return `Source: U.S. Census Bureau Data API (${urlWithoutAPIKey})`
}
