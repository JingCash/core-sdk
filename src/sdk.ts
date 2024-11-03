import {
  JingSDKConfig,
  OrderBook,
  PrivateOffersResponse,
  UserOffersResponse,
  ApiResponse,
  StxAsk,
  StacksBid,
} from "./types";
import { getTokenInfo, getSupportedPairs } from "./token-utils";

export class JingCashSDK {
  private readonly API_HOST: string;
  private readonly API_KEY: string;

  constructor(config: { API_HOST: string; API_KEY: string }) {
    this.API_HOST = config.API_HOST;
    this.API_KEY = config.API_KEY;
  }

  private async fetch<T>(endpoint: string): Promise<T> {
    const response = await fetch(`${this.API_HOST}${endpoint}`, {
      headers: {
        Authorization: `Bearer ${this.API_KEY}`,
        "X-API-Key": this.API_KEY,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json() as Promise<T>;
  }

  async getOrderBook(pair: string): Promise<OrderBook> {
    if (!getSupportedPairs().includes(pair)) {
      throw new Error(`Unsupported trading pair: ${pair}`);
    }

    const [bidsResponse, asksResponse] = await Promise.all([
      this.fetch<ApiResponse<StacksBid>>(`/token-pairs/${pair}/stx-bids`),
      this.fetch<ApiResponse<StxAsk>>(`/token-pairs/${pair}/stx-asks`),
    ]);

    return {
      bids: bidsResponse.results
        .filter((bid) => bid.status === "open" && bid.open)
        .sort((a, b) => b.ustx / b.amount - a.ustx / a.amount),
      asks: asksResponse.results
        .filter((ask) => ask.status === "open" && ask.open)
        .sort((a, b) => a.ustx / a.amount - b.ustx / b.amount),
    };
  }

  async getPrivateOffers(
    pair: string,
    userAddress: string
  ): Promise<PrivateOffersResponse> {
    const tokenInfo = getTokenInfo(pair);
    if (!tokenInfo) {
      throw new Error(`Unsupported trading pair: ${pair}`);
    }

    const ftContract = `${tokenInfo.contractAddress}.${tokenInfo.contractName}`;
    return this.fetch<PrivateOffersResponse>(
      `/token-pairs/${pair}/private-offers?userAddress=${userAddress}&ftContract=${ftContract}`
    );
  }

  async getUserOffers(
    pair: string,
    userAddress: string
  ): Promise<UserOffersResponse> {
    const tokenInfo = getTokenInfo(pair);
    if (!tokenInfo) {
      throw new Error(`Unsupported trading pair: ${pair}`);
    }

    const ftContract = `${tokenInfo.contractAddress}.${tokenInfo.contractName}`;
    return this.fetch<UserOffersResponse>(
      `/token-pairs/${pair}/user-offers?userAddress=${userAddress}&ftContract=${ftContract}`
    );
  }
}
