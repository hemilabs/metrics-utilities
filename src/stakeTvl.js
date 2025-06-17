import { getPrices } from "./prices";
import { getTokenList } from "./tokenList";
import { addTokenMetadata } from "./tokens";

const stakeUrl = "https://subgraph.hemi.xyz/43111/staked";

const usdSuffix = "_usd";
// Skip Date and TVL columns
const columnOffset = 2;

// As some tokens do not have their own prices, they map into the prices of these tokens
// Based on https://github.com/hemilabs/ui-monorepo/blob/main/portal/tokenList/stakeTokens.ts
const priceMaps = {
  btc: [
    // btBTC
    "0x93919784C523f39CACaa98Ee0a9d96c3F32b593e",
    // enzoBTC
    "0x6A9A65B84843F5fD4aC9a0471C4fc11AFfFBce4a",
    // hemiBTC
    "0xAA40c0c7644e0b2B224509571e10ad20d9C4ef28",
    // iBTC
    "0x8154Aaf094c2f03Ad550B6890E1d4264B5DdaD9A",
    // mBTC
    "0x0Af3EC6F9592C193196bEf220BC0Ce4D9311527D",
    // oBTC
    "0xe3C0FF176eF92FC225096C6d1788cCB818808b35",
    // stBTC
    "0xf6718b2701D4a6498eF77D7c152b2137Ab28b8A3",
    // suBTC
    "0xe85411C030fB32A9D8b14Bbbc6CB19417391F711",
    // tBTC v2
    "0x12B6e6FC45f81cDa81d2656B974E8190e4ab8D93",
    // uBTC
    "0x78E26E8b953C7c78A58d69d8B9A91745C2BbB258",
    // uniBTC
    "0xF9775085d726E782E83585033B58606f7731AB18",
    // ynCoBTCk
    "0x8970a6A9Eae065aA81a94E86ebCAF4F3d4dd6DA1",
  ],
  eth: [
    // egETH
    "0x027a9d301FB747cd972CFB29A63f3BDA551DFc5c",
    // rsETH
    "0xc3eACf0612346366Db554C991D7858716db09f58",
  ],
  usdc: [
    // satUSD
    "0xb4818BB69478730EF4e33Cc068dD94278e2766cB",
    // stargate USDC
    "0xad11a8BEb98bbf61dbb1aa0F6d6F2ECD87b35afA",
  ],
  usdt: [
    // VUSD
    "0x7A06C4AeF988e7925575C50261297a946aD204A8",
  ],
};

const addUsdRate = (prices) =>
  function (stakeToken) {
    // some tokens do not adjust to symbol, so they use this mapping instead
    const symbol =
      Object.keys(priceMaps).find((priceSymbol) =>
        priceMaps[priceSymbol].includes(stakeToken.address),
      ) || stakeToken.symbol;
    return {
      ...stakeToken,
      priceSymbol: symbol.toUpperCase(),
      usdRate: prices[symbol.toUpperCase()],
    };
  };

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
