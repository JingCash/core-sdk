"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTokenInfo = getTokenInfo;
exports.getSupportedPairs = getSupportedPairs;
exports.getTokenSymbol = getTokenSymbol;
exports.getMarketPair = getMarketPair;
exports.calculateBidFees = calculateBidFees;
exports.calculateAskFees = calculateAskFees;
exports.toMicroUnits = toMicroUnits;
exports.fromMicroUnits = fromMicroUnits;
exports.formatAmount = formatAmount;
const constants_1 = require("./constants");
function getTokenInfo(pairString) {
    const symbol = pairString.split("-")[0];
    const ft = constants_1.TokenMap[symbol];
    if (!ft)
        return null;
    const [contractPart, assetName] = ft.split("::");
    const [contractAddress, contractName] = contractPart.split(".");
    return {
        ft,
        contractAddress,
        contractName,
        assetName,
    };
}
function getSupportedPairs() {
    return Object.keys(constants_1.TokenMap).map((symbol) => `${symbol}-STX`);
}
function getTokenSymbol(ft) {
    if (!ft)
        return "Unknown";
    const [contractAddress, contractNameWithToken] = ft.split(".");
    const contractName = contractNameWithToken?.split("::")[0];
    const fullFt = Object.keys(constants_1.TokenMapInverse).find((key) => key.startsWith(`${contractAddress}.${contractName}`));
    return fullFt ? constants_1.TokenMapInverse[fullFt] : "Unknown Token";
}
function getMarketPair(contract) {
    if (!contract)
        return "UNKNOWN-STX";
    const [contractAddress, contractNameWithToken] = contract.split(".");
    const contractName = contractNameWithToken?.split("::")[0];
    const fullFt = Object.keys(constants_1.TokenMapInverse).find((key) => key.startsWith(`${contractAddress}.${contractName}`));
    const symbol = fullFt ? constants_1.TokenMapInverse[fullFt] : "UNKNOWN";
    return `${symbol}-STX`;
}
// Fee calculation utilities
function calculateBidFees(ustx) {
    if (ustx > 10000000000) {
        return Math.ceil(ustx / 450); // 0.25% fee for >10,000 STX
    }
    else if (ustx > 5000000000) {
        return Math.ceil(ustx / 200); // 0.50% fee for >5,000 STX
    }
    else {
        return Math.ceil(ustx / 133); // 0.75% fee for <=5,000 STX
    }
}
function calculateAskFees(amount) {
    return Math.ceil(amount / 400); // 0.25% fee
}
// Unit conversion utilities
function toMicroUnits(amount, decimals) {
    return Math.floor(amount * Math.pow(10, decimals));
}
function fromMicroUnits(microAmount, decimals) {
    return microAmount / Math.pow(10, decimals);
}
function formatAmount(amount, decimals, symbol) {
    const regular = fromMicroUnits(amount, decimals);
    return `${regular} ${symbol} (${amount} μ${symbol})`;
}
