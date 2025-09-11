const tokenListUrl =
  "https://hemilabs.github.io/token-list/hemi.tokenlist.json";

export const getTokenList = () =>
  JSON.parse(UrlFetchApp.fetch(tokenListUrl).getContentText()).tokens.filter(
    // Metrics only use Mainnet data
    (token) => token.chainId === 43111,
  );
