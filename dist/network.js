"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getNetworkByPrincipal = getNetworkByPrincipal;
exports.validateNetwork = validateNetwork;
exports.getNetwork = getNetwork;
exports.getTxVersion = getTxVersion;
exports.getApiUrl = getApiUrl;
exports.callReadOnlyFunction = callReadOnlyFunction;
exports.cvToJSON = cvToJSON;
exports.logBroadcastResult = logBroadcastResult;
exports.getNonces = getNonces;
exports.getNextNonce = getNextNonce;
const common_1 = require("@stacks/common");
const network_1 = require("@stacks/network");
const transactions_1 = require("@stacks/transactions");
function getNetworkByPrincipal(principal) {
    if ((0, transactions_1.validateStacksAddress)(principal)) {
        const prefix = principal.substring(0, 2);
        if (prefix === "SP" || prefix === "SM") {
            return "mainnet";
        }
        else if (prefix === "ST" || prefix === "SN") {
            return "testnet";
        }
    }
    console.log("Invalid principal, using testnet");
    return "testnet";
}
function validateNetwork(network) {
    if (network &&
        ["mainnet", "testnet", "devnet", "mocknet"].includes(network)) {
        return network;
    }
    return "testnet";
}
function getNetwork(network) {
    switch (network) {
        case "mainnet":
            return new network_1.StacksMainnet();
        case "testnet":
            return new network_1.StacksTestnet();
        default:
            return new network_1.StacksTestnet();
    }
}
function getTxVersion(network) {
    switch (network) {
        case "mainnet":
            return common_1.TransactionVersion.Mainnet;
        case "testnet":
            return common_1.TransactionVersion.Testnet;
        default:
            return common_1.TransactionVersion.Testnet;
    }
}
function getApiUrl(network) {
    switch (network) {
        case "mainnet":
            return "https://api.hiro.so";
        case "testnet":
            return "https://api.testnet.hiro.so";
        default:
            return "https://api.testnet.hiro.so";
    }
}
async function callReadOnlyFunction(options) {
    return (0, transactions_1.callReadOnlyFunction)(options);
}
function cvToJSON(val) {
    return (0, transactions_1.cvToJSON)(val);
}
async function logBroadcastResult(broadcastResponse, from) {
    if ("error" in broadcastResponse) {
        console.error("Transaction failed to broadcast");
        console.error(`Error: ${broadcastResponse.error}`);
        if (broadcastResponse.reason) {
            console.error(`Reason: ${broadcastResponse.reason}`);
        }
        if (broadcastResponse.reason_data) {
            console.error(`Reason Data: ${JSON.stringify(broadcastResponse.reason_data, null, 2)}`);
        }
    }
    else {
        console.log("Transaction broadcasted successfully!");
        if (from)
            console.log(`FROM: ${from}`);
        console.log(`TXID: 0x${broadcastResponse.txid}`);
    }
}
// gets the current nonce for the account from the API
// more reliable than @stacks/transactions getNonce()
async function getNonces(network, address) {
    const apiUrl = getApiUrl(network);
    const response = await fetch(`${apiUrl}/extended/v1/address/${address}/nonces`);
    if (!response.ok) {
        throw new Error(`Failed to get nonce: ${response.statusText}`);
    }
    const data = await response.json();
    return data;
}
async function getNextNonce(network, address) {
    const nonces = await getNonces(network, address);
    const nextNonce = nonces.possible_next_nonce;
    return nextNonce;
}
