import type { JingSDKConfig, OrderBook, PrivateOffersResponse, UserOffersResponse, DisplayOrder, DisplayBid } from "./types";
export declare class JingCashSDK {
    private readonly API_HOST;
    private readonly API_KEY;
    private readonly defaultAddress;
    private readonly network;
    constructor(config: JingSDKConfig);
    private fetch;
    private isStxAsk;
    private formatDisplayOrder;
    getPendingOrders(page?: number, limit?: number): Promise<{
        results: (DisplayOrder | DisplayBid)[];
    }>;
    getOrderBook(pair: string): Promise<OrderBook>;
    getPrivateOffers(pair: string, userAddress: string): Promise<PrivateOffersResponse>;
    getUserOffers(pair: string, userAddress: string): Promise<UserOffersResponse>;
    createBidOffer({ pair, stxAmount, tokenAmount, gasFee, recipient, expiry, accountIndex, mnemonic, }: {
        pair: string;
        stxAmount: number;
        tokenAmount: number;
        gasFee: number;
        recipient?: string;
        expiry?: number;
        accountIndex?: number;
        mnemonic: string;
    }): Promise<{
        txid: string;
        details: {
            pair: string;
            stxAmount: number;
            tokenAmount: number;
            fees: number;
            gasFee: number;
            recipient: string | undefined;
            expiry: number | undefined;
            address: string;
        };
    }>;
    createAskOffer({ pair, tokenAmount, stxAmount, gasFee, recipient, expiry, accountIndex, mnemonic, }: {
        pair: string;
        tokenAmount: number;
        stxAmount: number;
        gasFee: number;
        recipient?: string;
        expiry?: number;
        accountIndex?: number;
        mnemonic: string;
    }): Promise<{
        txid: string;
        details: {
            pair: string;
            tokenAmount: number;
            stxAmount: number;
            fees: number;
            gasFee: number;
            recipient: string | undefined;
            expiry: number | undefined;
            address: string;
            microTokenAmount: number;
            ustx: number;
            tokenDecimals: number;
        };
    }>;
    private getBidDetails;
    private getAskDetails;
    cancelBid({ swapId, pair, gasFee, accountIndex, mnemonic, }: {
        swapId: number;
        pair: string;
        gasFee: number;
        accountIndex?: number;
        mnemonic: string;
    }): Promise<{
        txid: string;
        details: {
            swapId: number;
            pair: string;
            tokenDecimals: number;
            address: string;
            bidDetails: {
                ustx: number;
                amount: number;
                stxSender: string;
            };
            fees: number;
            gasFee: number;
        };
    }>;
    cancelAsk({ swapId, pair, gasFee, accountIndex, mnemonic, }: {
        swapId: number;
        pair: string;
        gasFee: number;
        accountIndex?: number;
        mnemonic: string;
    }): Promise<{
        txid: string;
        details: {
            swapId: number;
            pair: string;
            tokenDecimals: number;
            address: string;
            askDetails: {
                ustx: number;
                amount: number;
                ftSender: string;
            };
            fees: number;
            gasFee: number;
        };
    }>;
}
