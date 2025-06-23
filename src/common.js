import { getPrices } from "./prices";
import { getTokenList } from "./tokenList";

export const getCommonData = function () {
  const prices = getPrices();

  const tokenList = getTokenList();

  return {
    prices,
    tokenList,
  };
};
