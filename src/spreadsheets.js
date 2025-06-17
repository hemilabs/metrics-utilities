/**
 * This function checks the complete spreadsheet, and gets the last row with data.
 * As usually each metric takes one entire row, the last row + 1 will give the row
 * where to paste the next snapshot.
 */
export function getLastRowWithData(sheet) {
  const rowsWithValue = sheet
    .getRange("A:A")
    .getValues()
    .map((row) => row[0])
    .filter(String); // Remove empty rows
  // Spreadsheets are 1-indexed, so they match the length
  return rowsWithValue.length || 1;
}

const usdSuffix = "_usd";

/**
 * Deterministically generates the headers for a spreadsheet, based on the symbol.
 */
export const generateTokenHeaders = (tokens) => [
  ...new Set(
    tokens
      .map(({ symbol }) => symbol)
      .sort()
      .concat(tokens.map(({ symbol }) => `${symbol}${usdSuffix}`).sort()),
  ),
];
