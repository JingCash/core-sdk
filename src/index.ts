import {
  JingSDKConfig,
  OrderBook,
  PrivateOffersResponse,
  UserOffersResponse,
  ApiResponse,
  StxAsk,
  StacksBid,
} from "./types";

export class JingCashSDK {
  // Renamed to match Bitflow's style
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
    userAddress: string,
    ftContract: string
  ): Promise<PrivateOffersResponse> {
    const response = await this.fetch<PrivateOffersResponse>(
      `/token-pairs/${pair}/private-offers?userAddress=${userAddress}&ftContract=${ftContract}`
    );
    return response;
  }

  async getUserOffers(
    pair: string,
    userAddress: string,
    ftContract: string
  ): Promise<UserOffersResponse> {
    const response = await this.fetch<UserOffersResponse>(
      `/token-pairs/${pair}/user-offers?userAddress=${userAddress}&ftContract=${ftContract}`
    );
    return response;
  }
}

export * from "./types";
