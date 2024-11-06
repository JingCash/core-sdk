import { TransactionVersion } from "@stacks/common";
import { StacksNetwork, StacksMainnet, StacksTestnet } from "@stacks/network";
import {
  callReadOnlyFunction as stacksCallReadOnlyFunction,
  ClarityValue,
  cvToJSON as stacksCvToJSON,
  validateStacksAddress,
  TxBroadcastResult,
} from "@stacks/transactions";
import type { AddressNonces } from "@stacks/stacks-blockchain-api-types";

export type NetworkType = "mainnet" | "testnet" | "devnet" | "mocknet";

export interface ReadOnlyFunctionOptions {
  contractAddress: string;
  contractName: string;
  functionName: string;
  functionArgs: ClarityValue[];
  network: StacksNetwork;
  senderAddress: string;
}

export function getNetworkByPrincipal(principal: string): NetworkType {
  if (validateStacksAddress(principal)) {
    const prefix = principal.substring(0, 2);
    if (prefix === "SP" || prefix === "SM") {
      return "mainnet";
    } else if (prefix === "ST" || prefix === "SN") {
      return "testnet";
    }
  }
  console.log("Invalid principal, using testnet");
  return "testnet";
}

export function validateNetwork(network?: string): NetworkType {
  if (
    network &&
    ["mainnet", "testnet", "devnet", "mocknet"].includes(network)
  ) {
    return network as NetworkType;
  }
  return "testnet";
}

export function getNetwork(network: NetworkType): StacksNetwork {
  switch (network) {
    case "mainnet":
      return new StacksMainnet();
    case "testnet":
      return new StacksTestnet();
    default:
      return new StacksTestnet();
  }
}

export function getTxVersion(network: NetworkType): TransactionVersion {
  switch (network) {
    case "mainnet":
      return TransactionVersion.Mainnet;
    case "testnet":
      return TransactionVersion.Testnet;
    default:
      return TransactionVersion.Testnet;
  }
}

export function getApiUrl(network: NetworkType): string {
  switch (network) {
    case "mainnet":
      return "https://api.hiro.so";
    case "testnet":
      return "https://api.testnet.hiro.so";
    default:
      return "https://api.testnet.hiro.so";
  }
}

export interface ReadOnlyFunctionOptions {
  contractAddress: string;
  contractName: string;
  functionName: string;
  functionArgs: ClarityValue[];
  network: StacksNetwork;
  senderAddress: string;
}

export async function callReadOnlyFunction(options: ReadOnlyFunctionOptions) {
  return stacksCallReadOnlyFunction(options);
}

export function cvToJSON(val: ClarityValue) {
  return stacksCvToJSON(val);
}

export async function logBroadcastResult(
  broadcastResponse: TxBroadcastResult,
  from?: string
) {
  if ("error" in broadcastResponse) {
    console.error("Transaction failed to broadcast");
    console.error(`Error: ${broadcastResponse.error}`);
    if (broadcastResponse.reason) {
      console.error(`Reason: ${broadcastResponse.reason}`);
    }
    if (broadcastResponse.reason_data) {
      console.error(
        `Reason Data: ${JSON.stringify(broadcastResponse.reason_data, null, 2)}`
      );
    }
  } else {
    console.log("Transaction broadcasted successfully!");
    if (from) console.log(`FROM: ${from}`);
    console.log(`TXID: 0x${broadcastResponse.txid}`);
  }
}

// gets the current nonce for the account from the API
// more reliable than @stacks/transactions getNonce()
export async function getNonces(network: NetworkType, address: string) {
  const apiUrl = getApiUrl(network);
  const response = await fetch(
    `${apiUrl}/extended/v1/address/${address}/nonces`
  );
  if (!response.ok) {
    throw new Error(`Failed to get nonce: ${response.statusText}`);
  }
  const data = await response.json();
  return data as AddressNonces;
}

export async function getNextNonce(network: NetworkType, address: string) {
  const nonces = await getNonces(network, address);
  const nextNonce = nonces.possible_next_nonce;
  return nextNonce;
}
