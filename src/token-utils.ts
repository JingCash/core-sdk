import { TokenMap, TokenMapInverse, STX_DECIMALS } from "./constants";

export interface TokenInfo {
  ft: string;
  contractAddress: string;
  contractName: string;
  assetName: string;
}

export function getTokenInfo(pairString: string): TokenInfo | null {
  const symbol = pairString.split("-")[0];
  const ft = TokenMap[symbol];
  if (!ft) return null;

  const [contractPart, assetName] = ft.split("::");
  const [contractAddress, contractName] = contractPart.split(".");

  return {
    ft,
    contractAddress,
    contractName,
    assetName,
  };
}

export function getSupportedPairs(): string[] {
  return Object.keys(TokenMap).map((symbol) => `${symbol}-STX`);
}

export function getTokenSymbol(ft: string): string {
  if (!ft) return "Unknown";
  const [contractAddress, contractNameWithToken] = ft.split(".");
  const contractName = contractNameWithToken?.split("::")[0];
  const fullFt = Object.keys(TokenMapInverse).find((key) =>
    key.startsWith(`${contractAddress}.${contractName}`)
  );
  return fullFt ? TokenMapInverse[fullFt] : "Unknown Token";
}

export function getMarketPair(contract: string): string {
  if (!contract) return "UNKNOWN-STX";
  const [contractAddress, contractNameWithToken] = contract.split(".");
  const contractName = contractNameWithToken?.split("::")[0];
  const fullFt = Object.keys(TokenMapInverse).find((key) =>
    key.startsWith(`${contractAddress}.${contractName}`)
  );
  const symbol = fullFt ? TokenMapInverse[fullFt] : "UNKNOWN";
  return `${symbol}-STX`;
}

// Fee calculation utilities
export function calculateBidFees(ustx: number): number {
  if (ustx > 10000000000) {
    return Math.ceil(ustx / 450); // 0.25% fee for >10,000 STX
  } else if (ustx > 5000000000) {
    return Math.ceil(ustx / 200); // 0.50% fee for >5,000 STX
  } else {
    return Math.ceil(ustx / 133); // 0.75% fee for <=5,000 STX
  }
}

export function calculateAskFees(amount: number): number {
  return Math.ceil(amount / 400); // 0.25% fee
}

// Unit conversion utilities
export function toMicroUnits(amount: number, decimals: number): number {
  return Math.floor(amount * Math.pow(10, decimals));
}

export function fromMicroUnits(microAmount: number, decimals: number): number {
  return microAmount / Math.pow(10, decimals);
}

export function formatAmount(
  amount: number,
  decimals: number,
  symbol: string
): string {
  const regular = fromMicroUnits(amount, decimals);
  return `${regular} ${symbol} (${amount} μ${symbol})`;
}
