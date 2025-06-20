import { getDate } from "./date";
import { addUsdRate, getPrices } from "./prices";
import {
  generateTokenHeaders,
  getLastRowWithData,
  writeHeaders,
} from "./spreadsheets";
import { getTokenList } from "./tokenList";
import { addTokenMetadata } from "./tokens";

export const createStakeTvl = function () {
  const stakeUrl = "https://subgraph.hemi.xyz/43111/staked";

  const usdSuffix = "_usd";
  // Skip Date and TVL columns
  const columnOffset = 2;

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

  function addTvlInfo() {
    const stakeSheet =
      SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Stake TVL");

    // gather all the information we need
    const prices = getPrices();
    const { staked } = JSON.parse(UrlFetchApp.fetch(stakeUrl).getContentText());

    const tokenList = getTokenList();

    const stakeData = staked
      .map(addTokenMetadata(tokenList))
      .map(addUsdRate(prices));

    const symbolHeaders = generateTokenHeaders(stakeData);

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

  return { addTvlInfo };
};
