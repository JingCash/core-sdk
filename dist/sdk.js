"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JingCashSDK = void 0;
const transactions_1 = require("@stacks/transactions");
const token_utils_1 = require("./token-utils");
const constants_1 = require("./constants");
const network_1 = require("./network");
const account_1 = require("./account");
class JingCashSDK {
    constructor(config) {
        this.API_HOST = config.API_HOST;
        this.API_KEY = config.API_KEY;
        this.defaultAddress = config.defaultAddress;
        this.network = (0, network_1.validateNetwork)(config.network);
    }
    async fetch(endpoint) {
        const response = await fetch(`${this.API_HOST}${endpoint}`, {
            headers: {
                Authorization: `Bearer ${this.API_KEY}`,
                "X-API-Key": this.API_KEY,
            },
        });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
    }
    isStxAsk(order) {
        return order.out_contract === "STX";
    }
    formatDisplayOrder(order) {
        if (this.isStxAsk(order)) {
            const tokenAmount = (0, token_utils_1.fromMicroUnits)(order.amount, order.in_decimals);
            const stxAmount = (0, token_utils_1.fromMicroUnits)(order.ustx, constants_1.STX_DECIMALS);
            const tokenSymbol = (0, token_utils_1.getTokenSymbol)(order.in_contract);
            const displayOrder = {
                ...order,
                type: "Ask",
                market: `${tokenSymbol}/STX`,
                displayAmount: `${tokenAmount.toString()} ${tokenSymbol}`,
                displayStxAmount: `${stxAmount.toString()} STX`,
                displayPrice: `${(stxAmount / tokenAmount).toString()} STX/${tokenSymbol}`,
            };
            return displayOrder;
        }
        else {
            const tokenAmount = (0, token_utils_1.fromMicroUnits)(order.amount, order.out_decimals);
            const stxAmount = (0, token_utils_1.fromMicroUnits)(order.ustx, constants_1.STX_DECIMALS);
            const tokenSymbol = (0, token_utils_1.getTokenSymbol)(order.out_contract);
            const displayBid = {
                ...order,
                type: "Bid",
                market: `${tokenSymbol}/STX`,
                displayAmount: `${tokenAmount.toString()} ${tokenSymbol}`,
                displayStxAmount: `${stxAmount.toString()} STX`,
                displayPrice: `${(stxAmount / tokenAmount).toString()} STX/${tokenSymbol}`,
            };
            return displayBid;
        }
    }
    async getPendingOrders(page = 1, limit = 50) {
        try {
            const response = await this.fetch(`/all-pending-stx-swaps?page=${page}&limit=${limit}`);
            const formattedResults = response.results
                .filter((order) => order.status === "open" || order.status === "private")
                .map((order) => this.formatDisplayOrder(order))
                .sort((a, b) => {
                const dateA = a.processedAt ? a.processedAt : 0;
                const dateB = b.processedAt ? b.processedAt : 0;
                return dateB - dateA;
            });
            return { results: formattedResults };
        }
        catch (error) {
            throw new Error(`Failed to fetch pending orders: ${error instanceof Error ? error.message : "Unknown error"}`);
        }
    }
    async getOrderBook(pair) {
        if (!(0, token_utils_1.getSupportedPairs)().includes(pair)) {
            throw new Error(`Unsupported trading pair: ${pair}`);
        }
        // Get token info and extract just the contract part
        const tokenInfo = (0, token_utils_1.getTokenInfo)(pair);
        if (!tokenInfo) {
            throw new Error(`Failed to get token info for pair: ${pair}`);
        }
        // Extract the contract part before the ::
        const ftContract = `${tokenInfo.contractAddress}.${tokenInfo.contractName}`;
        const [bidsResponse, asksResponse] = await Promise.all([
            this.fetch(`/token-pairs/${pair}/stx-bids?ftContract=${ftContract}`),
            this.fetch(`/token-pairs/${pair}/stx-asks?ftContract=${ftContract}`),
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
    async getPrivateOffers(pair, userAddress) {
        const tokenInfo = (0, token_utils_1.getTokenInfo)(pair);
        if (!tokenInfo) {
            throw new Error(`Unsupported trading pair: ${pair}`);
        }
        const ftContract = `${tokenInfo.contractAddress}.${tokenInfo.contractName}`;
        return this.fetch(`/token-pairs/${pair}/private-offers?userAddress=${userAddress}&ftContract=${ftContract}`);
    }
    async getUserOffers(pair, userAddress) {
        const tokenInfo = (0, token_utils_1.getTokenInfo)(pair);
        if (!tokenInfo) {
            throw new Error(`Unsupported trading pair: ${pair}`);
        }
        const ftContract = `${tokenInfo.contractAddress}.${tokenInfo.contractName}`;
        return this.fetch(`/token-pairs/${pair}/user-offers?userAddress=${userAddress}&ftContract=${ftContract}`);
    }
    async createBidOffer({ pair, stxAmount, tokenAmount, gasFee, recipient, expiry, accountIndex = 0, mnemonic, }) {
        if (!(0, token_utils_1.getSupportedPairs)().includes(pair)) {
            throw new Error(`Unsupported trading pair: ${pair}`);
        }
        const tokenInfo = (0, token_utils_1.getTokenInfo)(pair);
        if (!tokenInfo) {
            throw new Error(`Failed to get token info for pair: ${pair}`);
        }
        const tokenDecimals = await (0, token_utils_1.getTokenDecimals)(tokenInfo, this.network, this.defaultAddress);
        const ustx = Math.floor(stxAmount * 1000000);
        const microTokenAmount = Math.floor(tokenAmount * Math.pow(10, tokenDecimals));
        const networkObj = (0, network_1.getNetwork)(this.network);
        const { address, key } = await (0, account_1.deriveChildAccount)(this.network, mnemonic, accountIndex);
        const nonce = await (0, network_1.getNextNonce)(this.network, address);
        const fees = (0, token_utils_1.calculateBidFees)(ustx);
        const txOptions = {
            contractAddress: constants_1.JING_CONTRACTS.BID.address,
            contractName: constants_1.JING_CONTRACTS.BID.name,
            functionName: "offer",
            functionArgs: [
                (0, transactions_1.uintCV)(ustx),
                (0, transactions_1.uintCV)(microTokenAmount),
                recipient ? (0, transactions_1.someCV)((0, transactions_1.standardPrincipalCV)(recipient)) : (0, transactions_1.noneCV)(),
                (0, transactions_1.contractPrincipalCV)(tokenInfo.contractAddress, tokenInfo.contractName),
                (0, transactions_1.contractPrincipalCV)(constants_1.JING_CONTRACTS.YIN.address, constants_1.JING_CONTRACTS.YIN.name),
                expiry ? (0, transactions_1.someCV)((0, transactions_1.uintCV)(expiry)) : (0, transactions_1.noneCV)(),
            ],
            senderKey: key,
            validateWithAbi: true,
            network: networkObj,
            anchorMode: transactions_1.AnchorMode.Any,
            postConditionMode: transactions_1.PostConditionMode.Deny,
            postConditions: [
                (0, transactions_1.makeStandardSTXPostCondition)(address, transactions_1.FungibleConditionCode.LessEqual, ustx + fees),
            ],
            nonce,
            fee: gasFee,
        };
        try {
            const transaction = await (0, transactions_1.makeContractCall)(txOptions);
            const broadcastResponse = await (0, transactions_1.broadcastTransaction)(transaction, networkObj);
            return {
                txid: broadcastResponse.txid,
                details: {
                    pair,
                    stxAmount,
                    tokenAmount,
                    fees: fees / 1000000,
                    gasFee: gasFee / 1000000,
                    recipient,
                    expiry,
                    address,
                },
            };
        }
        catch (error) {
            throw new Error(`Failed to create bid offer: ${error instanceof Error ? error.message : "Unknown error"}`);
        }
    }
    // In sdk.ts, add this method to JingCashSDK class
    async createAskOffer({ pair, tokenAmount, stxAmount, gasFee, recipient, expiry, accountIndex = 0, mnemonic, }) {
        if (!(0, token_utils_1.getSupportedPairs)().includes(pair)) {
            throw new Error(`Unsupported trading pair: ${pair}`);
        }
        const tokenInfo = (0, token_utils_1.getTokenInfo)(pair);
        if (!tokenInfo) {
            throw new Error(`Failed to get token info for pair: ${pair}`);
        }
        const tokenDecimals = await (0, token_utils_1.getTokenDecimals)(tokenInfo, this.network, this.defaultAddress);
        // Convert to micro units
        const microTokenAmount = Math.floor(tokenAmount * Math.pow(10, tokenDecimals));
        const ustx = Math.floor(stxAmount * 1000000);
        const networkObj = (0, network_1.getNetwork)(this.network);
        const { address, key } = await (0, account_1.deriveChildAccount)(this.network, mnemonic, accountIndex);
        const nonce = await (0, network_1.getNextNonce)(this.network, address);
        // Calculate fees (in FT)
        const microFees = (0, token_utils_1.calculateAskFees)(microTokenAmount);
        const txOptions = {
            contractAddress: constants_1.JING_CONTRACTS.ASK.address,
            contractName: constants_1.JING_CONTRACTS.ASK.name,
            functionName: "offer",
            functionArgs: [
                (0, transactions_1.uintCV)(microTokenAmount),
                (0, transactions_1.uintCV)(ustx),
                recipient ? (0, transactions_1.someCV)((0, transactions_1.standardPrincipalCV)(recipient)) : (0, transactions_1.noneCV)(),
                (0, transactions_1.contractPrincipalCV)(tokenInfo.contractAddress, tokenInfo.contractName),
                (0, transactions_1.contractPrincipalCV)(constants_1.JING_CONTRACTS.YANG.address, constants_1.JING_CONTRACTS.YANG.name),
                expiry ? (0, transactions_1.someCV)((0, transactions_1.uintCV)(expiry)) : (0, transactions_1.noneCV)(),
            ],
            senderKey: key,
            validateWithAbi: true,
            network: networkObj,
            anchorMode: transactions_1.AnchorMode.Any,
            postConditionMode: transactions_1.PostConditionMode.Deny,
            postConditions: [
                (0, transactions_1.makeStandardFungiblePostCondition)(address, transactions_1.FungibleConditionCode.LessEqual, microTokenAmount + microFees, (0, transactions_1.createAssetInfo)(tokenInfo.contractAddress, tokenInfo.contractName, tokenInfo.assetName)),
            ],
            nonce,
            fee: gasFee,
        };
        try {
            const transaction = await (0, transactions_1.makeContractCall)(txOptions);
            const broadcastResponse = await (0, transactions_1.broadcastTransaction)(transaction, networkObj);
            return {
                txid: broadcastResponse.txid,
                details: {
                    pair,
                    tokenAmount,
                    stxAmount,
                    fees: microFees / Math.pow(10, tokenDecimals),
                    gasFee: gasFee / 1000000,
                    recipient,
                    expiry,
                    address,
                    microTokenAmount,
                    ustx,
                    tokenDecimals,
                },
            };
        }
        catch (error) {
            throw new Error(`Failed to create ask offer: ${error instanceof Error ? error.message : "Unknown error"}`);
        }
    }
    // In JingCashSDK class
    async getBidDetails(swapId) {
        const networkObj = (0, network_1.getNetwork)(this.network);
        const result = await (0, transactions_1.callReadOnlyFunction)({
            contractAddress: constants_1.JING_CONTRACTS.BID.address,
            contractName: constants_1.JING_CONTRACTS.BID.name,
            functionName: "get-swap",
            functionArgs: [(0, transactions_1.uintCV)(swapId)],
            network: networkObj,
            senderAddress: this.defaultAddress,
        });
        const jsonResult = (0, transactions_1.cvToJSON)(result);
        if (!jsonResult.success)
            throw new Error("Failed to get bid details");
        return {
            ustx: parseInt(jsonResult.value.value.ustx.value),
            amount: parseInt(jsonResult.value.value.amount.value),
            stxSender: jsonResult.value.value["stx-sender"].value,
        };
    }
    async getAskDetails(swapId) {
        const networkObj = (0, network_1.getNetwork)(this.network);
        const result = await (0, transactions_1.callReadOnlyFunction)({
            contractAddress: constants_1.JING_CONTRACTS.ASK.address,
            contractName: constants_1.JING_CONTRACTS.ASK.name,
            functionName: "get-swap",
            functionArgs: [(0, transactions_1.uintCV)(swapId)],
            network: networkObj,
            senderAddress: this.defaultAddress,
        });
        const jsonResult = (0, transactions_1.cvToJSON)(result);
        if (!jsonResult.success)
            throw new Error("Failed to get ask details");
        return {
            ustx: parseInt(jsonResult.value.value.ustx.value),
            amount: parseInt(jsonResult.value.value.amount.value),
            ftSender: jsonResult.value.value["ft-sender"].value,
        };
    }
    async cancelBid({ swapId, gasFee, accountIndex = 0, mnemonic, }) {
        const networkObj = (0, network_1.getNetwork)(this.network);
        const { address, key } = await (0, account_1.deriveChildAccount)(this.network, mnemonic, accountIndex);
        const nonce = await (0, network_1.getNextNonce)(this.network, address);
        // Get bid details
        const bidDetails = await this.getBidDetails(swapId);
        if (bidDetails.stxSender !== address) {
            throw new Error(`Only the bid creator (${bidDetails.stxSender}) can cancel this bid`);
        }
        // Get token info from the bid details
        const result = await (0, transactions_1.callReadOnlyFunction)({
            contractAddress: constants_1.JING_CONTRACTS.BID.address,
            contractName: constants_1.JING_CONTRACTS.BID.name,
            functionName: "get-swap",
            functionArgs: [(0, transactions_1.uintCV)(swapId)],
            network: networkObj,
            senderAddress: this.defaultAddress,
        });
        const jsonResult = (0, transactions_1.cvToJSON)(result);
        if (!jsonResult.success)
            throw new Error("Failed to get bid details");
        const ftContract = jsonResult.value.value.ft.value;
        const tokenInfo = (0, token_utils_1.getTokenInfoFromContract)(ftContract);
        const tokenDecimals = await (0, token_utils_1.getTokenDecimals)(tokenInfo, this.network, this.defaultAddress);
        const fees = (0, token_utils_1.calculateBidFees)(bidDetails.ustx);
        const postConditions = [
            (0, transactions_1.makeContractSTXPostCondition)(constants_1.JING_CONTRACTS.BID.address, constants_1.JING_CONTRACTS.BID.name, transactions_1.FungibleConditionCode.Equal, bidDetails.ustx),
            (0, transactions_1.makeContractSTXPostCondition)(constants_1.JING_CONTRACTS.BID.address, constants_1.JING_CONTRACTS.YIN.name, transactions_1.FungibleConditionCode.LessEqual, fees),
        ];
        const txOptions = {
            contractAddress: constants_1.JING_CONTRACTS.BID.address,
            contractName: constants_1.JING_CONTRACTS.BID.name,
            functionName: "cancel",
            functionArgs: [
                (0, transactions_1.uintCV)(swapId),
                (0, transactions_1.contractPrincipalCV)(tokenInfo.contractAddress, tokenInfo.contractName),
                (0, transactions_1.contractPrincipalCV)(constants_1.JING_CONTRACTS.YIN.address, constants_1.JING_CONTRACTS.YIN.name),
            ],
            senderKey: key,
            validateWithAbi: true,
            network: networkObj,
            anchorMode: transactions_1.AnchorMode.Any,
            postConditionMode: transactions_1.PostConditionMode.Deny,
            postConditions,
            nonce,
            fee: gasFee,
        };
        try {
            const transaction = await (0, transactions_1.makeContractCall)(txOptions);
            const broadcastResponse = await (0, transactions_1.broadcastTransaction)(transaction, networkObj);
            return {
                txid: broadcastResponse.txid,
                details: {
                    swapId,
                    tokenDecimals,
                    tokenSymbol: tokenInfo.assetName,
                    address,
                    bidDetails,
                    fees: fees / 1000000,
                    gasFee: gasFee / 1000000,
                },
            };
        }
        catch (error) {
            throw new Error(`Failed to cancel bid: ${error instanceof Error ? error.message : "Unknown error"}`);
        }
    }
    async cancelAsk({ swapId, gasFee, accountIndex = 0, mnemonic, }) {
        const networkObj = (0, network_1.getNetwork)(this.network);
        const { address, key } = await (0, account_1.deriveChildAccount)(this.network, mnemonic, accountIndex);
        const nonce = await (0, network_1.getNextNonce)(this.network, address);
        // Get ask details
        const askDetails = await this.getAskDetails(swapId);
        if (askDetails.ftSender !== address) {
            throw new Error(`Only the ask creator (${askDetails.ftSender}) can cancel this ask`);
        }
        // Get token info from the ask details
        const result = await (0, transactions_1.callReadOnlyFunction)({
            contractAddress: constants_1.JING_CONTRACTS.ASK.address,
            contractName: constants_1.JING_CONTRACTS.ASK.name,
            functionName: "get-swap",
            functionArgs: [(0, transactions_1.uintCV)(swapId)],
            network: networkObj,
            senderAddress: this.defaultAddress,
        });
        const jsonResult = (0, transactions_1.cvToJSON)(result);
        if (!jsonResult.success)
            throw new Error("Failed to get ask details");
        const ftContract = jsonResult.value.value.ft.value;
        const tokenInfo = (0, token_utils_1.getTokenInfoFromContract)(ftContract);
        const tokenDecimals = await (0, token_utils_1.getTokenDecimals)(tokenInfo, this.network, this.defaultAddress);
        const fees = (0, token_utils_1.calculateAskFees)(askDetails.amount);
        const postConditions = [
            (0, transactions_1.makeContractFungiblePostCondition)(constants_1.JING_CONTRACTS.ASK.address, constants_1.JING_CONTRACTS.YANG.name, transactions_1.FungibleConditionCode.LessEqual, fees, (0, transactions_1.createAssetInfo)(tokenInfo.contractAddress, tokenInfo.contractName, tokenInfo.assetName // there's an issue here we need to map to assetName not tokenSymbol
            )),
            (0, transactions_1.makeContractFungiblePostCondition)(constants_1.JING_CONTRACTS.ASK.address, constants_1.JING_CONTRACTS.ASK.name, transactions_1.FungibleConditionCode.Equal, askDetails.amount, (0, transactions_1.createAssetInfo)(tokenInfo.contractAddress, tokenInfo.contractName, tokenInfo.assetName)),
        ];
        const txOptions = {
            contractAddress: constants_1.JING_CONTRACTS.ASK.address,
            contractName: constants_1.JING_CONTRACTS.ASK.name,
            functionName: "cancel",
            functionArgs: [
                (0, transactions_1.uintCV)(swapId),
                (0, transactions_1.contractPrincipalCV)(tokenInfo.contractAddress, tokenInfo.contractName),
                (0, transactions_1.contractPrincipalCV)(constants_1.JING_CONTRACTS.YANG.address, constants_1.JING_CONTRACTS.YANG.name),
            ],
            senderKey: key,
            validateWithAbi: true,
            network: networkObj,
            anchorMode: transactions_1.AnchorMode.Any,
            postConditionMode: transactions_1.PostConditionMode.Deny,
            postConditions,
            nonce,
            fee: gasFee,
        };
        try {
            const transaction = await (0, transactions_1.makeContractCall)(txOptions);
            const broadcastResponse = await (0, transactions_1.broadcastTransaction)(transaction, networkObj);
            return {
                txid: broadcastResponse.txid,
                details: {
                    swapId,
                    tokenDecimals,
                    tokenSymbol: tokenInfo.assetName,
                    address,
                    askDetails,
                    fees: fees / Math.pow(10, tokenDecimals),
                    gasFee: gasFee / 1000000,
                },
            };
        }
        catch (error) {
            throw new Error(`Failed to cancel ask: ${error instanceof Error ? error.message : "Unknown error"}`);
        }
    }
    // Add these methods to JingCashSDK class
    async submitBid({ swapId, gasFee, accountIndex = 0, mnemonic, }) {
        const networkObj = (0, network_1.getNetwork)(this.network);
        const { address, key } = await (0, account_1.deriveChildAccount)(this.network, mnemonic, accountIndex);
        const nonce = await (0, network_1.getNextNonce)(this.network, address);
        // Get bid details
        const bidDetails = await this.getBidDetails(swapId);
        // Get token info from the bid details
        const result = await (0, transactions_1.callReadOnlyFunction)({
            contractAddress: constants_1.JING_CONTRACTS.BID.address,
            contractName: constants_1.JING_CONTRACTS.BID.name,
            functionName: "get-swap",
            functionArgs: [(0, transactions_1.uintCV)(swapId)],
            network: networkObj,
            senderAddress: this.defaultAddress,
        });
        const jsonResult = (0, transactions_1.cvToJSON)(result);
        if (!jsonResult.success)
            throw new Error("Failed to get bid details");
        const ftContract = jsonResult.value.value.ft.value;
        const tokenInfo = (0, token_utils_1.getTokenInfoFromContract)(ftContract);
        const tokenDecimals = await (0, token_utils_1.getTokenDecimals)(tokenInfo, this.network, this.defaultAddress);
        const fees = (0, token_utils_1.calculateBidFees)(bidDetails.ustx);
        const postConditions = [
            // You send the FT
            (0, transactions_1.makeStandardFungiblePostCondition)(address, transactions_1.FungibleConditionCode.Equal, bidDetails.amount, (0, transactions_1.createAssetInfo)(tokenInfo.contractAddress, tokenInfo.contractName, tokenInfo.assetName)),
            // Contract sends STX
            (0, transactions_1.makeContractSTXPostCondition)(constants_1.JING_CONTRACTS.BID.address, constants_1.JING_CONTRACTS.BID.name, transactions_1.FungibleConditionCode.Equal, bidDetails.ustx),
            // Fees from YIN contract
            (0, transactions_1.makeContractSTXPostCondition)(constants_1.JING_CONTRACTS.BID.address, constants_1.JING_CONTRACTS.YIN.name, transactions_1.FungibleConditionCode.LessEqual, fees),
        ];
        const txOptions = {
            contractAddress: constants_1.JING_CONTRACTS.BID.address,
            contractName: constants_1.JING_CONTRACTS.BID.name,
            functionName: "submit-swap",
            functionArgs: [
                (0, transactions_1.uintCV)(swapId),
                (0, transactions_1.contractPrincipalCV)(tokenInfo.contractAddress, tokenInfo.contractName),
                (0, transactions_1.contractPrincipalCV)(constants_1.JING_CONTRACTS.YIN.address, constants_1.JING_CONTRACTS.YIN.name),
            ],
            senderKey: key,
            validateWithAbi: true,
            network: networkObj,
            anchorMode: transactions_1.AnchorMode.Any,
            postConditionMode: transactions_1.PostConditionMode.Deny,
            postConditions,
            nonce,
            fee: gasFee,
        };
        try {
            const transaction = await (0, transactions_1.makeContractCall)(txOptions);
            const broadcastResponse = await (0, transactions_1.broadcastTransaction)(transaction, networkObj);
            return {
                txid: broadcastResponse.txid,
                details: {
                    swapId,
                    tokenDecimals,
                    tokenSymbol: tokenInfo.symbol,
                    address,
                    bidDetails,
                    fees: fees / 1000000,
                    gasFee: gasFee / 1000000,
                },
            };
        }
        catch (error) {
            throw new Error(`Failed to submit bid swap: ${error instanceof Error ? error.message : "Unknown error"}`);
        }
    }
    async submitAsk({ swapId, gasFee, accountIndex = 0, mnemonic, }) {
        const networkObj = (0, network_1.getNetwork)(this.network);
        const { address, key } = await (0, account_1.deriveChildAccount)(this.network, mnemonic, accountIndex);
        const nonce = await (0, network_1.getNextNonce)(this.network, address);
        // Get ask details
        const askDetails = await this.getAskDetails(swapId);
        // Get token info from the ask details
        const result = await (0, transactions_1.callReadOnlyFunction)({
            contractAddress: constants_1.JING_CONTRACTS.ASK.address,
            contractName: constants_1.JING_CONTRACTS.ASK.name,
            functionName: "get-swap",
            functionArgs: [(0, transactions_1.uintCV)(swapId)],
            network: networkObj,
            senderAddress: this.defaultAddress,
        });
        const jsonResult = (0, transactions_1.cvToJSON)(result);
        if (!jsonResult.success)
            throw new Error("Failed to get ask details");
        const ftContract = jsonResult.value.value.ft.value;
        const tokenInfo = (0, token_utils_1.getTokenInfoFromContract)(ftContract);
        const tokenDecimals = await (0, token_utils_1.getTokenDecimals)(tokenInfo, this.network, this.defaultAddress);
        const fees = (0, token_utils_1.calculateAskFees)(askDetails.amount);
        const postConditions = [
            // You send STX
            (0, transactions_1.makeStandardSTXPostCondition)(address, transactions_1.FungibleConditionCode.Equal, askDetails.ustx),
            // Contract sends FT
            (0, transactions_1.makeContractFungiblePostCondition)(constants_1.JING_CONTRACTS.ASK.address, constants_1.JING_CONTRACTS.ASK.name, transactions_1.FungibleConditionCode.Equal, askDetails.amount, (0, transactions_1.createAssetInfo)(tokenInfo.contractAddress, tokenInfo.contractName, tokenInfo.assetName)),
            // Fees from YANG contract
            (0, transactions_1.makeContractFungiblePostCondition)(constants_1.JING_CONTRACTS.ASK.address, constants_1.JING_CONTRACTS.YANG.name, transactions_1.FungibleConditionCode.LessEqual, fees, (0, transactions_1.createAssetInfo)(tokenInfo.contractAddress, tokenInfo.contractName, tokenInfo.assetName)),
        ];
        const txOptions = {
            contractAddress: constants_1.JING_CONTRACTS.ASK.address,
            contractName: constants_1.JING_CONTRACTS.ASK.name,
            functionName: "submit-swap",
            functionArgs: [
                (0, transactions_1.uintCV)(swapId),
                (0, transactions_1.contractPrincipalCV)(tokenInfo.contractAddress, tokenInfo.contractName),
                (0, transactions_1.contractPrincipalCV)(constants_1.JING_CONTRACTS.YANG.address, constants_1.JING_CONTRACTS.YANG.name),
            ],
            senderKey: key,
            validateWithAbi: true,
            network: networkObj,
            anchorMode: transactions_1.AnchorMode.Any,
            postConditionMode: transactions_1.PostConditionMode.Deny,
            postConditions,
            nonce,
            fee: gasFee,
        };
        try {
            const transaction = await (0, transactions_1.makeContractCall)(txOptions);
            const broadcastResponse = await (0, transactions_1.broadcastTransaction)(transaction, networkObj);
            return {
                txid: broadcastResponse.txid,
                details: {
                    swapId,
                    tokenDecimals,
                    tokenSymbol: tokenInfo.symbol,
                    address,
                    askDetails,
                    fees: fees / Math.pow(10, tokenDecimals),
                    gasFee: gasFee / 1000000,
                },
            };
        }
        catch (error) {
            throw new Error(`Failed to submit ask swap: ${error instanceof Error ? error.message : "Unknown error"}`);
        }
    }
    // Add these methods to JingCashSDK class
    async repriceBid({ swapId, newTokenAmount, pair, recipient, expiry, accountIndex = 0, mnemonic, gasFee = 10000, }) {
        const tokenInfo = (0, token_utils_1.getTokenInfo)(pair);
        if (!tokenInfo) {
            throw new Error(`Failed to get token info for pair: ${pair}`);
        }
        const tokenDecimals = await (0, token_utils_1.getTokenDecimals)(tokenInfo, this.network, this.defaultAddress);
        const microTokenAmount = Math.floor(newTokenAmount * Math.pow(10, tokenDecimals));
        const networkObj = (0, network_1.getNetwork)(this.network);
        const { address, key } = await (0, account_1.deriveChildAccount)(this.network, mnemonic, accountIndex);
        const nonce = await (0, network_1.getNextNonce)(this.network, address);
        // Get current bid details and verify ownership
        const bidDetails = await this.getBidDetails(swapId);
        if (bidDetails.stxSender !== address) {
            throw new Error(`Only the bid creator (${bidDetails.stxSender}) can reprice this bid`);
        }
        const txOptions = {
            contractAddress: constants_1.JING_CONTRACTS.BID.address,
            contractName: constants_1.JING_CONTRACTS.BID.name,
            functionName: "re-price",
            functionArgs: [
                (0, transactions_1.uintCV)(swapId),
                (0, transactions_1.contractPrincipalCV)(tokenInfo.contractAddress, tokenInfo.contractName),
                (0, transactions_1.contractPrincipalCV)(constants_1.JING_CONTRACTS.YIN.address, constants_1.JING_CONTRACTS.YIN.name),
                (0, transactions_1.uintCV)(microTokenAmount),
                expiry ? (0, transactions_1.someCV)((0, transactions_1.uintCV)(expiry)) : (0, transactions_1.noneCV)(),
                recipient ? (0, transactions_1.someCV)((0, transactions_1.standardPrincipalCV)(recipient)) : (0, transactions_1.noneCV)(),
            ],
            senderKey: key,
            validateWithAbi: true,
            network: networkObj,
            anchorMode: transactions_1.AnchorMode.Any,
            postConditionMode: transactions_1.PostConditionMode.Allow,
            nonce,
            fee: gasFee,
        };
        try {
            const transaction = await (0, transactions_1.makeContractCall)(txOptions);
            const broadcastResponse = await (0, transactions_1.broadcastTransaction)(transaction, networkObj);
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
                    gasFee: gasFee / 1000000,
                },
            };
        }
        catch (error) {
            throw new Error(`Failed to reprice bid: ${error instanceof Error ? error.message : "Unknown error"}`);
        }
    }
    async repriceAsk({ swapId, newStxAmount, pair, recipient, expiry, accountIndex = 0, mnemonic, gasFee = 10000, }) {
        const tokenInfo = (0, token_utils_1.getTokenInfo)(pair);
        if (!tokenInfo) {
            throw new Error(`Failed to get token info for pair: ${pair}`);
        }
        const newUstx = Math.floor(newStxAmount * 1000000);
        const networkObj = (0, network_1.getNetwork)(this.network);
        const { address, key } = await (0, account_1.deriveChildAccount)(this.network, mnemonic, accountIndex);
        const nonce = await (0, network_1.getNextNonce)(this.network, address);
        // Get current ask details and verify ownership
        const askDetails = await this.getAskDetails(swapId);
        if (askDetails.ftSender !== address) {
            throw new Error(`Only the ask creator (${askDetails.ftSender}) can reprice this ask`);
        }
        const txOptions = {
            contractAddress: constants_1.JING_CONTRACTS.ASK.address,
            contractName: constants_1.JING_CONTRACTS.ASK.name,
            functionName: "re-price",
            functionArgs: [
                (0, transactions_1.uintCV)(swapId),
                (0, transactions_1.contractPrincipalCV)(tokenInfo.contractAddress, tokenInfo.contractName),
                (0, transactions_1.contractPrincipalCV)(constants_1.JING_CONTRACTS.YANG.address, constants_1.JING_CONTRACTS.YANG.name),
                (0, transactions_1.uintCV)(newUstx),
                expiry ? (0, transactions_1.someCV)((0, transactions_1.uintCV)(expiry)) : (0, transactions_1.noneCV)(),
                recipient ? (0, transactions_1.someCV)((0, transactions_1.standardPrincipalCV)(recipient)) : (0, transactions_1.noneCV)(),
            ],
            senderKey: key,
            validateWithAbi: true,
            network: networkObj,
            anchorMode: transactions_1.AnchorMode.Any,
            postConditionMode: transactions_1.PostConditionMode.Allow,
            nonce,
            fee: gasFee,
        };
        try {
            const transaction = await (0, transactions_1.makeContractCall)(txOptions);
            const broadcastResponse = await (0, transactions_1.broadcastTransaction)(transaction, networkObj);
            return {
                txid: broadcastResponse.txid,
                details: {
                    swapId,
                    tokenDecimals: await (0, token_utils_1.getTokenDecimals)(tokenInfo, this.network, this.defaultAddress),
                    tokenSymbol: tokenInfo.symbol,
                    address,
                    askDetails,
                    newUstx,
                    recipient,
                    expiry,
                    gasFee: gasFee / 1000000,
                },
            };
        }
        catch (error) {
            throw new Error(`Failed to reprice ask: ${error instanceof Error ? error.message : "Unknown error"}`);
        }
    }
    async formatSwapResponse(rawResponse) {
        if (!rawResponse.success)
            return null;
        const value = rawResponse.value.value;
        const ftContract = value.ft.value;
        // Retrieve token info and decimals directly within SDK
        const tokenInfo = (0, token_utils_1.getTokenInfoFromContract)(ftContract);
        const tokenSymbol = tokenInfo.symbol;
        const tokenDecimals = await (0, token_utils_1.getTokenDecimals)(tokenInfo, this.network, this.defaultAddress);
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
    async getBid(swapId) {
        const network = (0, network_1.getNetwork)(this.network);
        const senderAddress = this.defaultAddress;
        try {
            const result = await (0, transactions_1.callReadOnlyFunction)({
                contractAddress: constants_1.JING_CONTRACTS.BID.address,
                contractName: constants_1.JING_CONTRACTS.BID.name,
                functionName: "get-swap",
                functionArgs: [(0, transactions_1.uintCV)(swapId)],
                network,
                senderAddress,
            });
            const jsonResult = (0, transactions_1.cvToJSON)(result);
            const formattedSwap = await this.formatSwapResponse(jsonResult);
            if (formattedSwap) {
                return {
                    ...formattedSwap,
                    contract: {
                        address: constants_1.JING_CONTRACTS.BID.address,
                        name: constants_1.JING_CONTRACTS.BID.name,
                    },
                };
            }
            else {
                console.error("Failed to parse swap details");
                return null;
            }
        }
        catch (error) {
            console.error(`Error fetching swap: ${error instanceof Error ? error.message : "Unknown error"}`);
            throw error;
        }
    }
    async getAsk(swapId) {
        const network = (0, network_1.getNetwork)(this.network);
        const senderAddress = this.defaultAddress;
        try {
            const result = await (0, transactions_1.callReadOnlyFunction)({
                contractAddress: constants_1.JING_CONTRACTS.ASK.address,
                contractName: constants_1.JING_CONTRACTS.ASK.name,
                functionName: "get-swap",
                functionArgs: [(0, transactions_1.uintCV)(swapId)],
                network,
                senderAddress,
            });
            const jsonResult = (0, transactions_1.cvToJSON)(result);
            const formattedSwap = await this.formatSwapResponse(jsonResult);
            if (formattedSwap) {
                return {
                    ...formattedSwap,
                    contract: {
                        address: constants_1.JING_CONTRACTS.ASK.address,
                        name: constants_1.JING_CONTRACTS.ASK.name,
                    },
                };
            }
            else {
                console.error("Failed to parse swap details");
                return null;
            }
        }
        catch (error) {
            console.error(`Error fetching swap: ${error instanceof Error ? error.message : "Unknown error"}`);
            throw error;
        }
    }
    async getAvailableMarkets() {
        const marketPromises = Object.entries(constants_1.TokenMap).map(async ([symbol, contract]) => {
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
        });
        const markets = await Promise.all(marketPromises);
        return markets.sort((a, b) => a.pair.localeCompare(b.pair));
    }
    async getMarket(pair) {
        const markets = await this.getAvailableMarkets();
        return markets.find((market) => market.pair === pair) || null;
    }
    async isValidPair(pair) {
        const markets = await this.getAvailableMarkets();
        return markets.some((market) => market.pair === pair);
    }
}
exports.JingCashSDK = JingCashSDK;
