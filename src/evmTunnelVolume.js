import { constants } from "./constants";
import { getYesterday } from "./date";
import { addUsdRate } from "./prices";
import {
  generateTokenHeaders,
  getLastRowWithData,
  writeHeaders,
} from "./spreadsheets";
import { requestSubgraph, subgraphPaginate } from "./subgraph";
import { addTokenMetadata } from "./tokens";

export const createEvmTunnelingVolume = function () {
  /**
   * Queries the Deposits subgraph from Ethereum Mainnet, filtering by the given timestamp.
   * It should retrieve all the data for 1 day, paginating if needed (synchronously).
   */
  const getDeposits = function (fromTimestamp) {
    const basePayload = {
      query: `query GetEvmDeposits ($fromTimestamp: String!, $toTimestamp: String!, $limit: Int!, $orderBy: String!, $orderDirection: String!, $skip: Int!) {
        deposits(first: $limit, orderBy: $orderBy, orderDirection: $orderDirection, skip: $skip, where: { timestamp_gte: $fromTimestamp, timestamp_lt: $toTimestamp }) {
          amount,
          blockNumber,
          l1ChainId,
          l1Token,
          l2ChainId,
          l2Token,
          timestamp,
          transactionHash
        }
      }`,
      variables: {
        fromTimestamp: fromTimestamp.toString(),
        l1ChainId: 1, // Ethereum Mainnet chain Id,
        orderBy: "timestamp",
        orderDirection: "asc",
        toTimestamp: (fromTimestamp + 86400 - 1).toString(),
      },
    };
    const allDeposits = subgraphPaginate({
      getter: (response) => response.deposits,
      requestFn({ limit, skip }) {
        const payload = JSON.parse(
          JSON.stringify({
            ...basePayload,
            variables: { ...basePayload.variables, limit, skip },
          }),
        );
        return requestSubgraph({
          payload,
          subgraphId: "443cSh2tPs3qSCvNehnGd7hkya4MPoH7FEYdsDXQeYeY",
        });
      },
    });
    return allDeposits.map((deposit) => ({
      ...deposit,
      amount: BigInt(deposit.amount),
      id: deposit.l2Token,
      timestamp: Number(deposit.timestamp) * 1000,
    }));
  };

  const getWithdrawals = function (fromTimestamp) {
    const basePayload = {
      query: `query GetEvmWithdrawals ($fromTimestamp: String!, $toTimestamp: String!, $limit: Int!, $orderBy: String!, $orderDirection: String!, $skip: Int!) {
        evmWithdrawals(first: $limit, orderBy: $orderBy, orderDirection: $orderDirection, skip: $skip, where: { timestamp_gte: $fromTimestamp, timestamp_lt: $toTimestamp }) {
          amount,
          l1ChainId,
          l1Token,
          l2ChainId,
          l2Token,
          timestamp,
          transactionHash
        }
      }`,
      variables: {
        fromTimestamp: fromTimestamp.toString(),
        l1ChainId: 1, // Ethereum Mainnet chain Id,
        orderBy: "timestamp",
        orderDirection: "asc",
        toTimestamp: (fromTimestamp + 86400 - 1).toString(),
      },
    };
    const allWithdrawals = subgraphPaginate({
      getter: (response) => response.evmWithdrawals,
      requestFn({ limit, skip }) {
        const payload = JSON.parse(
          JSON.stringify({
            ...basePayload,
            variables: { ...basePayload.variables, limit, skip },
          }),
        );
        return requestSubgraph({
          payload,
          subgraphId: "77x4fbDsVMm66pGUWBfVMzsUDec71eNSfHb1PeMhxKco",
        });
      },
    });
    return allWithdrawals.map((withdrawal) => ({
      ...withdrawal,
      amount: BigInt(withdrawal.amount),
      id: withdrawal.l2Token,
      timestamp: Number(withdrawal.timestamp) * 1000,
    }));
  };

  const getValues = ({ data, headers, lastRow, offset = 0, sheet }) =>
    headers.map(function (header) {
      if (!header.endsWith(constants.usdSuffix)) {
        const token = data.find(({ symbol }) => symbol === header);
        if (!token) {
          return "0";
        }
        const { decimals, total } = token;
        return `=${total}/(10^${decimals})`;
      }
      // it's a usd price, so it should just multiply the usd rate with the token
      const baseSymbol = header.replace(constants.usdSuffix, "");
      const baseTokenColumn = headers.findIndex((h) => h === baseSymbol);
      const token = data.find(({ symbol }) => symbol === baseSymbol);
      if (!token) {
        return "0";
      }
      // default to zero if prices are not set, so we don't break everything
      const { usdRate = "0" } = token;
      // Skip the Date and 3 total columns
      const defaultOffset = 4;
      // sheets are 1-index based
      const range = sheet.getRange(
        lastRow + 1,
        baseTokenColumn + defaultOffset + offset + 1,
      );
      return `=${range.getA1Notation()}*${usdRate}`;
    });

  const reduceTunnelVolume = (operations) =>
    operations.reduce(function (acc, operation) {
      const { amount, decimals, symbol, usdRate } = operation;
      const existing = acc.find((o) => o.symbol === symbol);
      if (existing) {
        existing.total += amount;
      } else {
        acc.push({
          decimals,
          symbol,
          total: amount,
          usdRate,
        });
      }
      return acc;
    }, []);

  function getTvlFormula({ headers, lastRow, prefix, sheet }) {
    // the TVL should sum all the columns that end with the USD suffix. All suffixed tokens
    // must be at the end, so by finding the first usd token, we can get the whole range
    // Remember, sheets are 1-index based
    const filterFn = (header) =>
      header.endsWith(constants.usdSuffix) && header.startsWith(prefix);
    const startUsdIndex = headers.findIndex(filterFn) + 1;
    const endUsdIndex = headers.findLastIndex(filterFn) + 1;
    const startRange = sheet.getRange(lastRow + 1, startUsdIndex);
    const endRange = sheet.getRange(lastRow + 1, endUsdIndex);
    return `=SUM(${startRange.getA1Notation()}:${endRange.getA1Notation()})`;
  }

  const getExistingHeaders = function ({ prefix, sheet }) {
    const [headers] = sheet
      .getRange(1, 1, 1, sheet.getLastColumn())
      .getValues();
    return headers
      .filter(
        (header) =>
          // Tokens appear twice on headers, one in the token form and another in USD
          header.startsWith(prefix) && !header.endsWith(constants.usdSuffix),
      )
      .map((header) => ({
        symbol: header
          .replace(prefix, "")
          .replace(constants.usdSuffix, "")
          .trim(),
      }));
  };

  // Returns a formula string for the "Total Volume (USD)" cell
  const getTotalVolumeCell = function ({ lastRow, sheet }) {
    // Inflow is column 3, Outflow is column 4 (1-based)
    const inflowCell = sheet.getRange(lastRow + 1, 3).getA1Notation();
    const outflowCell = sheet.getRange(lastRow + 1, 4).getA1Notation();
    return `=${inflowCell} - ${outflowCell}`;
  };

  const addEvmTunnelVolume = function ({ prices, tokenList }) {
    const inflowPrefix = "Inflow";
    const outflowPrefix = "Outflow";
    const tunnelVolumeSheet =
      SpreadsheetApp.getActiveSpreadsheet().getSheetByName(
        "Tunnel Volume (EVM)",
      );

    const lastRow = getLastRowWithData(tunnelVolumeSheet);

    const fromTimestamp = getYesterday();

    const deposits = getDeposits(fromTimestamp)
      .map(addTokenMetadata(tokenList))
      .map(addUsdRate(prices));

    const withdrawals = getWithdrawals(fromTimestamp)
      .map(addTokenMetadata(tokenList))
      .map(addUsdRate(prices));

    const depositHeaders = generateTokenHeaders(
      getExistingHeaders({
        prefix: inflowPrefix,
        sheet: tunnelVolumeSheet,
      }).concat(deposits),
    );
    const withdrawalHeaders = generateTokenHeaders(
      getExistingHeaders({
        prefix: outflowPrefix,
        sheet: tunnelVolumeSheet,
      }).concat(withdrawals),
    );

    const symbolHeaders = [
      ...depositHeaders.map(
        (symbolHeader) => `${inflowPrefix} ${symbolHeader}`,
      ),
      ...withdrawalHeaders.map(
        (symbolHeader) => `${outflowPrefix} ${symbolHeader}`,
      ),
    ];

    const headers = [
      "Date",
      "Total Volume (USD)",
      "Total Inflow (USD)",
      "Total Outflow (USD)",
      ...symbolHeaders,
    ];

    writeHeaders({
      headers,
      sheet: tunnelVolumeSheet,
    });

    const depositValues = getValues({
      data: reduceTunnelVolume(deposits),
      headers: depositHeaders,
      lastRow,
      sheet: tunnelVolumeSheet,
    });

    const withdrawalValues = getValues({
      data: reduceTunnelVolume(withdrawals),
      headers: withdrawalHeaders,
      lastRow,
      // we must skip the deposit headers
      offset: depositHeaders.length,
      sheet: tunnelVolumeSheet,
    });

    const values = [
      // Running today, show yesterday's data as the day is already complete
      new Date(fromTimestamp * 1000).toISOString().split("T")[0],
      // Difference of Inflows and Outflows
      getTotalVolumeCell({ lastRow, sheet: tunnelVolumeSheet }),
      // Inflow TVL formula
      getTvlFormula({
        headers,
        lastRow,
        prefix: inflowPrefix,
        sheet: tunnelVolumeSheet,
      }),
      // Outflow TVL formula
      getTvlFormula({
        headers,
        lastRow,
        prefix: outflowPrefix,
        sheet: tunnelVolumeSheet,
      }),
      ...depositValues,
      ...withdrawalValues,
    ];

    tunnelVolumeSheet
      .getRange(lastRow + 1, 1, 1, values.length)
      .setValues([values]);
  };

  return {
    addEvmTunnelVolume,
  };
};
