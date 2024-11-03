import { JingSDKConfig, OrderBook } from "./types";
export declare class JingSDK {
    private readonly apiUrl;
    private readonly apiKey;
    constructor(config: JingSDKConfig);
    private fetch;
    getOrderBook(pair: string): Promise<OrderBook>;
    private formatOrderBookEntry;
}
export * from "./types";
