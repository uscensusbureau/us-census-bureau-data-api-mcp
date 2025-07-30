// Function for normalizing SQL to test migration expectations
export const normalizeSQL = (sql: string): string => {
  return sql
    .replace(/\s+/g, ' ')           // Replace multiple whitespace with single space
    .replace(/\s*\n\s*/g, ' ')      // Replace newlines with spaces
    .trim();                        // Remove leading/trailing whitespace
};