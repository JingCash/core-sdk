import { TokenMap, TokenMapInverse, STX_DECIMALS } from "./constants";
import {
  NetworkType,
  getNetwork,
  callReadOnlyFunction,
  cvToJSON,
} from "./network";

export async function getTokenDecimals(
  tokenInfo: TokenInfo,
  network: NetworkType,
  senderAddress: string
): Promise<number> {
  const networkObj = getNetwork(network);
  const baseContractName = tokenInfo.contractName.split("::")[0];

  try {
    const result = await callReadOnlyFunction({
      contractAddress: tokenInfo.contractAddress,
      contractName: baseContractName,
      functionName: "get-decimals",
      functionArgs: [],
      network: networkObj,
      senderAddress,
    });

    const jsonResult = cvToJSON(result);
    if (jsonResult.success && jsonResult.value?.value) {
      const decimals = parseInt(jsonResult.value.value);
      if (isNaN(decimals)) {
        throw new Error(
          `Invalid decimal value returned from contract: ${jsonResult.value.value}`
        );
      }
      return decimals;
    }

    throw new Error(`Unexpected response format from contract ${tokenInfo.ft}`);
  } catch (error) {
    throw new Error(
      `Failed to read decimals from token contract ${
        tokenInfo.contractAddress
      }.${baseContractName}: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}
// token.ts
export interface TokenInfo {
  ft: string; // Full token identifier including asset name
  contractAddress: string; // Contract address
  contractName: string; // Full contract name
  assetName: string; // Asset name after :: (for post conditions)
  symbol: string; // Display symbol (e.g., "PEPE")
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
    symbol,
  };
}

export function getTokenInfoFromContract(ftContract: string): TokenInfo {
  // First get the token symbol
  const symbol = getTokenSymbol(ftContract);

  // Use the symbol to get the full contract info from TokenMap
  const fullFtContract = TokenMap[symbol];
  if (!fullFtContract) {
    throw new Error(`Unknown token contract: ${ftContract}`);
  }

  // Now parse the full contract info that includes the asset name
  const [contractPart, assetName] = fullFtContract.split("::");
  const [contractAddress, contractName] = contractPart.split(".");

  return {
    ft: ftContract,
    contractAddress,
    contractName,
    assetName,
    symbol,
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
