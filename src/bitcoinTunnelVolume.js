import { getYesterday } from "./date";
import { addUsdRate } from "./prices";
import {
  getLastRowWithData,
  writeHeaders,
  writeValuesRow,
} from "./spreadsheets";
import { requestSubgraph, subgraphPaginate } from "./subgraph";
import { addTokenMetadata } from "./tokens";

export const createBtcTunnelingVolume = function () {
  const getTotalVolumeCell = function ({ lastRow, sheet }) {
    // Inflow is column 3, Outflow is column 4 (1-based)
    const inflowCell = sheet.getRange(lastRow + 1, 3).getA1Notation();
    const outflowCell = sheet.getRange(lastRow + 1, 4).getA1Notation();
    return `=${inflowCell} - ${outflowCell}`;
  };

  const reduceOperations = function ({ id, operations, prices, tokenList }) {
    const reduced = operations.reduce(
      function (acc, operation) {
        const { amount, decimals, symbol, usdRate } = operation;
        return {
          ...acc,
          decimals,
          symbol,
          total: acc.total + amount,
          usdRate,
        };
      },
      { id, total: 0 },
    );

    return addUsdRate(prices)(addTokenMetadata(tokenList)(reduced));
  };

  const getBitcoinDeposits = function (fromTimestamp) {
    const basePayload = {
      query: `query GetBtcDeposits($fromTimestamp: String!, $limit: Int!, $toTimestamp: String!, $orderBy: String!, $orderDirection: String!, $skip: Int!) {
        btcConfirmedDeposits(first: $limit, orderBy: $orderBy, orderDirection: $orderDirection, skip: $skip, where: { timestamp_gte: $fromTimestamp, timestamp_lt: $toTimestamp }) {
          depositTxId,
          depositSats,
          timestamp,
        }
      }`,
      variables: {
        fromTimestamp: fromTimestamp.toString(),
        orderBy: "timestamp",
        orderDirection: "asc",
        toTimestamp: (fromTimestamp + 86400 - 1).toString(),
      },
    };

    const bitcoinDeposits = subgraphPaginate({
      getter: (response) => response.btcConfirmedDeposits,
      requestFn({ limit, skip }) {
        const payload = JSON.parse(
          JSON.stringify({
            ...basePayload,
            variables: { ...basePayload.variables, limit, skip },
          }),
        );
        return requestSubgraph({
          payload,
          subgraphId: "7jyx9Ai7y9EYsbxesiPv9fNMaSGYih9NVjUH5UwunA6R",
        });
      },
    });

    return bitcoinDeposits.map((deposit) => ({
      ...deposit,
      amount: Number(deposit.depositSats),
      id: "BTC",
      timestamp: Number(deposit.timestamp) * 1000,
    }));
  };

  const getBitcoinWithdrawals = function (fromTimestamp) {
    const basePayload = {
      query: `query GetBtcWithdrawals($fromTimestamp: String!, $limit: Int!, $toTimestamp: String!, $orderBy: String!, $orderDirection: String!, $skip: Int!) {
        btcWithdrawals(first: $limit, orderBy: $orderBy, orderDirection: $orderDirection, skip: $skip, where: { timestamp_gte: $fromTimestamp, timestamp_lt: $toTimestamp }) {
          amount,
          l2Token,
          timestamp,
          transactionHash
        }
      }`,
      variables: {
        fromTimestamp: fromTimestamp.toString(),
        orderBy: "timestamp",
        orderDirection: "asc",
        toTimestamp: (fromTimestamp + 86400 - 1).toString(),
      },
    };

    const bitcoinWithdrawals = subgraphPaginate({
      getter: (response) => response.btcWithdrawals,
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

    return bitcoinWithdrawals.map((withdrawal) => ({
      ...withdrawal,
      amount: Number(withdrawal.amount),
      id: withdrawal.l2Token,
      timestamp: Number(withdrawal.timestamp) * 1000,
    }));
  };

  const addBitcoinTunnelVolume = function ({ prices, tokenList }) {
    const btcTunnelVolumeSheet =
      SpreadsheetApp.getActiveSpreadsheet().getSheetByName(
        "Tunnel Volume (BTC)",
      );

    const lastRow = getLastRowWithData(btcTunnelVolumeSheet);

    const fromTimestamp = getYesterday();

    const deposits = getBitcoinDeposits(fromTimestamp);

    const withdrawals = getBitcoinWithdrawals(fromTimestamp);

    const headers = [
      "Date",
      "Total Volume (USD)",
      "Total Inflow (USD)",
      "Total Outflow (USD)",
      "Inflow BTC",
      "Inflow BTC_usd",
      "Outflow HemiBTC",
      "Outflow HemiBTC_usd",
    ];

    writeHeaders({
      headers,
      sheet: btcTunnelVolumeSheet,
    });

    const bitcoinInflow = reduceOperations({
      id: "BTC",
      operations: deposits,
      prices,
      tokenList,
    });

    const bitcoinOutflow = reduceOperations({
      // hemiBTC address
      id: "0xAA40c0c7644e0b2B224509571e10ad20d9C4ef28",
      operations: withdrawals,
      prices,
      tokenList,
    });

    const newRow = lastRow + 1;

    const values = [
      // Running today, show yesterday's data as the day is already complete
      new Date(fromTimestamp * 1000).toISOString().split("T")[0],
      // Difference of Inflows and Outflows
      getTotalVolumeCell({ lastRow, sheet: btcTunnelVolumeSheet }),
      // Inflows are equal to 6th column
      `=${btcTunnelVolumeSheet.getRange(newRow, 6).getA1Notation()}`,
      // Outflows are equal to 8th column
      `=${btcTunnelVolumeSheet.getRange(newRow, 8).getA1Notation()}`,
      // btc
      `=${bitcoinInflow.total}/(10^${bitcoinInflow.decimals})`,
      // btc_usd
      `=${btcTunnelVolumeSheet.getRange(newRow, 5).getA1Notation()}*${bitcoinInflow.usdRate}`,
      // hemi_btc
      `=${bitcoinOutflow.total}/(10^${bitcoinOutflow.decimals})`,
      // hemi_btc_usd
      `=${btcTunnelVolumeSheet.getRange(newRow, 7).getA1Notation()}*${bitcoinOutflow.usdRate}`,
    ];

    writeValuesRow({
      lastRow,
      sheet: btcTunnelVolumeSheet,
      values,
    });
  };

  return {
    addBitcoinTunnelVolume,
  };
};
