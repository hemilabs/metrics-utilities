const tokenListUrl =
  "https://raw.githubusercontent.com/hemilabs/token-list/master/src/hemi.tokenlist.json";

export const getTokenList = () =>
  JSON.parse(UrlFetchApp.fetch(tokenListUrl).getContentText()).tokens.filter(
    // Metrics only use Mainnet data
    (token) => token.chainId === 43111,
  );
