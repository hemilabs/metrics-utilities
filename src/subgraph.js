import { constants } from "./constants";

export const requestSubgraph = function ({ payload, subgraphId }) {
  const subgraphUrl = `https://gateway.thegraph.com/api/${constants.subgraphApiKey}/subgraphs/id/${subgraphId}`;

  const options = {
    headers: {
      "Content-Type": "application/json",
      // Requests to subgraphs must use the Portal origin
      Origin: "https://app.hemi.xyz",
    },
    method: "POST",
    payload: JSON.stringify(payload),
  };
  return JSON.parse(UrlFetchApp.fetch(subgraphUrl, options).getContentText())
    .data;
};

/**
 * Utility to paginate subgraph queries using skip/limit.
 * @param {function(skip: number, limit: number): any} requestFn - Function that performs the request and returns the response.
 * @param {function(response: any): Array} getter - Function to extract the array of results from the response.
 * @param {number} [limit=100] - Page size.
 * @returns {Array} - All results concatenated.
 */
export function subgraphPaginate({ getter, limit = 100, requestFn }) {
  const allResults = [];
  let skip = 0;
  let keepGoing = true;
  while (keepGoing) {
    const response = requestFn({ limit, skip });
    const arr = getter(response);
    allResults.push(...getter(response));
    if (arr.length < limit) {
      keepGoing = false;
    } else {
      skip += limit;
    }
  }
  return allResults;
}
