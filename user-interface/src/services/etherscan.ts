import axios from 'axios';

// Get API key from environment, with fallback for Next.js
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || (typeof window === 'undefined' ? process.env.ETHERSCAN_API_KEY : null) || 'PX2BTACPYA6H4M6HV1EZJB7PAPFVJDVXT1';
const ETHERSCAN_API_URL = 'https://api.etherscan.io/v2/api';

// Rate limiting configuration
const RATE_LIMIT = {
  CALLS_PER_SECOND: 5,
  MIN_INTERVAL_MS: 1000 / 5, // 200ms between calls
  BURST_LIMIT: 5, // Maximum calls in a burst
  QUEUE_TIMEOUT_MS: 30000 // 30 seconds timeout for queued requests
};

// Rate limiting state
let callQueue: Array<{ url: string; resolve: Function; reject: Function; timestamp: number }> = [];
let lastCallTime = 0;
let callsInCurrentSecond = 0;
let currentSecondStart = Date.now();

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Rate-limited API call function that respects Etherscan's 5 calls/second limit
 */
async function rateLimitedApiCall(url: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const now = Date.now();
    
    // Reset counter if a new second has started
    if (now - currentSecondStart >= 1000) {
      callsInCurrentSecond = 0;
      currentSecondStart = now;
    }
    
    // Check if we can make the call immediately
    const timeSinceLastCall = now - lastCallTime;
    const canCallImmediately = callsInCurrentSecond < RATE_LIMIT.BURST_LIMIT && 
                              timeSinceLastCall >= RATE_LIMIT.MIN_INTERVAL_MS;
    
    if (canCallImmediately) {
      // Make the call immediately
      makeApiCall(url, resolve, reject);
    } else {
      // Queue the call
      const queueItem = { url, resolve, reject, timestamp: now };
      callQueue.push(queueItem);
      
      // Process queue if not already processing
      if (callQueue.length === 1) {
        processQueue();
      }
      
      // Set timeout for queued requests
      setTimeout(() => {
        const index = callQueue.findIndex(item => item === queueItem);
        if (index !== -1) {
          callQueue.splice(index, 1);
          reject(new Error(`API call timeout after ${RATE_LIMIT.QUEUE_TIMEOUT_MS}ms`));
        }
      }, RATE_LIMIT.QUEUE_TIMEOUT_MS);
    }
  });
}

/**
 * Make the actual API call and update rate limiting state
 */
async function makeApiCall(url: string, resolve: Function, reject: Function) {
  try {
    const now = Date.now();
    
    // Ensure minimum interval between calls
    const timeSinceLastCall = now - lastCallTime;
    if (timeSinceLastCall < RATE_LIMIT.MIN_INTERVAL_MS) {
      await sleep(RATE_LIMIT.MIN_INTERVAL_MS - timeSinceLastCall);
    }
    
    // Make the API call
    const response = await axios.get(url);
    
    // Update rate limiting state
    lastCallTime = Date.now();
    callsInCurrentSecond++;
    
    console.log(`🌐 API call made (${callsInCurrentSecond}/${RATE_LIMIT.CALLS_PER_SECOND} this second)`);
    
    resolve(response);
  } catch (error) {
    reject(error);
  }
}

/**
 * Process the call queue with rate limiting
 */
async function processQueue() {
  while (callQueue.length > 0) {
    const now = Date.now();
    
    // Reset counter if a new second has started
    if (now - currentSecondStart >= 1000) {
      callsInCurrentSecond = 0;
      currentSecondStart = now;
    }
    
    // Check if we can make a call
    if (callsInCurrentSecond >= RATE_LIMIT.CALLS_PER_SECOND) {
      // Wait until next second
      const waitTime = 1000 - (now - currentSecondStart);
      console.log(`⏳ Rate limit reached, waiting ${waitTime}ms for next second`);
      await sleep(waitTime);
      continue;
    }
    
    const timeSinceLastCall = now - lastCallTime;
    if (timeSinceLastCall < RATE_LIMIT.MIN_INTERVAL_MS) {
      // Wait for minimum interval
      const waitTime = RATE_LIMIT.MIN_INTERVAL_MS - timeSinceLastCall;
      console.log(`⏳ Waiting ${waitTime}ms for rate limit interval`);
      await sleep(waitTime);
      continue;
    }
    
    // Make the next call
    const queueItem = callQueue.shift();
    if (queueItem) {
      // We need to get the URL from the queue item, but we don't store it
      // Let's modify the queue structure to include the URL
      makeApiCall(queueItem.url, queueItem.resolve, queueItem.reject);
    }
  }
}

// Legacy function for backward compatibility (now uses rate limiting)
async function throttledGet(url: string) {
  return rateLimitedApiCall(url);
}

function hexToDecimal(hex: string) {
  if (!hex) return null;
  return BigInt(hex).toString(10);
}

function weiToEth(wei: string) {
  if (!wei) return null;
  return (Number(BigInt(wei)) / 1e18).toString();
}

function weiToGwei(wei: string) {
  if (!wei) return null;
  return (Number(BigInt(wei)) / 1e9).toString();
}

function tokenValueToDecimal(value: string, decimals: number = 18) {
  if (!value) return null;
  return (Number(BigInt(value)) / Math.pow(10, decimals)).toString();
}

function addHumanReadableToERC20(transfers: any[]): any[] {
  return transfers.map(t => ({
    ...t,
    valueDecimal: tokenValueToDecimal(t.value, t.tokenDecimal ? Number(t.tokenDecimal) : 18)
  }));
}

function addHumanReadableToERC721(transfers: any[]): any[] {
  return transfers.map(t => ({
    ...t,
    tokenIdDecimal: t.tokenID ? BigInt(t.tokenID).toString(10) : null
  }));
}

function addHumanReadableToERC1155(transfers: any[]): any[] {
  return transfers.map(t => ({
    ...t,
    valueDecimal: t.value ? BigInt(t.value).toString(10) : null,
    tokenIdDecimal: t.tokenID ? BigInt(t.tokenID).toString(10) : null
  }));
}

/**
 * Fetch EVM transactions for a given address and chainId (Ethereum: 1, Avalanche: 43114)
 */
export async function getEvmTransactions(address: string, chainId: number, startblock: number = 0): Promise<any[]> {
  if (!ETHERSCAN_API_KEY) {
    console.error('ETHERSCAN_API_KEY not set. Available env vars:', Object.keys(process.env).filter(k => k.includes('ETHERSCAN')));
    throw new Error('ETHERSCAN_API_KEY not set');
  }
  const url = `${ETHERSCAN_API_URL}?chainid=${chainId}&module=account&action=txlist&address=${address}&startblock=${startblock}&endblock=99999999&sort=asc&apikey=${ETHERSCAN_API_KEY}`;
  const res = await throttledGet(url);
  if (res.data.status !== '1') {
    // Handle "No transactions found" gracefully
    if (res.data.message && res.data.message.includes('No transactions found')) {
      console.warn(`No transactions found for address ${address}`);
      return [];
    }
    console.warn(`Error fetching transactions for ${address}: ${res.data.message}`);
    return [];
  }
  return res.data.result;
}

/**
 * Fetch EVM internal transactions for a given address and chainId
 */
export async function getEvmInternalTransactions(address: string, chainId: number, startblock: number = 0): Promise<any[]> {
  if (!ETHERSCAN_API_KEY) throw new Error('ETHERSCAN_API_KEY not set');
  const url = `${ETHERSCAN_API_URL}?chainid=${chainId}&module=account&action=txlistinternal&address=${address}&startblock=${startblock}&endblock=99999999&sort=asc&apikey=${ETHERSCAN_API_KEY}`;
  const res = await throttledGet(url);
  if (res.data.status !== '1') {
    // Handle "No transactions found" gracefully
    if (res.data.message && res.data.message.includes('No transactions found')) {
      console.warn(`No internal transactions found for address ${address}`);
      return [];
    }
    console.warn(`Error fetching internal transactions for ${address}: ${res.data.message}`);
    return [];
  }
  return res.data.result;
}

/**
 * Fetch EVM ERC-20 transfers for a given address and chainId
 */
export async function getEvmERC20Transfers(address: string, chainId: number, startblock: number = 0): Promise<any[]> {
  if (!ETHERSCAN_API_KEY) throw new Error('ETHERSCAN_API_KEY not set');
  const url = `${ETHERSCAN_API_URL}?chainid=${chainId}&module=account&action=tokentx&address=${address}&startblock=${startblock}&endblock=99999999&sort=asc&apikey=${ETHERSCAN_API_KEY}`;
  const res = await throttledGet(url);
  if (res.data.status !== '1') {
    // Handle "No transactions found" gracefully
    if (res.data.message && res.data.message.includes('No transactions found')) {
      console.warn(`No ERC-20 transfers found for address ${address}`);
      return [];
    }
    console.warn(`Error fetching ERC-20 transfers for ${address}: ${res.data.message}`);
    return [];
  }
  return res.data.result;
}

/**
 * Fetch EVM transaction details for a given tx hash and chainId, including normal, internal, ERC-20, ERC-721, and ERC-1155 transfers
 * Adds human-readable fields for AI and user analysis.
 */
export async function getEvmTransactionDetails(txHash: string, chainId: number): Promise<any> {
  if (!ETHERSCAN_API_KEY) throw new Error('ETHERSCAN_API_KEY not set');
  // Get transaction receipt
  const receiptUrl = `${ETHERSCAN_API_URL}?chainid=${chainId}&module=proxy&action=eth_getTransactionReceipt&txhash=${txHash}&apikey=${ETHERSCAN_API_KEY}`;
  const receiptRes = await throttledGet(receiptUrl);
  // Get transaction info
  const infoUrl = `${ETHERSCAN_API_URL}?chainid=${chainId}&module=proxy&action=eth_getTransactionByHash&txhash=${txHash}&apikey=${ETHERSCAN_API_KEY}`;
  const infoRes = await throttledGet(infoUrl);
  // Get internal transactions
  const internalUrl = `${ETHERSCAN_API_URL}?chainid=${chainId}&module=account&action=txlistinternal&txhash=${txHash}&apikey=${ETHERSCAN_API_KEY}`;
  const internalRes = await throttledGet(internalUrl);
  // Get ERC-20 transfers
  const erc20Url = `${ETHERSCAN_API_URL}?chainid=${chainId}&module=account&action=tokentx&txhash=${txHash}&apikey=${ETHERSCAN_API_KEY}`;
  const erc20Res = await throttledGet(erc20Url);
  // Get ERC-721 transfers
  const erc721Url = `${ETHERSCAN_API_URL}?chainid=${chainId}&module=account&action=tokennfttx&txhash=${txHash}&apikey=${ETHERSCAN_API_KEY}`;
  const erc721Res = await throttledGet(erc721Url);
  // Get ERC-1155 transfers
  const erc1155Url = `${ETHERSCAN_API_URL}?chainid=${chainId}&module=account&action=token1155tx&txhash=${txHash}&apikey=${ETHERSCAN_API_KEY}`;
  const erc1155Res = await throttledGet(erc1155Url);
  function safeResult(res: any) {
    if (typeof res.data.result === 'string' && res.data.result.startsWith('Error!')) {
      return [];
    }
    return res.data.result || [];
  }
  // Add human-readable fields
  const info = infoRes.data.result;
  const receipt = receiptRes.data.result;
  const valueEth = info && info.value ? weiToEth(info.value) : null;
  const gasUsedEth = receipt && receipt.gasUsed && info && info.gasPrice ? weiToEth((BigInt(receipt.gasUsed) * BigInt(info.gasPrice)).toString()) : null;
  const gasPriceGwei = info && info.gasPrice ? weiToGwei(info.gasPrice) : null;
  const blockNumberDecimal = info && info.blockNumber ? parseInt(info.blockNumber, 16) : null;
  // Add human-readable to token transfers
  const erc20Transfers = addHumanReadableToERC20(safeResult(erc20Res));
  const erc721Transfers = addHumanReadableToERC721(safeResult(erc721Res));
  const erc1155Transfers = addHumanReadableToERC1155(safeResult(erc1155Res));
  return {
    receipt,
    info: {
      ...info,
      valueEth,
      gasPriceGwei,
      blockNumberDecimal
    },
    gasUsedEth,
    internalTransactions: safeResult(internalRes),
    erc20Transfers,
    erc721Transfers,
    erc1155Transfers,
  };
} 