import { OrderBook, PrivateOffersResponse, UserOffersResponse, DisplayOrder, DisplayBid } from "./types";
export declare class JingCashSDK {
    private readonly API_HOST;
    private readonly API_KEY;
    constructor(config: {
        API_HOST: string;
        API_KEY: string;
    });
    private fetch;
    private isStxAsk;
    private formatDisplayOrder;
    getPendingOrders(page?: number, limit?: number): Promise<{
        results: (DisplayOrder | DisplayBid)[];
    }>;
    getOrderBook(pair: string): Promise<OrderBook>;
    getPrivateOffers(pair: string, userAddress: string): Promise<PrivateOffersResponse>;
    getUserOffers(pair: string, userAddress: string): Promise<UserOffersResponse>;
}
