import {
  JingSDKConfig,
  OrderBook,
  PrivateOffersResponse,
  UserOffersResponse,
  ApiResponse,
  StxAsk,
  StacksBid,
  DisplayOrder,
  DisplayBid,
} from "./types";
import {
  getTokenInfo,
  getSupportedPairs,
  getMarketPair,
  fromMicroUnits,
  getTokenSymbol,
} from "./token-utils";
import { STX_DECIMALS } from "./constants";

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

  // private formatAmount(amount: number, decimals: number): string {
  //   return (amount / Math.pow(10, decimals)).toString();
  // }

  // private formatPrice(
  //   ustx: number,
  //   amount: number,
  //   inDecimals: number,
  //   outDecimals: number
  // ): string {
  //   return (
  //     ustx /
  //     (amount * Math.pow(10, outDecimals - inDecimals))
  //   ).toString();
  // }

  private isStxAsk(order: StxAsk | StacksBid): order is StxAsk {
    // If out_contract is "STX", it's an Ask
    return order.out_contract === "STX";
  }

  private formatDisplayOrder(
    order: StxAsk | StacksBid
  ): DisplayOrder | DisplayBid {
    if (this.isStxAsk(order)) {
      // ASK: Selling tokens for STX (out_contract is STX)
      const tokenAmount = fromMicroUnits(order.amount, order.in_decimals);
      const stxAmount = fromMicroUnits(order.ustx, STX_DECIMALS);
      const tokenSymbol = getTokenSymbol(order.in_contract);

      const displayOrder: DisplayOrder = {
        ...order,
        type: "Ask",
        market: `${tokenSymbol}/STX`,
        displayAmount: `${tokenAmount.toString()} ${tokenSymbol}`,
        displayPrice: `${(
          stxAmount / tokenAmount
        ).toString()} STX/${tokenSymbol}`, // Changed to STX/Token
      };
      return displayOrder;
    } else {
      // BID: Buying tokens with STX (in_contract is STX)
      const tokenAmount = fromMicroUnits(order.amount, order.out_decimals);
      const stxAmount = fromMicroUnits(order.ustx, STX_DECIMALS);
      const tokenSymbol = getTokenSymbol(order.out_contract);

      const displayBid: DisplayBid = {
        ...order,
        type: "Bid",
        market: `${tokenSymbol}/STX`,
        displayAmount: `${tokenAmount.toString()} ${tokenSymbol}`,
        displayPrice: `${(
          stxAmount / tokenAmount
        ).toString()} STX/${tokenSymbol}`, // Changed to STX/Token
      };
      return displayBid;
    }
  }

  async getPendingOrders(
    page: number = 1,
    limit: number = 50
  ): Promise<{ results: (DisplayOrder | DisplayBid)[] }> {
    try {
      const response = await this.fetch<ApiResponse<StxAsk | StacksBid>>(
        `/all-pending-stx-swaps?page=${page}&limit=${limit}`
      );

      const formattedResults = response.results
        .filter(
          (order) => order.status === "open" || order.status === "private"
        )
        .map((order) => this.formatDisplayOrder(order))
        .sort((a, b) => {
          const dateA = a.processedAt ? a.processedAt : 0;
          const dateB = b.processedAt ? b.processedAt : 0;
          return dateB - dateA;
        });

      return {
        results: formattedResults,
      };
    } catch (error) {
      throw new Error(
        `Failed to fetch pending orders: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  // Other methods remain the same...
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
        .sort((a, b) => a.ustx / a.amount - b.ustx / a.amount),
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
