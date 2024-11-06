import { TransactionVersion } from "@stacks/common";
import { StacksNetwork } from "@stacks/network";
import { ClarityValue, TxBroadcastResult } from "@stacks/transactions";
import type { AddressNonces } from "@stacks/stacks-blockchain-api-types";
export type NetworkType = "mainnet" | "testnet" | "devnet" | "mocknet";
export declare function getNetworkByPrincipal(principal: string): NetworkType;
export declare function validateNetwork(network?: string): NetworkType;
export declare function getNetwork(network: NetworkType): StacksNetwork;
export declare function getTxVersion(network: NetworkType): TransactionVersion;
export declare function getApiUrl(network: NetworkType): string;
export interface ReadOnlyFunctionOptions {
    contractAddress: string;
    contractName: string;
    functionName: string;
    functionArgs: ClarityValue[];
    network: StacksNetwork;
    senderAddress: string;
}
export declare function callReadOnlyFunction(options: ReadOnlyFunctionOptions): Promise<ClarityValue>;
export declare function cvToJSON(val: ClarityValue): any;
export declare function logBroadcastResult(broadcastResponse: TxBroadcastResult, from?: string): Promise<void>;
export declare function getNonces(network: NetworkType, address: string): Promise<AddressNonces>;
export declare function getNextNonce(network: NetworkType, address: string): Promise<number>;
