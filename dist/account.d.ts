import { NetworkType } from "./network-types";
export declare function deriveChildAccount(network: NetworkType, mnemonic: string, index: number): Promise<{
    address: string;
    key: string;
}>;
