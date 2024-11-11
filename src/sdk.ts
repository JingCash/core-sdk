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
  createAssetInfo,
  makeStandardFungiblePostCondition,
  callReadOnlyFunction,
  cvToJSON,
  makeContractFungiblePostCondition,
  makeContractSTXPostCondition,
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
  SwapDetails,
  Market,
} from "./types";
import {
  getTokenInfo,
  getSupportedPairs,
  fromMicroUnits,
  getTokenSymbol,
  getTokenDecimals,
  calculateBidFees,
  TokenInfo,
  calculateAskFees,
  getTokenInfoFromContract,
} from "./token-utils";
import { JING_CONTRACTS, STX_DECIMALS, TokenMap } from "./constants";
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

    // Get token info and extract just the contract part
    const tokenInfo = getTokenInfo(pair);
    if (!tokenInfo) {
      throw new Error(`Failed to get token info for pair: ${pair}`);
    }

    // Extract the contract part before the ::
    const ftContract = `${tokenInfo.contractAddress}.${tokenInfo.contractName}`;

    const [bidsResponse, asksResponse] = await Promise.all([
      this.fetch<ApiResponse<StacksBid>>(
        `/token-pairs/${pair}/stx-bids?ftContract=${ftContract}`
      ),
      this.fetch<ApiResponse<StxAsk>>(
        `/token-pairs/${pair}/stx-asks?ftContract=${ftContract}`
      ),
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

  // In sdk.ts, add this method to JingCashSDK class

  async createAskOffer({
    pair,
    tokenAmount,
    stxAmount,
    gasFee,
    recipient,
    expiry,
    accountIndex = 0,
    mnemonic,
  }: {
    pair: string;
    tokenAmount: number;
    stxAmount: number;
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

    // Convert to micro units
    const microTokenAmount = Math.floor(
      tokenAmount * Math.pow(10, tokenDecimals)
    );
    const ustx = Math.floor(stxAmount * 1_000_000);

    const networkObj = getNetwork(this.network);
    const { address, key } = await deriveChildAccount(
      this.network,
      mnemonic,
      accountIndex
    );
    const nonce = await getNextNonce(this.network, address);

    // Calculate fees (in FT)
    const microFees = calculateAskFees(microTokenAmount);

    const txOptions = {
      contractAddress: JING_CONTRACTS.ASK.address,
      contractName: JING_CONTRACTS.ASK.name,
      functionName: "offer",
      functionArgs: [
        uintCV(microTokenAmount),
        uintCV(ustx),
        recipient ? someCV(standardPrincipalCV(recipient)) : noneCV(),
        contractPrincipalCV(tokenInfo.contractAddress, tokenInfo.contractName),
        contractPrincipalCV(
          JING_CONTRACTS.YANG.address,
          JING_CONTRACTS.YANG.name
        ),
        expiry ? someCV(uintCV(expiry)) : noneCV(),
      ],
      senderKey: key,
      validateWithAbi: true,
      network: networkObj,
      anchorMode: AnchorMode.Any,
      postConditionMode: PostConditionMode.Deny,
      postConditions: [
        makeStandardFungiblePostCondition(
          address,
          FungibleConditionCode.LessEqual,
          microTokenAmount + microFees,
          createAssetInfo(
            tokenInfo.contractAddress,
            tokenInfo.contractName,
            tokenInfo.assetName
          )
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
          tokenAmount,
          stxAmount,
          fees: microFees / Math.pow(10, tokenDecimals),
          gasFee: gasFee / 1_000_000,
          recipient,
          expiry,
          address,
          microTokenAmount,
          ustx,
          tokenDecimals,
        },
      };
    } catch (error) {
      throw new Error(
        `Failed to create ask offer: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  // In JingCashSDK class

  private async getBidDetails(swapId: number): Promise<{
    ustx: number;
    amount: number;
    stxSender: string;
  }> {
    const networkObj = getNetwork(this.network);

    const result = await callReadOnlyFunction({
      contractAddress: JING_CONTRACTS.BID.address,
      contractName: JING_CONTRACTS.BID.name,
      functionName: "get-swap",
      functionArgs: [uintCV(swapId)],
      network: networkObj,
      senderAddress: this.defaultAddress,
    });

    const jsonResult = cvToJSON(result);
    if (!jsonResult.success) throw new Error("Failed to get bid details");

    return {
      ustx: parseInt(jsonResult.value.value.ustx.value),
      amount: parseInt(jsonResult.value.value.amount.value),
      stxSender: jsonResult.value.value["stx-sender"].value,
    };
  }

  private async getAskDetails(swapId: number): Promise<{
    ustx: number;
    amount: number;
    ftSender: string;
  }> {
    const networkObj = getNetwork(this.network);

    const result = await callReadOnlyFunction({
      contractAddress: JING_CONTRACTS.ASK.address,
      contractName: JING_CONTRACTS.ASK.name,
      functionName: "get-swap",
      functionArgs: [uintCV(swapId)],
      network: networkObj,
      senderAddress: this.defaultAddress,
    });

    const jsonResult = cvToJSON(result);
    if (!jsonResult.success) throw new Error("Failed to get ask details");

    return {
      ustx: parseInt(jsonResult.value.value.ustx.value),
      amount: parseInt(jsonResult.value.value.amount.value),
      ftSender: jsonResult.value.value["ft-sender"].value,
    };
  }

  async cancelBid({
    swapId,
    gasFee,
    accountIndex = 0,
    mnemonic,
  }: {
    swapId: number;
    gasFee: number;
    accountIndex?: number;
    mnemonic: string;
  }) {
    const networkObj = getNetwork(this.network);
    const { address, key } = await deriveChildAccount(
      this.network,
      mnemonic,
      accountIndex
    );
    const nonce = await getNextNonce(this.network, address);

    // Get bid details
    const bidDetails = await this.getBidDetails(swapId);
    if (bidDetails.stxSender !== address) {
      throw new Error(
        `Only the bid creator (${bidDetails.stxSender}) can cancel this bid`
      );
    }

    // Get token info from the bid details
    const result = await callReadOnlyFunction({
      contractAddress: JING_CONTRACTS.BID.address,
      contractName: JING_CONTRACTS.BID.name,
      functionName: "get-swap",
      functionArgs: [uintCV(swapId)],
      network: networkObj,
      senderAddress: this.defaultAddress,
    });

    const jsonResult = cvToJSON(result);
    if (!jsonResult.success) throw new Error("Failed to get bid details");

    const ftContract = jsonResult.value.value.ft.value;
    const tokenInfo = getTokenInfoFromContract(ftContract);

    const tokenDecimals = await getTokenDecimals(
      tokenInfo,
      this.network,
      this.defaultAddress
    );
    const fees = calculateBidFees(bidDetails.ustx);

    const postConditions = [
      makeContractSTXPostCondition(
        JING_CONTRACTS.BID.address,
        JING_CONTRACTS.BID.name,
        FungibleConditionCode.Equal,
        bidDetails.ustx
      ),
      makeContractSTXPostCondition(
        JING_CONTRACTS.BID.address,
        JING_CONTRACTS.YIN.name,
        FungibleConditionCode.LessEqual,
        fees
      ),
    ];

    const txOptions = {
      contractAddress: JING_CONTRACTS.BID.address,
      contractName: JING_CONTRACTS.BID.name,
      functionName: "cancel",
      functionArgs: [
        uintCV(swapId),
        contractPrincipalCV(tokenInfo.contractAddress, tokenInfo.contractName),
        contractPrincipalCV(
          JING_CONTRACTS.YIN.address,
          JING_CONTRACTS.YIN.name
        ),
      ],
      senderKey: key,
      validateWithAbi: true,
      network: networkObj,
      anchorMode: AnchorMode.Any,
      postConditionMode: PostConditionMode.Deny,
      postConditions,
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
          swapId,
          tokenDecimals,
          tokenSymbol: tokenInfo.assetName,
          address,
          bidDetails,
          fees: fees / 1_000_000,
          gasFee: gasFee / 1_000_000,
        },
      };
    } catch (error) {
      throw new Error(
        `Failed to cancel bid: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  async cancelAsk({
    swapId,
    gasFee,
    accountIndex = 0,
    mnemonic,
  }: {
    swapId: number;
    gasFee: number;
    accountIndex?: number;
    mnemonic: string;
  }) {
    const networkObj = getNetwork(this.network);
    const { address, key } = await deriveChildAccount(
      this.network,
      mnemonic,
      accountIndex
    );
    const nonce = await getNextNonce(this.network, address);

    // Get ask details
    const askDetails = await this.getAskDetails(swapId);
    if (askDetails.ftSender !== address) {
      throw new Error(
        `Only the ask creator (${askDetails.ftSender}) can cancel this ask`
      );
    }

    // Get token info from the ask details
    const result = await callReadOnlyFunction({
      contractAddress: JING_CONTRACTS.ASK.address,
      contractName: JING_CONTRACTS.ASK.name,
      functionName: "get-swap",
      functionArgs: [uintCV(swapId)],
      network: networkObj,
      senderAddress: this.defaultAddress,
    });

    const jsonResult = cvToJSON(result);
    if (!jsonResult.success) throw new Error("Failed to get ask details");

    const ftContract = jsonResult.value.value.ft.value;
    const tokenInfo = getTokenInfoFromContract(ftContract);

    const tokenDecimals = await getTokenDecimals(
      tokenInfo,
      this.network,
      this.defaultAddress
    );
    const fees = calculateAskFees(askDetails.amount);

    const postConditions = [
      makeContractFungiblePostCondition(
        JING_CONTRACTS.ASK.address,
        JING_CONTRACTS.YANG.name,
        FungibleConditionCode.LessEqual,
        fees,
        createAssetInfo(
          tokenInfo.contractAddress,
          tokenInfo.contractName,
          tokenInfo.assetName // there's an issue here we need to map to assetName not tokenSymbol
        )
      ),
      makeContractFungiblePostCondition(
        JING_CONTRACTS.ASK.address,
        JING_CONTRACTS.ASK.name,
        FungibleConditionCode.Equal,
        askDetails.amount,
        createAssetInfo(
          tokenInfo.contractAddress,
          tokenInfo.contractName,
          tokenInfo.assetName
        )
      ),
    ];

    const txOptions = {
      contractAddress: JING_CONTRACTS.ASK.address,
      contractName: JING_CONTRACTS.ASK.name,
      functionName: "cancel",
      functionArgs: [
        uintCV(swapId),
        contractPrincipalCV(tokenInfo.contractAddress, tokenInfo.contractName),
        contractPrincipalCV(
          JING_CONTRACTS.YANG.address,
          JING_CONTRACTS.YANG.name
        ),
      ],
      senderKey: key,
      validateWithAbi: true,
      network: networkObj,
      anchorMode: AnchorMode.Any,
      postConditionMode: PostConditionMode.Deny,
      postConditions,
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
          swapId,
          tokenDecimals,
          tokenSymbol: tokenInfo.assetName,
          address,
          askDetails,
          fees: fees / Math.pow(10, tokenDecimals),
          gasFee: gasFee / 1_000_000,
        },
      };
    } catch (error) {
      throw new Error(
        `Failed to cancel ask: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  // Add these methods to JingCashSDK class

  async submitBid({
    swapId,
    gasFee,
    accountIndex = 0,
    mnemonic,
  }: {
    swapId: number;
    gasFee: number;
    accountIndex?: number;
    mnemonic: string;
  }) {
    const networkObj = getNetwork(this.network);
    const { address, key } = await deriveChildAccount(
      this.network,
      mnemonic,
      accountIndex
    );
    const nonce = await getNextNonce(this.network, address);

    // Get bid details
    const bidDetails = await this.getBidDetails(swapId);

    // Get token info from the bid details
    const result = await callReadOnlyFunction({
      contractAddress: JING_CONTRACTS.BID.address,
      contractName: JING_CONTRACTS.BID.name,
      functionName: "get-swap",
      functionArgs: [uintCV(swapId)],
      network: networkObj,
      senderAddress: this.defaultAddress,
    });

    const jsonResult = cvToJSON(result);
    if (!jsonResult.success) throw new Error("Failed to get bid details");

    const ftContract = jsonResult.value.value.ft.value;
    const tokenInfo = getTokenInfoFromContract(ftContract);

    const tokenDecimals = await getTokenDecimals(
      tokenInfo,
      this.network,
      this.defaultAddress
    );
    const fees = calculateBidFees(bidDetails.ustx);

    const postConditions = [
      // You send the FT
      makeStandardFungiblePostCondition(
        address,
        FungibleConditionCode.Equal,
        bidDetails.amount,
        createAssetInfo(
          tokenInfo.contractAddress,
          tokenInfo.contractName,
          tokenInfo.assetName
        )
      ),
      // Contract sends STX
      makeContractSTXPostCondition(
        JING_CONTRACTS.BID.address,
        JING_CONTRACTS.BID.name,
        FungibleConditionCode.Equal,
        bidDetails.ustx
      ),
      // Fees from YIN contract
      makeContractSTXPostCondition(
        JING_CONTRACTS.BID.address,
        JING_CONTRACTS.YIN.name,
        FungibleConditionCode.LessEqual,
        fees
      ),
    ];

    const txOptions = {
      contractAddress: JING_CONTRACTS.BID.address,
      contractName: JING_CONTRACTS.BID.name,
      functionName: "submit-swap",
      functionArgs: [
        uintCV(swapId),
        contractPrincipalCV(tokenInfo.contractAddress, tokenInfo.contractName),
        contractPrincipalCV(
          JING_CONTRACTS.YIN.address,
          JING_CONTRACTS.YIN.name
        ),
      ],
      senderKey: key,
      validateWithAbi: true,
      network: networkObj,
      anchorMode: AnchorMode.Any,
      postConditionMode: PostConditionMode.Deny,
      postConditions,
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
          swapId,
          tokenDecimals,
          tokenSymbol: tokenInfo.symbol,
          address,
          bidDetails,
          fees: fees / 1_000_000,
          gasFee: gasFee / 1_000_000,
        },
      };
    } catch (error) {
      throw new Error(
        `Failed to submit bid swap: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  async submitAsk({
    swapId,
    gasFee,
    accountIndex = 0,
    mnemonic,
  }: {
    swapId: number;
    gasFee: number;
    accountIndex?: number;
    mnemonic: string;
  }) {
    const networkObj = getNetwork(this.network);
    const { address, key } = await deriveChildAccount(
      this.network,
      mnemonic,
      accountIndex
    );
    const nonce = await getNextNonce(this.network, address);

    // Get ask details
    const askDetails = await this.getAskDetails(swapId);

    // Get token info from the ask details
    const result = await callReadOnlyFunction({
      contractAddress: JING_CONTRACTS.ASK.address,
      contractName: JING_CONTRACTS.ASK.name,
      functionName: "get-swap",
      functionArgs: [uintCV(swapId)],
      network: networkObj,
      senderAddress: this.defaultAddress,
    });

    const jsonResult = cvToJSON(result);
    if (!jsonResult.success) throw new Error("Failed to get ask details");

    const ftContract = jsonResult.value.value.ft.value;
    const tokenInfo = getTokenInfoFromContract(ftContract);

    const tokenDecimals = await getTokenDecimals(
      tokenInfo,
      this.network,
      this.defaultAddress
    );
    const fees = calculateAskFees(askDetails.amount);

    const postConditions = [
      // You send STX
      makeStandardSTXPostCondition(
        address,
        FungibleConditionCode.Equal,
        askDetails.ustx
      ),
      // Contract sends FT
      makeContractFungiblePostCondition(
        JING_CONTRACTS.ASK.address,
        JING_CONTRACTS.ASK.name,
        FungibleConditionCode.Equal,
        askDetails.amount,
        createAssetInfo(
          tokenInfo.contractAddress,
          tokenInfo.contractName,
          tokenInfo.assetName
        )
      ),
      // Fees from YANG contract
      makeContractFungiblePostCondition(
        JING_CONTRACTS.ASK.address,
        JING_CONTRACTS.YANG.name,
        FungibleConditionCode.LessEqual,
        fees,
        createAssetInfo(
          tokenInfo.contractAddress,
          tokenInfo.contractName,
          tokenInfo.assetName
        )
      ),
    ];

    const txOptions = {
      contractAddress: JING_CONTRACTS.ASK.address,
      contractName: JING_CONTRACTS.ASK.name,
      functionName: "submit-swap",
      functionArgs: [
        uintCV(swapId),
        contractPrincipalCV(tokenInfo.contractAddress, tokenInfo.contractName),
        contractPrincipalCV(
          JING_CONTRACTS.YANG.address,
          JING_CONTRACTS.YANG.name
        ),
      ],
      senderKey: key,
      validateWithAbi: true,
      network: networkObj,
      anchorMode: AnchorMode.Any,
      postConditionMode: PostConditionMode.Deny,
      postConditions,
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
          swapId,
          tokenDecimals,
          tokenSymbol: tokenInfo.symbol,
          address,
          askDetails,
          fees: fees / Math.pow(10, tokenDecimals),
          gasFee: gasFee / 1_000_000,
        },
      };
    } catch (error) {
      throw new Error(
        `Failed to submit ask swap: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  // Add these methods to JingCashSDK class

  async repriceBid({
    swapId,
    newTokenAmount,
    pair,
    recipient,
    expiry,
    accountIndex = 0,
    mnemonic,
    gasFee = 10000,
  }: {
    swapId: number;
    newTokenAmount: number;
    pair: string;
    recipient?: string;
    expiry?: number;
    accountIndex?: number;
    mnemonic: string;
    gasFee?: number;
  }) {
    const tokenInfo = getTokenInfo(pair);
    if (!tokenInfo) {
      throw new Error(`Failed to get token info for pair: ${pair}`);
    }

    const tokenDecimals = await getTokenDecimals(
      tokenInfo,
      this.network,
      this.defaultAddress
    );
    const microTokenAmount = Math.floor(
      newTokenAmount * Math.pow(10, tokenDecimals)
    );

    const networkObj = getNetwork(this.network);
    const { address, key } = await deriveChildAccount(
      this.network,
      mnemonic,
      accountIndex
    );
    const nonce = await getNextNonce(this.network, address);

    // Get current bid details and verify ownership
    const bidDetails = await this.getBidDetails(swapId);
    if (bidDetails.stxSender !== address) {
      throw new Error(
        `Only the bid creator (${bidDetails.stxSender}) can reprice this bid`
      );
    }

    const txOptions = {
      contractAddress: JING_CONTRACTS.BID.address,
      contractName: JING_CONTRACTS.BID.name,
      functionName: "re-price",
      functionArgs: [
        uintCV(swapId),
        contractPrincipalCV(tokenInfo.contractAddress, tokenInfo.contractName),
        contractPrincipalCV(
          JING_CONTRACTS.YIN.address,
          JING_CONTRACTS.YIN.name
        ),
        uintCV(microTokenAmount),
        expiry ? someCV(uintCV(expiry)) : noneCV(),
        recipient ? someCV(standardPrincipalCV(recipient)) : noneCV(),
      ],
      senderKey: key,
      validateWithAbi: true,
      network: networkObj,
      anchorMode: AnchorMode.Any,
      postConditionMode: PostConditionMode.Allow,
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
          swapId,
          tokenDecimals,
          tokenSymbol: tokenInfo.symbol,
          address,
          bidDetails,
          newAmount: microTokenAmount,
          recipient,
          expiry,
          gasFee: gasFee / 1_000_000,
        },
      };
    } catch (error) {
      throw new Error(
        `Failed to reprice bid: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  async repriceAsk({
    swapId,
    newStxAmount,
    pair,
    recipient,
    expiry,
    accountIndex = 0,
    mnemonic,
    gasFee = 10000,
  }: {
    swapId: number;
    newStxAmount: number;
    pair: string;
    recipient?: string;
    expiry?: number;
    accountIndex?: number;
    mnemonic: string;
    gasFee?: number;
  }) {
    const tokenInfo = getTokenInfo(pair);
    if (!tokenInfo) {
      throw new Error(`Failed to get token info for pair: ${pair}`);
    }

    const newUstx = Math.floor(newStxAmount * 1_000_000);
    const networkObj = getNetwork(this.network);
    const { address, key } = await deriveChildAccount(
      this.network,
      mnemonic,
      accountIndex
    );
    const nonce = await getNextNonce(this.network, address);

    // Get current ask details and verify ownership
    const askDetails = await this.getAskDetails(swapId);
    if (askDetails.ftSender !== address) {
      throw new Error(
        `Only the ask creator (${askDetails.ftSender}) can reprice this ask`
      );
    }

    const txOptions = {
      contractAddress: JING_CONTRACTS.ASK.address,
      contractName: JING_CONTRACTS.ASK.name,
      functionName: "re-price",
      functionArgs: [
        uintCV(swapId),
        contractPrincipalCV(tokenInfo.contractAddress, tokenInfo.contractName),
        contractPrincipalCV(
          JING_CONTRACTS.YANG.address,
          JING_CONTRACTS.YANG.name
        ),
        uintCV(newUstx),
        expiry ? someCV(uintCV(expiry)) : noneCV(),
        recipient ? someCV(standardPrincipalCV(recipient)) : noneCV(),
      ],
      senderKey: key,
      validateWithAbi: true,
      network: networkObj,
      anchorMode: AnchorMode.Any,
      postConditionMode: PostConditionMode.Allow,
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
          swapId,
          tokenDecimals: await getTokenDecimals(
            tokenInfo,
            this.network,
            this.defaultAddress
          ),
          tokenSymbol: tokenInfo.symbol,
          address,
          askDetails,
          newUstx,
          recipient,
          expiry,
          gasFee: gasFee / 1_000_000,
        },
      };
    } catch (error) {
      throw new Error(
        `Failed to reprice ask: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  private async formatSwapResponse(
    rawResponse: any
  ): Promise<SwapDetails | null> {
    if (!rawResponse.success) return null;

    const value = rawResponse.value.value;
    const ftContract = value.ft.value;

    // Retrieve token info and decimals directly within SDK
    const tokenInfo = getTokenInfoFromContract(ftContract);
    const tokenSymbol = tokenInfo.symbol;
    const tokenDecimals = await getTokenDecimals(
      tokenInfo,
      this.network,
      this.defaultAddress
    );

    return {
      ustx: parseInt(value.ustx.value),
      stxSender: value["stx-sender"].value,
      amount: parseInt(value.amount.value),
      ftSender: value["ft-sender"].value,
      open: value.open.value,
      ft: ftContract,
      fees: value.fees.value,
      expiredHeight: value["expired-height"].value,
      tokenSymbol,
      tokenDecimals,
    };
  }

  async getBid(
    swapId: number
  ): Promise<
    (SwapDetails & { contract: { address: string; name: string } }) | null
  > {
    const network = getNetwork(this.network);
    const senderAddress = this.defaultAddress;

    try {
      const result = await callReadOnlyFunction({
        contractAddress: JING_CONTRACTS.BID.address,
        contractName: JING_CONTRACTS.BID.name,
        functionName: "get-swap",
        functionArgs: [uintCV(swapId)],
        network,
        senderAddress,
      });

      const jsonResult = cvToJSON(result);
      const formattedSwap = await this.formatSwapResponse(jsonResult);

      if (formattedSwap) {
        return {
          ...formattedSwap,
          contract: {
            address: JING_CONTRACTS.BID.address,
            name: JING_CONTRACTS.BID.name,
          },
        };
      } else {
        console.error("Failed to parse swap details");
        return null;
      }
    } catch (error) {
      console.error(
        `Error fetching swap: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
      throw error;
    }
  }

  async getAsk(
    swapId: number
  ): Promise<
    (SwapDetails & { contract: { address: string; name: string } }) | null
  > {
    const network = getNetwork(this.network);
    const senderAddress = this.defaultAddress;

    try {
      const result = await callReadOnlyFunction({
        contractAddress: JING_CONTRACTS.ASK.address,
        contractName: JING_CONTRACTS.ASK.name,
        functionName: "get-swap",
        functionArgs: [uintCV(swapId)],
        network,
        senderAddress,
      });

      const jsonResult = cvToJSON(result);
      const formattedSwap = await this.formatSwapResponse(jsonResult);

      if (formattedSwap) {
        return {
          ...formattedSwap,
          contract: {
            address: JING_CONTRACTS.ASK.address,
            name: JING_CONTRACTS.ASK.name,
          },
        };
      } else {
        console.error("Failed to parse swap details");
        return null;
      }
    } catch (error) {
      console.error(
        `Error fetching swap: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
      throw error;
    }
  }

  async getAvailableMarkets(): Promise<Market[]> {
    const marketPromises = Object.entries(TokenMap).map(
      async ([symbol, contract]): Promise<Market> => {
        return {
          pair: `${symbol}-STX`,
          baseToken: {
            symbol,
            contract,
          },
          quoteToken: {
            symbol: "STX",
            contract: "STX",
          },
          status: "active",
        };
      }
    );

    const markets = await Promise.all(marketPromises);
    return markets.sort((a, b) => a.pair.localeCompare(b.pair));
  }

  async getMarket(pair: string): Promise<Market | null> {
    const markets = await this.getAvailableMarkets();
    return markets.find((market) => market.pair === pair) || null;
  }

  async isValidPair(pair: string): Promise<boolean> {
    const markets = await this.getAvailableMarkets();
    return markets.some((market) => market.pair === pair);
  }
}
