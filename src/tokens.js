const EthOnL2Address = "0xdeaddeaddeaddeaddeaddeaddeaddeaddead0000";

export const addTokenMetadata = (tokenList) =>
  function (token) {
    // handle native token case
    if (token.id === EthOnL2Address) {
      return {
        ...token,
        address: token.id,
        decimals: 18,
        symbol: "ETH",
      };
    }
    const { address, decimals, symbol } = tokenList.find(
      (tokenDefinition) =>
        tokenDefinition.address.toLowerCase() === token.id.toLowerCase(),
    );
    return {
      ...token,
      address,
      decimals,
      symbol,
    };
  };
