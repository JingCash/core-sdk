export interface JingSDKConfig {
    API_URL: string;
    API_KEY: string;
}
export interface OrderBookEntry {
    id: number;
    amount: number;
    ustx: number;
    price: number;
    status: string;
}
export interface OrderBook {
    bids: OrderBookEntry[];
    asks: OrderBookEntry[];
}
