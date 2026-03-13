export function getResponseText(
  response: { content: Array<{ type: string; text?: string }> },
  index = 0,
): string {
  const item = response.content[index]
  if (item.type !== 'text') {
    throw new Error(
      `Expected content[${index}] to be type "text", got "${item.type}"`,
    )
  }
  return (item as { type: 'text'; text: string }).text
}