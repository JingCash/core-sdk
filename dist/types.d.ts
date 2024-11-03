export interface JingSDKConfig {
    API_URL: string;
    API_KEY: string;
}
export type StxAskStatus = "make-ask" | "take-ask" | "done" | "open" | "cancelling" | "processing" | "re-pricing";
export type StxBidStatus = "make-bid" | "take-bid" | "done" | "open" | "cancelling" | "processing" | "re-pricing";
export interface StxAsk {
    id: number;
    in_contract: string;
    amount: number;
    in_decimals: number;
    ftSender: string;
    ftSenderBns: string | null;
    out_contract: string;
    ustx: number;
    out_decimals: number;
    stxSender: string | null;
    stxSenderBns: string | null;
    fees: string;
    open: boolean;
    when: number;
    status: StxAskStatus;
    txId: string | null;
    processedAt: number | null;
    expiredHeight?: number | null;
}
export interface StacksBid {
    id: number;
    in_contract: string;
    ustx: number;
    in_decimals: number;
    stxSender: string;
    stxSenderBns: string | null;
    ftSender: string | null;
    ftSenderBns: string | null;
    out_contract: string;
    amount: number;
    out_decimals: number;
    fees: string;
    open: boolean;
    when: number;
    status: StxBidStatus;
    txId: string | null;
    processedAt: number | null;
    expiredHeight?: number | null;
}
export interface OrderBook {
    bids: StacksBid[];
    asks: StxAsk[];
}
export interface ApiResponse<T> {
    results: T[];
    [key: string]: any;
}
export interface PrivateOffersResponse {
    privateBids: StacksBid[];
    privateAsks: StxAsk[];
}
export interface UserOffersResponse {
    userBids: StacksBid[];
    userAsks: StxAsk[];
}
