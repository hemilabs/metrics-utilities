const pricesUrl = "https://token-prices.hemi.xyz/";

export const getPrices = function () {
  const { prices } = JSON.parse(UrlFetchApp.fetch(pricesUrl).getContentText());
  return prices;
};

// As some tokens do not have their own prices, they map into the prices of these tokens
// Based on https://github.com/hemilabs/ui-monorepo/blob/main/portal/tokenList/stakeTokens.ts
const priceMaps = {
  ajna: [
    // bwAJNA Hemi
    "0x63D367531B460Da78a9EBBAF6c1FBFC397E5d40A",
    // bwAJNA Ethereum
    "0x936Ab482d6bd111910a42849D3A51Ff80BB0A711",
  ],
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
    // tBTC v2 Hemi
    "0x12B6e6FC45f81cDa81d2656B974E8190e4ab8D93",
    // tBTC v2 Ethereum
    "0x18084fbA666a33d37592fA2633fD49a74DD93a88",
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
    // VUSD HEMI
    "0x7A06C4AeF988e7925575C50261297a946aD204A8",
    // VUSD Ethereum
    "0x677ddbd918637E5F2c79e164D402454dE7dA8619",
  ],
};

export const addUsdRate = (prices) =>
  function (token) {
    // some tokens do not adjust to symbol, so they use this mapping instead
    const symbol =
      Object.keys(priceMaps).find((priceSymbol) =>
        priceMaps[priceSymbol].includes(token.address),
      ) || token.symbol;
    return {
      ...token,
      priceSymbol: symbol.toUpperCase(),
      usdRate: prices[symbol.toUpperCase()],
    };
  };
