import { addUsdRate, getPrices } from "./prices";
import { getTokenList } from "./tokenList";
import { addTokenMetadata } from "./tokens";

const stakeUrl = "https://subgraph.hemi.xyz/43111/staked";

const usdSuffix = "_usd";
// Skip Date and TVL columns
const columnOffset = 2;

/**
 * This functions the complete spreadsheet, and gets the last row with data.
 * As each stake snapshot takes one entire row, the last row + 1 will give the row
 * where to paste the next stake snapshot.
 */
function getLastRowWithData(sheet) {
  const rowsWithValue = sheet
    .getRange("A:A")
    .getValues()
    .map((row) => row[0])
    .filter(String); // Remove empty rows
  // Spreadsheets are 1-indexed, so they match the length
  return rowsWithValue.length || 1;
}

function getDate() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/**
 * Deterministically generates the headers for the TVL sheet, based on the symbol.
 */
const getHeaders = (stakeData) => [
  ...new Set(
    stakeData
      .map(({ symbol }) => symbol)
      .sort()
      .concat(stakeData.map(({ symbol }) => `${symbol}${usdSuffix}`).sort()),
  ),
];

function writeHeaders({ headers, sheet }) {
  const lastRowWithData = getLastRowWithData(sheet);
  // if there are no headers, this is the first time, so we must write all of them
  // note that
  if (lastRowWithData === 1) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    return;
  }
  // let's match the current headers with the ones calculated. If there's a mismatch, it means
  // a new stake token appeared. If so, we must add a new column
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
}

const getValues = ({ headers, lastRow, sheet, stakeData }) =>
  headers.map(function (header) {
    if (!header.endsWith(usdSuffix)) {
      const { decimals, totalStaked } = stakeData.find(
        ({ symbol }) => symbol === header,
      );
      return `=${totalStaked}/(10^${decimals})`;
    }
    // it's a usd price, so it should just multiply the usd rate with the token
    const baseSymbol = header.replace(usdSuffix, "");
    const baseTokenColumn = headers.findIndex((h) => h === baseSymbol);
    const { usdRate } = stakeData.find(({ symbol }) => symbol === baseSymbol);
    // sheets are 1-index based
    const range = sheet.getRange(
      lastRow + 1,
      baseTokenColumn + columnOffset + 1,
    );
    return `=${range.getA1Notation()}*${usdRate}`;
  });

function getTvlFormula({ headers, lastRow, sheet }) {
  // the TVL should sum all the columns that end with the USD suffix. All suffixed tokens
  // must be at the end, so by finding the first usd token, we can get the whole range
  // Remember, sheets are 1-index based
  const startUsdIndex =
    headers.findIndex((header) => header.endsWith(usdSuffix)) + 1;
  const endUsdIndex = headers.length;
  const startRange = sheet.getRange(lastRow + 1, startUsdIndex);
  const endRange = sheet.getRange(lastRow + 1, endUsdIndex);
  return `=SUM(${startRange.getA1Notation()}:${endRange.getA1Notation()})`;
}

export function addTvlInfo() {
  const stakeSheet =
    SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Stake TVL");

  // gather all the information we need
  const prices = getPrices();
  const { staked } = JSON.parse(UrlFetchApp.fetch(stakeUrl).getContentText());

  const tokenList = getTokenList();

  const stakeData = staked
    .map(addTokenMetadata(tokenList))
    .map(addUsdRate(prices));

  const symbolHeaders = getHeaders(stakeData);

  const lastRow = getLastRowWithData(stakeSheet);

  const headers = ["Date", "TVL", ...symbolHeaders];

  writeHeaders({ headers, sheet: stakeSheet });

  const tokenValues = getValues({
    headers: symbolHeaders,
    lastRow,
    sheet: stakeSheet,
    stakeData,
  });

  const values = [
    getDate(),
    getTvlFormula({ headers, lastRow, sheet: stakeSheet }),
    ...tokenValues,
  ];

  stakeSheet.getRange(lastRow + 1, 1, 1, values.length).setValues([values]);
}
