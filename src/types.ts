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

export interface PrivateOffer extends OrderBookEntry {
  in_contract: string;
  out_contract: string;
  fees: string;
  when: number;
  ftSender: string;
  stxSender: string;
  ftSenderBns: string | null;
  stxSenderBns: string | null;
  expiredHeight: number | null;
}

export interface PrivateOffersResponse {
  privateBids: PrivateOffer[];
  privateAsks: PrivateOffer[];
}

export interface UserOffersResponse {
  userBids: PrivateOffer[];
  userAsks: PrivateOffer[];
}
