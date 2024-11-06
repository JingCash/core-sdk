import {
  makeContractCall,
  broadcastTransaction,
  AnchorMode,
  PostConditionMode,
  FungibleConditionCode,
  uintCV,
  someCV,
  noneCV,
  standardPrincipalCV,
  contractPrincipalCV,
  makeStandardSTXPostCondition,
} from "@stacks/transactions";
import type {
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
  fromMicroUnits,
  getTokenSymbol,
  getTokenDecimals,
  calculateBidFees,
  TokenInfo,
} from "./token-utils";
import { JING_CONTRACTS, STX_DECIMALS } from "./constants";
import {
  NetworkType,
  validateNetwork,
  getNetwork,
  getNextNonce,
} from "./network";
import { deriveChildAccount } from "./account";

export class JingCashSDK {
  private readonly API_HOST: string;
  private readonly API_KEY: string;
  private readonly defaultAddress: string;
  private readonly network: NetworkType;

  constructor(config: JingSDKConfig) {
    this.API_HOST = config.API_HOST;
    this.API_KEY = config.API_KEY;
    this.defaultAddress = config.defaultAddress;
    this.network = validateNetwork(config.network);
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

  private isStxAsk(order: StxAsk | StacksBid): order is StxAsk {
    return order.out_contract === "STX";
  }

  private formatDisplayOrder(
    order: StxAsk | StacksBid
  ): DisplayOrder | DisplayBid {
    if (this.isStxAsk(order)) {
      const tokenAmount = fromMicroUnits(order.amount, order.in_decimals);
      const stxAmount = fromMicroUnits(order.ustx, STX_DECIMALS);
      const tokenSymbol = getTokenSymbol(order.in_contract);

      const displayOrder: DisplayOrder = {
        ...order,
        type: "Ask",
        market: `${tokenSymbol}/STX`,
        displayAmount: `${tokenAmount.toString()} ${tokenSymbol}`,
        displayStxAmount: `${stxAmount.toString()} STX`,
        displayPrice: `${(
          stxAmount / tokenAmount
        ).toString()} STX/${tokenSymbol}`,
      };
      return displayOrder;
    } else {
      const tokenAmount = fromMicroUnits(order.amount, order.out_decimals);
      const stxAmount = fromMicroUnits(order.ustx, STX_DECIMALS);
      const tokenSymbol = getTokenSymbol(order.out_contract);

      const displayBid: DisplayBid = {
        ...order,
        type: "Bid",
        market: `${tokenSymbol}/STX`,
        displayAmount: `${tokenAmount.toString()} ${tokenSymbol}`,
        displayStxAmount: `${stxAmount.toString()} STX`,
        displayPrice: `${(
          stxAmount / tokenAmount
        ).toString()} STX/${tokenSymbol}`,
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

      return { results: formattedResults };
    } catch (error) {
      throw new Error(
        `Failed to fetch pending orders: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
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

  async createBidOffer({
    pair,
    stxAmount,
    tokenAmount,
    gasFee,
    recipient,
    expiry,
    accountIndex = 0,
    mnemonic,
  }: {
    pair: string;
    stxAmount: number;
    tokenAmount: number;
    gasFee: number;
    recipient?: string;
    expiry?: number;
    accountIndex?: number;
    mnemonic: string;
  }) {
    if (!getSupportedPairs().includes(pair)) {
      throw new Error(`Unsupported trading pair: ${pair}`);
    }

    const tokenInfo = getTokenInfo(pair);
    if (!tokenInfo) {
      throw new Error(`Failed to get token info for pair: ${pair}`);
    }

    const tokenDecimals = await getTokenDecimals(
      tokenInfo,
      this.network,
      this.defaultAddress
    );

    const ustx = Math.floor(stxAmount * 1_000_000);
    const microTokenAmount = Math.floor(
      tokenAmount * Math.pow(10, tokenDecimals)
    );

    const networkObj = getNetwork(this.network);
    const { address, key } = await deriveChildAccount(
      this.network,
      mnemonic,
      accountIndex
    );
    const nonce = await getNextNonce(this.network, address);

    const fees = calculateBidFees(ustx);

    const txOptions = {
      contractAddress: JING_CONTRACTS.BID.address,
      contractName: JING_CONTRACTS.BID.name,
      functionName: "offer",
      functionArgs: [
        uintCV(ustx),
        uintCV(microTokenAmount),
        recipient ? someCV(standardPrincipalCV(recipient)) : noneCV(),
        contractPrincipalCV(tokenInfo.contractAddress, tokenInfo.contractName),
        contractPrincipalCV(
          JING_CONTRACTS.YIN.address,
          JING_CONTRACTS.YIN.name
        ),
        expiry ? someCV(uintCV(expiry)) : noneCV(),
      ],
      senderKey: key,
      validateWithAbi: true,
      network: networkObj,
      anchorMode: AnchorMode.Any,
      postConditionMode: PostConditionMode.Deny,
      postConditions: [
        makeStandardSTXPostCondition(
          address,
          FungibleConditionCode.LessEqual,
          ustx + fees
        ),
      ],
      nonce,
      fee: gasFee,
    };

    try {
      const transaction = await makeContractCall(txOptions);
      const broadcastResponse = await broadcastTransaction(
        transaction,
        networkObj
      );

      return {
        txid: broadcastResponse.txid,
        details: {
          pair,
          stxAmount,
          tokenAmount,
          fees: fees / 1_000_000,
          gasFee: gasFee / 1_000_000,
          recipient,
          expiry,
          address,
        },
      };
    } catch (error) {
      throw new Error(
        `Failed to create bid offer: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }
}
