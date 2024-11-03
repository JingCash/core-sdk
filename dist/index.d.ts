import { OrderBook, PrivateOffersResponse, UserOffersResponse } from "./types";
export declare class JingCashSDK {
    private readonly API_HOST;
    private readonly API_KEY;
    constructor(config: {
        API_HOST: string;
        API_KEY: string;
    });
    private fetch;
    getOrderBook(pair: string): Promise<OrderBook>;
    getPrivateOffers(pair: string, userAddress: string, ftContract: string): Promise<PrivateOffersResponse>;
    getUserOffers(pair: string, userAddress: string, ftContract: string): Promise<UserOffersResponse>;
}
export * from "./types";
