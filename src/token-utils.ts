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
  console.log("\nGetting token decimals...");
  console.log("Token Info:", {
    contractAddress: tokenInfo.contractAddress,
    contractName: tokenInfo.contractName,
    ft: tokenInfo.ft,
  });
  console.log("Network:", network);
  console.log("Sender Address:", senderAddress);

  const networkObj = getNetwork(network);
  console.log("Network URL:", networkObj.getCoreApiUrl());

  const baseContractName = tokenInfo.contractName.split("::")[0];
  console.log("Base Contract Name:", baseContractName);

  try {
    console.log("\nTrying 'get-decimals' function...");
    try {
      const result = await callReadOnlyFunction({
        contractAddress: tokenInfo.contractAddress,
        contractName: baseContractName,
        functionName: "get-decimals",
        functionArgs: [],
        network: networkObj,
        senderAddress,
      });

      console.log("Raw result:", result);
      const jsonResult = cvToJSON(result);
      console.log("JSON result:", jsonResult);

      if (jsonResult.success && jsonResult.value?.value) {
        const decimals = parseInt(jsonResult.value.value);
        if (!isNaN(decimals)) {
          console.log("Successfully got decimals:", decimals);
          return decimals;
        }
      }
    } catch (error) {
      console.log("'get-decimals' failed, trying 'decimals' function...");
      console.log("Error was:", error instanceof Error ? error.message : error);

      const result = await callReadOnlyFunction({
        contractAddress: tokenInfo.contractAddress,
        contractName: baseContractName,
        functionName: "decimals",
        functionArgs: [],
        network: networkObj,
        senderAddress,
      });

      console.log("Raw result from 'decimals':", result);
      const jsonResult = cvToJSON(result);
      console.log("JSON result from 'decimals':", jsonResult);

      if (jsonResult.success && jsonResult.value?.value) {
        const decimals = parseInt(jsonResult.value.value);
        if (!isNaN(decimals)) {
          console.log("Successfully got decimals:", decimals);
          return decimals;
        }
      }
    }

    throw new Error(`Unexpected response format from contract ${tokenInfo.ft}`);
  } catch (error) {
    console.error(
      "Final error getting decimals:",
      error instanceof Error ? error.message : error
    );
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
