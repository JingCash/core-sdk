import { NetworkType } from "./network";
export declare function getTokenDecimals(tokenInfo: TokenInfo, network: NetworkType, senderAddress: string): Promise<number>;
export interface TokenInfo {
    ft: string;
    contractAddress: string;
    contractName: string;
    assetName: string;
}
export declare function getTokenInfo(pairString: string): TokenInfo | null;
export declare function getSupportedPairs(): string[];
export declare function getTokenSymbol(ft: string): string;
export declare function getMarketPair(contract: string): string;
export declare function calculateBidFees(ustx: number): number;
export declare function calculateAskFees(amount: number): number;
export declare function toMicroUnits(amount: number, decimals: number): number;
export declare function fromMicroUnits(microAmount: number, decimals: number): number;
export declare function formatAmount(amount: number, decimals: number, symbol: string): string;
