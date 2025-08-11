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
    const timeSinceLastCall = now - lastCallTime;
    if (callsInCurrentSecond < RATE_LIMIT.BURST_LIMIT && timeSinceLastCall >= RATE_LIMIT.MIN_INTERVAL_MS) {
      const item = callQueue.shift();
      if (item) {
        makeApiCall(item.url, item.resolve, item.reject);
      }
    } else {
      // Wait before trying again
      const waitTime = Math.max(RATE_LIMIT.MIN_INTERVAL_MS - timeSinceLastCall, 100);
      await sleep(waitTime);
    }
  }
}

/**
 * Throttled GET request with rate limiting
 */
async function throttledGet(url: string) {
  return rateLimitedApiCall(url);
}

function hexToDecimal(hex: string) {
  return parseInt(hex, 16);
}

function weiToEth(wei: string) {
  return Number(wei) / 1e18;
}

function weiToGwei(wei: string) {
  return Number(wei) / 1e9;
}

function tokenValueToDecimal(value: string, decimals: number = 18) {
  return Number(value) / Math.pow(10, decimals);
}

function addHumanReadableToERC20(transfers: any[]): any[] {
  return transfers.map(t => ({
    ...t,
    valueDecimal: tokenValueToDecimal(t.value, t.tokenDecimal || 18)
  }));
}

function addHumanReadableToERC721(transfers: any[]): any[] {
  return transfers.map(t => ({
    ...t,
    tokenIdDecimal: hexToDecimal(t.tokenID)
  }));
}

function addHumanReadableToERC1155(transfers: any[]): any[] {
  return transfers.map(t => ({
    ...t,
    tokenIdDecimal: hexToDecimal(t.tokenID),
    valueDecimal: tokenValueToDecimal(t.value, t.tokenDecimal || 0)
  }));
}

/**
 * 🔄 FIXED: Fetch EVM transactions with DESC sorting for proper fund flow tracking
 * Now returns newest transactions first, following money forward in time
 */
export async function getEvmTransactions(address: string, chainId: number, startblock: number = 0): Promise<any[]> {
  if (!ETHERSCAN_API_KEY) {
    console.error('ETHERSCAN_API_KEY not set. Available env vars:', Object.keys(process.env).filter(k => k.includes('ETHERSCAN')));
    throw new Error('ETHERSCAN_API_KEY not set');
  }
  
  // 🔄 FIX: Use DESC sorting for proper fund flow tracking (newest to oldest)
  // This ensures we get the most recent transactions first, following money forward in time
  const url = `${ETHERSCAN_API_URL}?chainid=${chainId}&module=account&action=txlist&address=${address}&startblock=${startblock}&endblock=99999999&sort=desc&apikey=${ETHERSCAN_API_KEY}`;
  
  console.log(`🔍 Fetching transactions for ${address} with DESC sorting (newest first) from block ${startblock}`);
  
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
  
  const transactions = res.data.result;
  console.log(`📊 Found ${transactions.length} transactions for ${address} (max 10,000 per query)`);
  
  // ⚠️ WARNING: If we get exactly 10,000 transactions, we might be missing older ones
  if (transactions.length === 10000) {
    console.warn(`⚠️ WARNING: Address ${address} returned exactly 10,000 transactions. We may be missing older transactions due to Etherscan's limit.`);
    console.warn(`   Consider implementing pagination for comprehensive fund tracking.`);
  }
  
  return transactions;
}

/**
 * 🔄 FIXED: Fetch EVM internal transactions with DESC sorting
 */
export async function getEvmInternalTransactions(address: string, chainId: number, startblock: number = 0): Promise<any[]> {
  if (!ETHERSCAN_API_KEY) throw new Error('ETHERSCAN_API_KEY not set');
  
  // 🔄 FIX: Use DESC sorting for proper fund flow tracking
  const url = `${ETHERSCAN_API_URL}?chainid=${chainId}&module=account&action=txlistinternal&address=${address}&startblock=${startblock}&endblock=99999999&sort=desc&apikey=${ETHERSCAN_API_KEY}`;
  
  console.log(`🔍 Fetching internal transactions for ${address} with DESC sorting from block ${startblock}`);
  
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
  
  const transactions = res.data.result;
  console.log(`📊 Found ${transactions.length} internal transactions for ${address}`);
  
  return transactions;
}

/**
 * 🔄 FIXED: Fetch EVM ERC-20 transfers with DESC sorting
 */
export async function getEvmERC20Transfers(address: string, chainId: number, startblock: number = 0): Promise<any[]> {
  if (!ETHERSCAN_API_KEY) throw new Error('ETHERSCAN_API_KEY not set');
  
  // 🔄 FIX: Use DESC sorting for proper fund flow tracking
  const url = `${ETHERSCAN_API_URL}?chainid=${chainId}&module=account&action=tokentx&address=${address}&startblock=${startblock}&endblock=99999999&sort=desc&apikey=${ETHERSCAN_API_KEY}`;
  
  console.log(`🔍 Fetching ERC-20 transfers for ${address} with DESC sorting from block ${startblock}`);
  
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
  
  const transactions = res.data.result;
  console.log(`📊 Found ${transactions.length} ERC-20 transfers for ${address}`);
  
  return transactions;
}

/**
 * 🔄 NEW: Fetch EVM transactions with pagination support for 10,000 limit
 * This ensures we get ALL transactions, not just the first 10,000
 */
export async function getEvmTransactionsWithPagination(address: string, chainId: number, startblock: number = 0): Promise<any[]> {
  const allTransactions: any[] = [];
  let currentStartblock = startblock;
  let hasMore = true;
  let pageCount = 0;
  
  console.log(`📄 Starting paginated transaction fetch for ${address} from block ${startblock}`);
  
  while (hasMore) {
    pageCount++;
    const url = `${ETHERSCAN_API_URL}?chainid=${chainId}&module=account&action=txlist&address=${address}&startblock=${currentStartblock}&endblock=99999999&sort=desc&apikey=${ETHERSCAN_API_KEY}`;
    const res = await throttledGet(url);
    
    if (res.data.status !== '1') {
      console.warn(`Error in page ${pageCount} for ${address}: ${res.data.message}`);
      break;
    }
    
    const transactions = res.data.result;
    allTransactions.push(...transactions);
    
    console.log(`📄 Page ${pageCount}: Got ${transactions.length} transactions for ${address}`);
    
    // If we got less than 10,000, we're done
    if (transactions.length < 10000) {
      hasMore = false;
      console.log(`📄 Pagination complete for ${address}: ${allTransactions.length} total transactions across ${pageCount} pages`);
    } else {
      // Get the oldest block number from this batch and continue
      const oldestBlock = Math.min(...transactions.map(tx => Number(tx.blockNumber)));
      currentStartblock = oldestBlock + 1;
      console.log(`📄 Continuing pagination from block ${currentStartblock} (oldest in this batch: ${oldestBlock})`);
    }
  }
  
  return allTransactions;
}

/**
 * 🔄 NEW: Fetch EVM internal transactions with pagination support
 */
export async function getEvmInternalTransactionsWithPagination(address: string, chainId: number, startblock: number = 0): Promise<any[]> {
  const allTransactions: any[] = [];
  let currentStartblock = startblock;
  let hasMore = true;
  let pageCount = 0;
  
  console.log(`📄 Starting paginated internal transaction fetch for ${address} from block ${startblock}`);
  
  while (hasMore) {
    pageCount++;
    const url = `${ETHERSCAN_API_URL}?chainid=${chainId}&module=account&action=txlistinternal&address=${address}&startblock=${currentStartblock}&endblock=99999999&sort=desc&apikey=${ETHERSCAN_API_KEY}`;
    const res = await throttledGet(url);
    
    if (res.data.status !== '1') {
      console.warn(`Error in page ${pageCount} for ${address}: ${res.data.message}`);
      break;
    }
    
    const transactions = res.data.result;
    allTransactions.push(...transactions);
    
    console.log(`📄 Page ${pageCount}: Got ${transactions.length} internal transactions for ${address}`);
    
    // If we got less than 10,000, we're done
    if (transactions.length < 10000) {
      hasMore = false;
      console.log(`📄 Internal pagination complete for ${address}: ${allTransactions.length} total transactions across ${pageCount} pages`);
    } else {
      // Get the oldest block number from this batch and continue
      const oldestBlock = Math.min(...transactions.map(tx => Number(tx.blockNumber)));
      currentStartblock = oldestBlock + 1;
      console.log(`📄 Continuing internal pagination from block ${currentStartblock}`);
    }
  }
  
  return allTransactions;
}

/**
 * 🔄 NEW: Fetch EVM ERC-20 transfers with pagination support
 */
export async function getEvmERC20TransfersWithPagination(address: string, chainId: number, startblock: number = 0): Promise<any[]> {
  const allTransactions: any[] = [];
  let currentStartblock = startblock;
  let hasMore = true;
  let pageCount = 0;
  
  console.log(`📄 Starting paginated ERC-20 fetch for ${address} from block ${startblock}`);
  
  while (hasMore) {
    pageCount++;
    const url = `${ETHERSCAN_API_URL}?chainid=${chainId}&module=account&action=tokentx&address=${address}&startblock=${currentStartblock}&endblock=99999999&sort=desc&apikey=${ETHERSCAN_API_KEY}`;
    const res = await throttledGet(url);
    
    if (res.data.status !== '1') {
      console.warn(`Error in page ${pageCount} for ${address}: ${res.data.message}`);
      break;
    }
    
    const transactions = res.data.result;
    allTransactions.push(...transactions);
    
    console.log(`📄 Page ${pageCount}: Got ${transactions.length} ERC-20 transfers for ${address}`);
    
    // If we got less than 10,000, we're done
    if (transactions.length < 10000) {
      hasMore = false;
      console.log(`📄 ERC-20 pagination complete for ${address}: ${allTransactions.length} total transfers across ${pageCount} pages`);
    } else {
      // Get the oldest block number from this batch and continue
      const oldestBlock = Math.min(...transactions.map(tx => Number(tx.blockNumber)));
      currentStartblock = oldestBlock + 1;
      console.log(`📄 Continuing ERC-20 pagination from block ${currentStartblock}`);
    }
  }
  
  return allTransactions;
}

/**
 * 🔄 NEW: Validate block number progression for forward mapping
 * Ensures that blockNumber(Tx N) >= blockNumber(Tx N+1) for proper fund flow tracking
 */
export function validateForwardMapping(transactions: any[], prevTx?: any): any[] {
  if (!prevTx) {
    console.log(`🔍 Forward mapping validation: No previous transaction, accepting all ${transactions.length} transactions`);
    return transactions;
  }
  
  const prevBlock = Number(prevTx.blockNumber);
  console.log(`🔍 Forward mapping validation: Previous transaction at block ${prevBlock}`);
  
  // Filter transactions to ensure forward progression
  const forwardTransactions = transactions.filter(tx => {
    const txBlock = Number(tx.blockNumber);
    const isValid = txBlock >= prevBlock;
    
    if (!isValid) {
      console.log(`⏰ Skipping transaction ${tx.hash?.substring(0, 10)}... (block ${txBlock} < prev block ${prevBlock})`);
    }
    
    return isValid;
  });
  
  console.log(`🔍 Forward mapping validation: ${transactions.length} → ${forwardTransactions.length} transactions (ensuring block progression)`);
  return forwardTransactions;
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
    info,
    valueEth,
    gasUsedEth,
    gasPriceGwei,
    blockNumberDecimal,
    internalTransactions: safeResult(internalRes),
    erc20Transfers,
    erc721Transfers,
    erc1155Transfers
  };
} 