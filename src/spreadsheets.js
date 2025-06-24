import { constants } from "./constants";
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

/**
 * Deterministically generates the headers for a spreadsheet, based on the symbol.
 */
export const generateTokenHeaders = (tokens) => [
  ...new Set(
    tokens
      .map(({ symbol }) => symbol)
      .sort()
      .concat(
        tokens.map(({ symbol }) => `${symbol}${constants.usdSuffix}`).sort(),
      ),
  ),
];

/**
 * This function writes a list of headers into a spreadsheet. If headers already exist,
 * it adds new columns to match the new ordered list. Note that it expects a deterministic sorted list of headers.
 */
export const writeHeaders = function ({ headers, sheet }) {
  const lastRowWithData = getLastRowWithData(sheet);
  // if there are no headers, this is the first time, so we must write all of them
  // note that
  if (lastRowWithData === 1) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    return;
  }
  // let's match the current headers with the ones calculated. If there's a mismatch, it means
  // a new header appeared. If so, we must add a new column.
  // if there are headers, we must check if there's any new header that must be added
  // by default, add them to the right, and default all values to zero
  for (let columnIndex = 1; columnIndex <= headers.length; columnIndex++) {
    const headerCell = sheet.getRange(1, columnIndex);
    const headerValue = headers[columnIndex - 1];
    const currentHeaderValue = headerCell.getValue();
    if (currentHeaderValue === headerValue) {
      // values match - nothing to do here
      continue;
    }
    // there's a mismatch, so we must
    // 1. Add a new column to the right
    sheet.insertColumnAfter(columnIndex - 1);
    // 2. Set the header for the new column
    sheet.getRange(1, columnIndex).setValue(headerValue);
    // 3. Fill all the previous values with "0"
    sheet.getRange(2, columnIndex, lastRowWithData - 1, 1).setValue(0);
  }
};

export const writeValuesRow = ({ lastRow, sheet, values }) =>
  sheet.getRange(lastRow + 1, 1, 1, values.length).setValues([values]);
