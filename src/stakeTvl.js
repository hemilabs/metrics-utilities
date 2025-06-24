import { constants } from "./constants";
import { getDate } from "./date";
import { addUsdRate } from "./prices";
import {
  generateTokenHeaders,
  getLastRowWithData,
  writeHeaders,
  writeValuesRow,
} from "./spreadsheets";
import { addTokenMetadata } from "./tokens";

export const createStakeTvl = function () {
  const stakeUrl = "https://subgraph.hemi.xyz/43111/staked";

  // Skip Date and TVL columns
  const columnOffset = 2;

  const getValues = ({ headers, lastRow, sheet, stakeData }) =>
    headers.map(function (header) {
      if (!header.endsWith(constants.usdSuffix)) {
        const { decimals, totalStaked } = stakeData.find(
          ({ symbol }) => symbol === header,
        );
        return `=${totalStaked}/(10^${decimals})`;
      }
      // it's a usd price, so it should just multiply the usd rate with the token
      const baseSymbol = header.replace(constants.usdSuffix, "");
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
      headers.findIndex((header) => header.endsWith(constants.usdSuffix)) + 1;
    const endUsdIndex = headers.length;
    const startRange = sheet.getRange(lastRow + 1, startUsdIndex);
    const endRange = sheet.getRange(lastRow + 1, endUsdIndex);
    return `=SUM(${startRange.getA1Notation()}:${endRange.getA1Notation()})`;
  }

  function addTvlInfo({ prices, tokenList }) {
    const stakeSheet =
      SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Stake TVL");

    // gather all the information we need
    const { staked } = JSON.parse(UrlFetchApp.fetch(stakeUrl).getContentText());

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

    writeValuesRow({
      lastRow,
      sheet: stakeSheet,
      values,
    });
  }

  return { addTvlInfo };
};
