const pricesUrl = "https://token-prices.hemi.xyz/";

export const getPrices = function () {
  const { prices } = JSON.parse(UrlFetchApp.fetch(pricesUrl).getContentText());
  return prices;
};
