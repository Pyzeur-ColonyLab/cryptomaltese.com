import axios from 'axios';

// Configuration constants from the specification
const CONFIG = {
  BRANCHING: {
    MAX_BRANCHES_PER_LAYER: 5,
    MIN_TRANSACTION_THRESHOLD: 0.001, // Reduced from 0.01 to 0.1% of address outflow
    FUND_COVERAGE_TARGET: 0.8, // 80%
    // New depth-based limits to prevent exponential growth
    DEPTH_LIMITS: {
      0: 10, // Depth 0: max 10 addresses
      1: 8,  // Depth 1: max 8 addresses  
      2: 5,  // Depth 2: max 5 addresses
      3: 3,  // Depth 3: max 3 addresses
      4: 2,  // Depth 4: max 2 addresses
      5: 1   // Depth 5+: max 1 address
    },
    // Minimum value thresholds (in ETH) to prevent processing dust transactions
    MIN_VALUE_THRESHOLD: 0.0001, // 0.0001 ETH minimum
    // Confidence threshold for early termination
    MIN_CONFIDENCE_THRESHOLD: 0.1
  },
  RISK_ASSESSMENT: {
    MIXER_INTERACTION_WEIGHT: 3.0,
    EXCHANGE_INTERACTION_WEIGHT: 1.5,
    PATTERN_DETECTION_WEIGHT: 2.0,
    TIME_DECAY_FACTOR: 0.9, // per month
  },
  PATTERN_DETECTION: {
    PEEL_CHAIN_SIMILARITY_THRESHOLD: 0.1, // 10%
    ROUND_NUMBER_FREQUENCY_THRESHOLD: 0.3, // 30%
    RAPID_TURNOVER_THRESHOLD: 3600, // 1 hour in seconds
  },
  // API optimization settings
  API_OPTIMIZATION: {
    ENABLE_CACHING: true,
    CACHE_DURATION_MS: 300000, // 5 minutes
    BATCH_SIZE: 3, // Process addresses in batches
    MAX_CONCURRENT_CALLS: 5, // Respect Etherscan rate limit
    RETRY_ATTEMPTS: 3,
    RETRY_DELAY_MS: 1000
  }
};

// Known address databases (simplified - in production these would be comprehensive)
const KNOWN_ADDRESSES = {
  MIXERS: [
    '0x722122df12d4e14e13ac3b6895a86e84145b6967', // Tornado Cash
    '0xdd4c48c0b24039969fc16d1cdf626eab821d3384', // Tornado Cash
    '0xd90e2f925da726b50c4ed8d0fb90ad053324f31b', // Tornado Cash
    '0x722122df12d4e14e13ac3b6895a86e84145b6967', // Tornado Cash
  ],
  EXCHANGES: [
    '0x21a31ee1afc51d94c2efccaa2092ad1028285549', // Binance
    '0x28c6c06298d514db089934071355e5743bf21d60', // Binance
    '0x3f5ce5fbfe3e9af3971dd833d26ba9b5c936f0be', // Binance
    '0xd551234ae421e3bcba99a0da6d736074f22192ff', // Binance
    '0x564286362092d8e7936f0549571a803b203aaced', // Binance
    '0x0681d8db095565fe8a346fa0277bffde9c0edbbf', // Binance
    '0xfe9e8709d3215310075d67e3ed32a380ccf00d8f', // Binance
    '0x4e5b2e1dc63f6b91cb6cd759936495434c7e972f', // Binance
    '0x876eabf441b2ee5b5b0554fd502a8e0600950cfa', // Binance
    '0xbe0eb53f46cd790cd13851d5eff43d12404d33e8', // Binance
    '0xf977814e90da44bfa03b6295a0616a897441acec', // Binance
    '0x001866ae5b3de6caa5a51543fd9fb64f524f5478', // Binance
    '0xab83d182f3485cf1e6cc9d2b3b2c4b8b8b8b8b8b', // Binance
    '0x21a31ee1afc51d94c2efccaa2092ad1028285549', // Binance
    '0x28c6c06298d514db089934071355e5743bf21d60', // Binance
    '0x3f5ce5fbfe3e9af3971dd833d26ba9b5c936f0be', // Binance
    '0xd551234ae421e3bcba99a0da6d736074f22192ff', // Binance
    '0x564286362092d8e7936f0549571a803b203aaced', // Binance
    '0x0681d8db095565fe8a346fa0277bffde9c0edbbf', // Binance
    '0xfe9e8709d3215310075d67e3ed32a380ccf00d8f', // Binance
    '0x4e5b2e1dc63f6b91cb6cd759936495434c7e972f', // Binance
    '0x876eabf441b2ee5b5b0554fd502a8e0600950cfa', // Binance
    '0xbe0eb53f46cd790cd13851d5eff43d12404d33e8', // Binance
    '0xf977814e90da44bfa03b6295a0616a897441acec', // Binance
    '0x001866ae5b3de6caa5a51543fd9fb64f524f5478', // Binance
    '0xab83d182f3485cf1e6cc9d2b3b2c4b8b8b8b8b8b', // Binance
  ],
  BRIDGES: [
    '0x8315177ab297ba92a06054ce80a67ed4dbd7ed3a', // Arbitrum Bridge
    '0x3154cf16ccdb4c6d922629664174b904d80f2c35', // Optimism Bridge
    '0x40ec5b33f54e0e8a33a975908c5ba1c14e5bbbdf', // Polygon Bridge
  ],
  // Add more known endpoints
  KNOWN_ENDPOINTS: [
    // Major exchanges
    '0x21a31ee1afc51d94c2efccaa2092ad1028285549', // Binance
    '0x28c6c06298d514db089934071355e5743bf21d60', // Binance
    '0x3f5ce5fbfe3e9af3971dd833d26ba9b5c936f0be', // Binance
    // DeFi protocols
    '0x7a250d5630b4cf539739df2c5dacb4c659f2488d', // Uniswap V2 Router
    '0xe592427a0aece92de3edee1f18e0157c05861564', // Uniswap V3 Router
    // Mixers
    '0x722122df12d4e14e13ac3b6895a86e84145b6967', // Tornado Cash
    '0xdd4c48c0b24039969fc16d1cdf626eab821d3384', // Tornado Cash
  ]
};

// API response cache
const apiCache = new Map<string, { data: any; timestamp: number }>();

/**
 * Get cached API response or fetch new data
 */
async function getCachedOrFetch<T>(
  cacheKey: string,
  fetchFunction: () => Promise<T>,
  cacheDuration: number = CONFIG.API_OPTIMIZATION.CACHE_DURATION_MS
): Promise<T> {
  if (!CONFIG.API_OPTIMIZATION.ENABLE_CACHING) {
    return fetchFunction();
  }

  const now = Date.now();
  const cached = apiCache.get(cacheKey);
  
  if (cached && (now - cached.timestamp) < cacheDuration) {
    console.log(`📋 Using cached data for: ${cacheKey}`);
    return cached.data;
  }

  console.log(`🌐 Fetching fresh data for: ${cacheKey}`);
  const data = await fetchFunction();
  
  apiCache.set(cacheKey, { data, timestamp: now });
  return data;
}

/**
 * Clear old cache entries
 */
function cleanupCache() {
  const now = Date.now();
  const maxAge = CONFIG.API_OPTIMIZATION.CACHE_DURATION_MS;
  
  for (const [key, value] of apiCache.entries()) {
    if (now - value.timestamp > maxAge) {
      apiCache.delete(key);
    }
  }
  
  console.log(`🧹 Cache cleanup: ${apiCache.size} entries remaining`);
}

// Round number values for pattern detection
const ROUND_NUMBERS = [1, 5, 10, 50, 100, 500, 1000];

export interface RiskAssessment {
  address: string;
  risk_score: number;
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH';
  contributing_factors: Array<{
    factor: string;
    score: number;
    details: string;
  }>;
  last_updated: string;
}

export interface PatternDetection {
  peel_chain: boolean;
  peel_chain_strength: number;
  round_number_frequency: number;
  rapid_turnover: boolean;
  coordinated_movements: boolean;
  cluster_id?: string;
  cluster_confidence?: number;
}

export interface TransactionSelection {
  transaction: any;
  confidence_score: number;
  reasoning_flags: string[];
  percentage_of_total: number;
}

export interface EnhancedFlowAnalysis {
  flow_analysis: {
    total_depth_reached: number;
    total_addresses_analyzed: number;
    total_value_traced: string;
    high_confidence_paths: number;
    cross_chain_exits: number;
    endpoints_detected: number;
    endpoint_types: string[];
  };
  risk_assessment: {
    high_risk_addresses: Array<{
      address: string;
      risk_score: number;
      patterns: string[];
      total_funds: string;
    }>;
  };
  forensic_evidence: {
    chain_of_custody: any[];
    confidence_scores: any[];
    pattern_matches: any[];
    cross_references: any[];
  };
  endpoints: Array<{
    address: string;
    type: string;
    confidence: number;
    reasoning: string[];
    incoming_value: number;
    incoming_transaction: string;
  }>;
}

/**
 * 2.1 Adaptive Branching Strategy Module
 * Replace fixed "top 3" transaction selection with intelligent, context-aware branching
 */
export function adaptiveBranchingStrategy(
  transactions: any[],
  totalOutflow: number,
  suspiciousAddresses: Set<string> = new Set(),
  depth: number = 0,
  deterministicRandom?: () => number
): TransactionSelection[] {
  console.log(`Adaptive branching called with ${transactions.length} transactions, totalOutflow: ${totalOutflow}, depth: ${depth}`);
  if (!transactions || transactions.length === 0) {
    return [];
  }

  // Filter out dust transactions first
  const nonDustTransactions = transactions.filter(tx => {
    const value = Number(tx.value) / 1e18;
    return value >= CONFIG.BRANCHING.MIN_VALUE_THRESHOLD;
  });
  
  console.log(`Filtered out dust transactions: ${transactions.length - nonDustTransactions.length} removed, ${nonDustTransactions.length} remaining`);

  if (nonDustTransactions.length === 0) {
    console.log('No non-dust transactions found, returning empty selection');
    return [];
  }

  // Calculate transaction percentages and apply suspicious behavior multipliers
  const scoredTransactions = nonDustTransactions.map(tx => {
    const value = Number(tx.value) / 1e18;
    const percentage = totalOutflow > 0 ? value / totalOutflow : 0;
    
    // Apply suspicious behavior multipliers
    let multiplier = 1.0;
    const flags: string[] = [];
    
    if (suspiciousAddresses.has(tx.to?.toLowerCase())) {
      multiplier *= 2.0;
      flags.push('suspicious_destination');
    }
    
    if (percentage > 0.5) {
      multiplier *= 1.5;
      flags.push('high_value');
    }
    
    if (isRoundNumber(value)) {
      multiplier *= 1.3;
      flags.push('round_number');
    }
    
    // Add depth-based scoring (deeper transactions get lower scores)
    const depthMultiplier = Math.max(0.5, 1.0 - (depth * 0.1));
    multiplier *= depthMultiplier;
    
    const adjustedScore = percentage * multiplier;
    
    return {
      transaction: tx,
      confidence_score: Math.min(adjustedScore * 10, 1.0), // Scale to 0-1
      reasoning_flags: flags,
      percentage_of_total: percentage,
      adjusted_score: adjustedScore,
      value: value,
      // Add deterministic tie-breaker
      tie_breaker: deterministicRandom ? deterministicRandom() : 0
    };
  });

  // Filter out transactions below minimum threshold
  const filtered = scoredTransactions.filter(t => 
    t.percentage_of_total >= CONFIG.BRANCHING.MIN_TRANSACTION_THRESHOLD
  );
  
  console.log(`After filtering: ${filtered.length} transactions above ${CONFIG.BRANCHING.MIN_TRANSACTION_THRESHOLD} threshold`);
  
  // If no transactions meet the percentage threshold, use value-based selection
  let selected: TransactionSelection[] = [];
  
  if (filtered.length === 0) {
    console.log('No transactions meet percentage threshold, using value-based selection');
    // Sort by value and take top transactions
    const valueSorted = scoredTransactions.sort((a, b) => {
      if (Math.abs(b.value - a.value) < 1e-10) {
        // Use tie-breaker for very close values
        return (a.tie_breaker || 0) - (b.tie_breaker || 0);
      }
      return b.value - a.value;
    });
    const maxAddresses = CONFIG.BRANCHING.DEPTH_LIMITS[depth] || CONFIG.BRANCHING.DEPTH_LIMITS[5];
    
    selected = valueSorted.slice(0, Math.min(maxAddresses, valueSorted.length)).map(t => ({
      transaction: t.transaction,
      confidence_score: t.confidence_score,
      reasoning_flags: [...t.reasoning_flags, 'value_based_selection'],
      percentage_of_total: t.percentage_of_total
    }));
  } else {
    // Sort by adjusted score
    filtered.sort((a, b) => {
      if (Math.abs(b.adjusted_score - a.adjusted_score) < 1e-10) {
        // Use tie-breaker for very close scores
        return (a.tie_breaker || 0) - (b.tie_breaker || 0);
      }
      return b.adjusted_score - a.adjusted_score;
    });

    // Select transactions to achieve 80% coverage or up to depth-based limit
    let cumulativeCoverage = 0;
    const maxAddresses = CONFIG.BRANCHING.DEPTH_LIMITS[depth] || CONFIG.BRANCHING.DEPTH_LIMITS[5];
    
    for (const tx of filtered) {
      if (selected.length >= maxAddresses) break;
      if (cumulativeCoverage >= CONFIG.BRANCHING.FUND_COVERAGE_TARGET) break;
      
      selected.push({
        transaction: tx.transaction,
        confidence_score: tx.confidence_score,
        reasoning_flags: tx.reasoning_flags,
        percentage_of_total: tx.percentage_of_total
      });
      
      cumulativeCoverage += tx.percentage_of_total;
    }
  }

  console.log(`Selected ${selected.length} transactions for depth ${depth} (max allowed: ${CONFIG.BRANCHING.DEPTH_LIMITS[depth] || CONFIG.BRANCHING.DEPTH_LIMITS[5]})`);
  return selected;
}

/**
 * 2.2 Address Risk Assessment Module
 * Generate risk scores for addresses based on behavioral patterns
 */
export function assessAddressRisk(
  address: string,
  transactions: any[],
  allTransactions: any[] = []
): RiskAssessment {
  let riskScore = 0;
  const contributingFactors: Array<{factor: string, score: number, details: string}> = [];

  // Mixer interactions
  const mixerInteractions = transactions.filter(tx => 
    KNOWN_ADDRESSES.MIXERS.includes(tx.to?.toLowerCase()) ||
    KNOWN_ADDRESSES.MIXERS.includes(tx.from?.toLowerCase())
  ).length;
  
  if (mixerInteractions > 0) {
    const mixerScore = mixerInteractions * 100 * CONFIG.RISK_ASSESSMENT.MIXER_INTERACTION_WEIGHT;
    riskScore += mixerScore;
    contributingFactors.push({
      factor: 'mixer_interactions',
      score: mixerScore,
      details: `${mixerInteractions} transactions to/from mixing services`
    });
  }

  // Exchange activity
  const exchangeInteractions = transactions.filter(tx => 
    KNOWN_ADDRESSES.EXCHANGES.includes(tx.to?.toLowerCase()) ||
    KNOWN_ADDRESSES.EXCHANGES.includes(tx.from?.toLowerCase())
  ).length;
  
  if (exchangeInteractions > 0) {
    const exchangeScore = exchangeInteractions * 50 * CONFIG.RISK_ASSESSMENT.EXCHANGE_INTERACTION_WEIGHT;
    riskScore += exchangeScore;
    contributingFactors.push({
      factor: 'exchange_activity',
      score: exchangeScore,
      details: `${exchangeInteractions} transactions with exchanges`
    });
  }

  // Round number frequency
  const roundNumberTxs = transactions.filter(tx => 
    isRoundNumber(Number(tx.value) / 1e18)
  ).length;
  
  const roundNumberFrequency = transactions.length > 0 ? roundNumberTxs / transactions.length : 0;
  
  if (roundNumberFrequency > CONFIG.PATTERN_DETECTION.ROUND_NUMBER_FREQUENCY_THRESHOLD) {
    const roundScore = roundNumberFrequency * 200 * CONFIG.RISK_ASSESSMENT.PATTERN_DETECTION_WEIGHT;
    riskScore += roundScore;
    contributingFactors.push({
      factor: 'round_number_frequency',
      score: roundScore,
      details: `${(roundNumberFrequency * 100).toFixed(1)}% of transactions use round numbers`
    });
  }

  // Rapid turnover detection
  const rapidTurnoverTxs = transactions.filter(tx => {
    if (!tx.timeStamp) return false;
    const txTime = Number(tx.timeStamp);
    const nextTx = transactions.find(t => 
      t.timeStamp && Number(t.timeStamp) > txTime && 
      Number(t.timeStamp) - txTime <= CONFIG.PATTERN_DETECTION.RAPID_TURNOVER_THRESHOLD
    );
    return !!nextTx;
  }).length;
  
  if (rapidTurnoverTxs > 0) {
    const turnoverScore = rapidTurnoverTxs * 75;
    riskScore += turnoverScore;
    contributingFactors.push({
      factor: 'rapid_turnover',
      score: turnoverScore,
      details: `${rapidTurnoverTxs} transactions moved within 1 hour`
    });
  }

  // Determine risk level
  let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  if (riskScore < 300) {
    riskLevel = 'LOW';
  } else if (riskScore < 700) {
    riskLevel = 'MEDIUM';
  } else {
    riskLevel = 'HIGH';
  }

  return {
    address,
    risk_score: Math.min(riskScore, 1000),
    risk_level: riskLevel,
    contributing_factors: contributingFactors,
    last_updated: new Date().toISOString()
  };
}

/**
 * 2.3 Pattern Detection Module
 * Identify common money laundering patterns automatically
 */
export function detectPatterns(transactions: any[]): PatternDetection {
  const result: PatternDetection = {
    peel_chain: false,
    peel_chain_strength: 0,
    round_number_frequency: 0,
    rapid_turnover: false,
    coordinated_movements: false
  };

  if (!transactions || transactions.length === 0) {
    return result;
  }

  // Peel chain detection
  const totalInput = transactions.reduce((sum, tx) => sum + Number(tx.value || 0), 0);
  const avgOutput = totalInput / transactions.length;
  
  if (totalInput > avgOutput * 10 && transactions.length >= 3) {
    const similarOutputs = transactions.filter(tx => {
      const value = Number(tx.value || 0);
      const similarity = Math.abs(value - avgOutput) / avgOutput;
      return similarity <= CONFIG.PATTERN_DETECTION.PEEL_CHAIN_SIMILARITY_THRESHOLD;
    }).length;
    
    const similarityRatio = similarOutputs / transactions.length;
    if (similarityRatio >= 0.7) {
      result.peel_chain = true;
      result.peel_chain_strength = similarityRatio;
    }
  }

  // Round number analysis
  const roundNumberTxs = transactions.filter(tx => 
    isRoundNumber(Number(tx.value) / 1e18)
  ).length;
  result.round_number_frequency = transactions.length > 0 ? roundNumberTxs / transactions.length : 0;

  // Rapid turnover detection
  const sortedTxs = transactions.sort((a, b) => Number(a.timeStamp) - Number(b.timeStamp));
  const rapidTxs = sortedTxs.filter((tx, index) => {
    if (index === 0) return false;
    const timeDiff = Number(tx.timeStamp) - Number(sortedTxs[index - 1].timeStamp);
    return timeDiff <= CONFIG.PATTERN_DETECTION.RAPID_TURNOVER_THRESHOLD;
  });
  result.rapid_turnover = rapidTxs.length > 0;

  return result;
}

/**
 * 2.4 Cross-Chain Tracking Module
 * Detect and track funds moving to other blockchain networks
 */
export function detectCrossChainActivity(transactions: any[]): any[] {
  const bridgeTransactions = transactions.filter(tx => 
    KNOWN_ADDRESSES.BRIDGES.includes(tx.to?.toLowerCase())
  );

  return bridgeTransactions.map(tx => ({
    transaction: tx,
    bridge_type: getBridgeType(tx.to),
    potential_destination_chains: getPotentialDestinationChains(tx.to),
    confidence_score: 0.8 // High confidence for known bridge addresses
  }));
}

/**
 * 2.5 Enhanced Data Integration Module
 * Integrate multiple data sources for comprehensive analysis
 */
export function labelAddress(address: string): {category: string, confidence: 'CONFIRMED' | 'LIKELY' | 'POSSIBLE'} {
  const addr = address.toLowerCase();
  
  if (KNOWN_ADDRESSES.MIXERS.includes(addr)) {
    return { category: 'MIXER', confidence: 'CONFIRMED' };
  }
  
  if (KNOWN_ADDRESSES.EXCHANGES.includes(addr)) {
    return { category: 'EXCHANGE', confidence: 'CONFIRMED' };
  }
  
  if (KNOWN_ADDRESSES.BRIDGES.includes(addr)) {
    return { category: 'BRIDGE', confidence: 'CONFIRMED' };
  }
  
  return { category: 'UNKNOWN', confidence: 'POSSIBLE' };
}

// Helper functions
function isRoundNumber(value: number): boolean {
  return ROUND_NUMBERS.some(round => Math.abs(value - round) < 0.01);
}

function getBridgeType(address: string): string {
  const addr = address.toLowerCase();
  if (addr.includes('arbitrum')) return 'Arbitrum';
  if (addr.includes('optimism')) return 'Optimism';
  if (addr.includes('polygon')) return 'Polygon';
  return 'Unknown';
}

function getPotentialDestinationChains(address: string): string[] {
  const bridgeType = getBridgeType(address);
  switch (bridgeType) {
    case 'Arbitrum': return ['arbitrum'];
    case 'Optimism': return ['optimism'];
    case 'Polygon': return ['polygon'];
    default: return [];
  }
}

/**
 * Main enhanced flow analysis function
 * Combines all modules for comprehensive fund tracking
 */
export async function enhancedFlowAnalysis(
  address: string,
  chain: string,
  maxDepth: number,
  startblock: number,
  mainLossTx?: any
): Promise<EnhancedFlowAnalysis> {
  // Create a deterministic seed based on the transaction hash
  const seed = mainLossTx?.hash || address;
  const seedHash = seed.split('').reduce((a, b) => {
    a = ((a << 5) - a) + b.charCodeAt(0);
    return a & a;
  }, 0);
  
  // Simple deterministic random function
  let seedValue = seedHash;
  const deterministicRandom = () => {
    seedValue = (seedValue * 9301 + 49297) % 233280;
    return seedValue / 233280;
  };
  
  console.log(`🔧 Using deterministic seed: ${seed} (hash: ${seedHash})`);
  
  // Import etherscan functions dynamically to ensure environment variables are loaded
  // 🔄 FIXED: Use the corrected Etherscan functions with DESC sorting and pagination support
  const etherscanModule = await import('./etherscan-fixed');
  const { 
    getEvmTransactions, 
    getEvmInternalTransactions, 
    getEvmERC20Transfers,
    getEvmTransactionsWithPagination,
    getEvmInternalTransactionsWithPagination,
    getEvmERC20TransfersWithPagination,
    validateForwardMapping
  } = etherscanModule;
  
  // Map chain names to chain IDs
  const CHAIN_IDS: Record<string, number> = { ethereum: 1, avalanche: 43114 };
  const chainId = CHAIN_IDS[chain] || 1;
  
  const nodes: any[] = [];
  const links: any[] = [];
  const nodeMap = new Map<string, number>();
  const riskAssessments: RiskAssessment[] = [];
  const patternDetections: PatternDetection[] = [];
  const crossChainActivities: any[] = [];
  const endpoints: any[] = []; // New array to store detected endpoints
  
  // Start with the victim address
  nodes.push({ name: address });
  nodeMap.set(address, 0);
  
  let currentAddresses = [address];
  let prevTxs = [mainLossTx || null];
  let totalAddressesAnalyzed = 0;
  let totalValueTraced = 0;
  let highConfidencePaths = 0;
  let crossChainExits = 0;
  let depth = 0;
  
  // If we have a main loss transaction, also add the destination address to track
  if (mainLossTx && mainLossTx.to) {
    const destinationAddress = mainLossTx.to;
    if (!nodeMap.has(destinationAddress)) {
      nodes.push({ name: destinationAddress });
      nodeMap.set(destinationAddress, nodes.length - 1);
    }
    // Add the initial transaction to the chain of custody
    if (Number(mainLossTx.value) > 0) {
      const initialLossValue = Number(mainLossTx.value) / 1e18;
      links.push({
        source: address,
        target: destinationAddress,
        value: initialLossValue,
        confidence_score: 1.0,
        reasoning_flags: ['initial_loss']
      });
      // Only count the initial loss, not subsequent movements
      totalValueTraced = initialLossValue; // Set to initial loss, don't add
      highConfidencePaths++; // Initial loss is high confidence
      console.log(`💰 Initial loss set to: ${initialLossValue} ETH`);
    }
    
    // Start tracking from the destination address (where the funds went)
    currentAddresses = [destinationAddress];
    prevTxs = [mainLossTx];
    totalAddressesAnalyzed = 1; // We've already analyzed the victim address
  }
  
  // Track cumulative values for each endpoint to ensure conservation of value
  const endpointValues = new Map<string, number>();
  const endpointTransactions = new Map<string, string[]>();
  
  // Calculate initial loss value for validation
  const initialLossValue = mainLossTx?.value ? Number(mainLossTx.value) / 1e18 : 0;
  console.log(`💰 Main loss value: ${initialLossValue} ETH - will validate all endpoint values against this`);
  
  for (depth = 0; depth < maxDepth; depth++) {
    console.log(`\n=== Processing depth ${depth} ===`);
    console.log(`Current addresses to process: ${currentAddresses.length}`, currentAddresses);
    
    // Early termination check
    if (currentAddresses.length === 0) {
      console.log(`No addresses to process at depth ${depth}, stopping analysis`);
      break;
    }
    
    // Check if we've reached the maximum addresses for this depth
    const maxAddressesForDepth = CONFIG.BRANCHING.DEPTH_LIMITS[depth] || CONFIG.BRANCHING.DEPTH_LIMITS[5];
    if (currentAddresses.length > maxAddressesForDepth) {
      console.log(`Limiting addresses at depth ${depth} from ${currentAddresses.length} to ${maxAddressesForDepth}`);
      currentAddresses = currentAddresses.slice(0, maxAddressesForDepth);
      prevTxs = prevTxs.slice(0, maxAddressesForDepth);
    }
    
    const newAddresses: string[] = [];
    const newPrevTxs: any[] = [];
    let depthConfidence = 0;
    let processedAddresses = 0;
    
    for (let pathIndex = 0; pathIndex < currentAddresses.length; pathIndex++) {
      const currentAddress = currentAddresses[pathIndex];
      const prevTx = prevTxs[pathIndex];
      
      // Skip if confidence is too low (with deterministic threshold)
      const confidenceThreshold = CONFIG.BRANCHING.MIN_CONFIDENCE_THRESHOLD;
      if (depthConfidence > 0 && depthConfidence < confidenceThreshold) {
        console.log(`Skipping ${currentAddress} due to low confidence: ${depthConfidence} (threshold: ${confidenceThreshold})`);
        continue;
      }
      
      processedAddresses++;
      console.log(`Processing address ${processedAddresses}/${currentAddresses.length}: ${currentAddress}`);
      
      // 🎯 OPTIMIZATION: Calculate hack block for API calls once
      const hackBlockForApi = mainLossTx?.blockNumber ? Number(mainLossTx.blockNumber) : startblock;
      
      // Fetch all transaction types
      let allTxs: any[] = [];
      try {
        // Progressive startblock: Each transaction should only search from blocks after the previous transaction
        let effectiveStartblock = startblock; // Start with incident's block number
        
        if (prevTx && (prevTx.blockNumber || prevTx.timeStamp)) {
          // If we have a previous transaction, start from the block AFTER it
          if (prevTx.blockNumber) {
            effectiveStartblock = Math.max(effectiveStartblock, Number(prevTx.blockNumber) + 1);
          } else if (prevTx.timeStamp) {
            // If no block number, we can't determine exact block, so use incident block as fallback
            effectiveStartblock = Math.max(effectiveStartblock, 0);
          }
        }
        
        // 🎯 OPTIMIZATION: Use hack block directly in API calls for efficiency
        // This ensures we only fetch post-hack transactions from the API
        const apiStartblock = Math.max(effectiveStartblock, hackBlockForApi);
        
        console.log(`Fetching transactions for ${currentAddress} at depth ${depth}, API startblock: ${apiStartblock} (hack block: ${hackBlockForApi}, effective: ${effectiveStartblock}, prevTx block: ${prevTx?.blockNumber || 'N/A'})`);
        
        // Use caching for API calls with hack block filtering
        const cacheKey = `tx_${currentAddress}_${chainId}_${apiStartblock}`;
        
        // 🔄 FIXED: Use pagination for comprehensive transaction fetching
        // This ensures we get ALL transactions, not just the first 10,000
        const [normal, internal, erc20] = await Promise.all([
          getCachedOrFetch(
            `${cacheKey}_normal`,
            () => getEvmTransactionsWithPagination(currentAddress, chainId, apiStartblock)
          ),
          getCachedOrFetch(
            `${cacheKey}_internal`,
            () => getEvmInternalTransactionsWithPagination(currentAddress, chainId, apiStartblock)
          ),
          getCachedOrFetch(
            `${cacheKey}_erc20`,
            () => getEvmERC20TransfersWithPagination(currentAddress, chainId, apiStartblock)
          )
        ]);
        
        allTxs = [...(normal || []), ...(internal || []), ...(erc20 || [])];
        console.log(`Found ${allTxs.length} total transactions for ${currentAddress} (depth ${depth}):`, {
          normal: normal?.length || 0,
          internal: internal?.length || 0,
          erc20: erc20?.length || 0
        });
        
        // 🔄 NEW: Validate forward mapping to ensure proper block number progression
        // This ensures blockNumber(Tx N) >= blockNumber(Tx N+1) for proper fund flow tracking
        allTxs = validateForwardMapping(allTxs, prevTx);
        
        // Log first few transactions for debugging
        if (allTxs.length > 0) {
          console.log('Sample transactions:', allTxs.slice(0, 3).map(tx => ({
            from: tx.from,
            to: tx.to,
            value: tx.value,
            hash: tx.hash?.substring(0, 10) + '...',
            blockNumber: tx.blockNumber
          })));
        }
      } catch (e) { 
        console.error('Error fetching transactions for', currentAddress, ':', e);
        allTxs = []; 
      }
      
      // Filter for outgoing transactions from the current address
      console.log(`Sample transaction structure:`, allTxs.length > 0 ? {
        from: allTxs[0].from,
        to: allTxs[0].to,
        value: allTxs[0].value,
        hash: allTxs[0].hash?.substring(0, 10) + '...'
      } : 'No transactions');
      
      let filteredTxs = allTxs.filter((tx: any) => {
        // For normal transactions, check if 'from' matches current address
        if (tx.from && tx.from.toLowerCase() === currentAddress.toLowerCase()) {
          return true;
        }
        // For internal transactions, check if 'from' matches current address
        if (tx.from && tx.from.toLowerCase() === currentAddress.toLowerCase()) {
          return true;
        }
        // For ERC20 transactions, check if 'from' matches current address
        if (tx.from && tx.from.toLowerCase() === currentAddress.toLowerCase()) {
          return true;
        }
        return false;
      });
      
      console.log(`Filtered to ${filteredTxs.length} outgoing transactions for ${currentAddress} (depth ${depth})`);
      
      // ✅ OPTIMIZATION: Since we're using hack block in API calls, we don't need application-level filtering
      // All transactions returned by the API are already post-hack
      console.log(`✅ API already filtered by hack block (${hackBlockForApi}), no need for application-level filtering`);
      
      if (filteredTxs.length === 0) continue;
      
      // Calculate total outflow for this address
      const totalOutflow = filteredTxs.reduce((sum, tx) => sum + Number(tx.value || 0), 0);
      console.log(`Total outflow for ${currentAddress}: ${totalOutflow} wei (${totalOutflow / 1e18} ETH)`);
      console.log(`Transaction values:`, filteredTxs.map(tx => ({
        value: tx.value,
        valueNumber: Number(tx.value),
        valueEth: Number(tx.value) / 1e18
      })));
      
      // Apply adaptive branching strategy
      const selectedTxs = adaptiveBranchingStrategy(filteredTxs, totalOutflow, new Set(currentAddresses), depth, deterministicRandom);
      console.log(`Selected ${selectedTxs.length} transactions for ${currentAddress} at depth ${depth}`);
      
      // Assess risk for current address
      const riskAssessment = assessAddressRisk(currentAddress, filteredTxs);
      riskAssessments.push(riskAssessment);
      
      // Detect patterns
      const patternDetection = detectPatterns(filteredTxs);
      patternDetections.push(patternDetection);
      
      // Detect cross-chain activity
      const crossChainActivity = detectCrossChainActivity(filteredTxs);
      crossChainActivities.push(...crossChainActivity);
      
      totalAddressesAnalyzed++;
      
      // Add transactions to graph
      console.log(`Processing ${selectedTxs.length} selected transactions for ${currentAddress}`);
      for (const selection of selectedTxs) {
        const tx = selection.transaction;
        if (!tx || !tx.to) {
          console.log(`Skipping transaction without 'to' field:`, tx);
          continue;
        }
        
        let toIdx = nodeMap.get(tx.to);
        if (toIdx === undefined) {
          toIdx = nodes.length;
          nodes.push({ 
            name: tx.to,
            risk_score: 0, // Will be updated when we process this address
            confidence_score: selection.confidence_score
          });
          nodeMap.set(tx.to, toIdx);
        }
        
        const fromIdx = nodeMap.get(currentAddress);
        if (fromIdx !== undefined && fromIdx !== toIdx && Number(tx.value) > 0) {
          const txValue = Number(tx.value) / 1e18;
          
          // Validate transaction value - skip unrealistic values
          const MAX_REASONABLE_VALUE = 1000000; // 1 million ETH max
          if (txValue > MAX_REASONABLE_VALUE) {
            console.log(`⚠️ Skipping transaction with unrealistic value: ${txValue} ETH (tx: ${tx.hash})`);
            continue;
          }
          
          links.push({ 
            source: currentAddress, // Use actual address instead of index
            target: tx.to, // Use actual address instead of index
            value: txValue,
            confidence_score: selection.confidence_score,
            reasoning_flags: selection.reasoning_flags
          });
          
          // Don't add to totalValueTraced - we only count the initial loss
          // totalValueTraced += txValue; // REMOVED: This was causing double-counting
          
          if (selection.confidence_score > 0.7) {
            highConfidencePaths++;
          }
          
          // Add to next layer addresses
          if (!newAddresses.includes(tx.to)) {
            // Calculate effective startblock for endpoint detection
            let endpointStartblock = startblock;
            if (prevTx && (prevTx.blockNumber || prevTx.timeStamp)) {
              if (prevTx.blockNumber) {
                endpointStartblock = Math.max(endpointStartblock, Number(prevTx.blockNumber) + 1);
              } else if (prevTx.timeStamp) {
                endpointStartblock = Math.max(endpointStartblock, 0);
              }
            }
            
            // 🎯 OPTIMIZATION: Use hack block for endpoint detection API calls
            const hackBlockForEndpoint = mainLossTx?.blockNumber ? Number(mainLossTx.blockNumber) : startblock;
            const endpointApiStartblock = Math.max(endpointStartblock, hackBlockForEndpoint);
            
            // Check if this is a true endpoint before adding to next layer
            const endpointDetection = await detectEndpoint(tx.to, chainId, endpointApiStartblock, etherscanModule);
            
            if (endpointDetection.isEndpoint) {
              console.log(`🔴 ENDPOINT DETECTED: ${tx.to} (${endpointDetection.endpointType}) - Confidence: ${endpointDetection.confidence}`);
              console.log(`   Reasoning: ${endpointDetection.reasoning.join(', ')}`);
              
              // Add to endpoints list instead of next layer
              if (!endpoints.includes(tx.to)) {
                const txValue = Number(tx.value) / 1e18;
                
                // Track cumulative value for this endpoint
                const currentValue = endpointValues.get(tx.to) || 0;
                const newTotalValue = currentValue + txValue;
                
                // Validate against main loss - endpoint should never receive more than initial loss
                if (newTotalValue > initialLossValue) {
                  console.log(`⚠️ SKIPPING: Endpoint ${tx.to} would receive ${newTotalValue} ETH > main loss ${initialLossValue} ETH (violates conservation of value)`);
                  continue;
                }
                
                // Validate individual transaction value
                const MAX_REASONABLE_VALUE = 1000000; // 1 million ETH max
                if (txValue > MAX_REASONABLE_VALUE) {
                  console.log(`⚠️ Skipping endpoint with unrealistic transaction value: ${txValue} ETH (address: ${tx.to})`);
                  continue;
                }
                
                // Update tracking maps
                endpointValues.set(tx.to, newTotalValue);
                const existingTxs = endpointTransactions.get(tx.to) || [];
                existingTxs.push(tx.hash);
                endpointTransactions.set(tx.to, existingTxs);
                
                console.log(`✅ Endpoint ${tx.to} cumulative value: ${newTotalValue} ETH (tx: ${txValue} ETH)`);
                
                endpoints.push({
                  address: tx.to,
                  type: endpointDetection.endpointType,
                  confidence: endpointDetection.confidence,
                  reasoning: endpointDetection.reasoning,
                  incomingValue: newTotalValue, // Use cumulative value
                  incomingTransaction: tx.hash // Use the latest transaction
                });
              } else {
                // Endpoint already exists, update cumulative value
                const txValue = Number(tx.value) / 1e18;
                const currentValue = endpointValues.get(tx.to) || 0;
                const newTotalValue = currentValue + txValue;
                
                // Validate against main loss
                if (newTotalValue > initialLossValue) {
                  console.log(`⚠️ SKIPPING: Endpoint ${tx.to} would receive ${newTotalValue} ETH > main loss ${initialLossValue} ETH (violates conservation of value)`);
                  continue;
                }
                
                // Update tracking maps
                endpointValues.set(tx.to, newTotalValue);
                const existingTxs = endpointTransactions.get(tx.to) || [];
                existingTxs.push(tx.hash);
                endpointTransactions.set(tx.to, existingTxs);
                
                // Update the existing endpoint entry
                const existingEndpoint = endpoints.find(e => e.address === tx.to);
                if (existingEndpoint) {
                  existingEndpoint.incomingValue = newTotalValue;
                  existingEndpoint.incomingTransaction = tx.hash; // Update to latest transaction
                }
                
                console.log(`✅ Updated endpoint ${tx.to} cumulative value: ${newTotalValue} ETH (tx: ${txValue} ETH)`);
              }
            } else {
              // Limit the number of new addresses based on depth
              const maxNewAddresses = CONFIG.BRANCHING.DEPTH_LIMITS[depth + 1] || CONFIG.BRANCHING.DEPTH_LIMITS[5];
              if (newAddresses.length < maxNewAddresses) {
                newAddresses.push(tx.to);
                newPrevTxs.push(tx);
                console.log(`Added ${tx.to} to next layer (${newAddresses.length}/${maxNewAddresses})`);
              } else {
                console.log(`Skipping ${tx.to} - reached max addresses for depth ${depth + 1}`);
              }
            }
          }
        }
      }
      
      // Update depth confidence based on selected transactions
      if (selectedTxs.length > 0) {
        const avgConfidence = selectedTxs.reduce((sum, tx) => sum + tx.confidence_score, 0) / selectedTxs.length;
        depthConfidence = Math.max(depthConfidence, avgConfidence);
      }
    }
    
    // Limit new addresses to prevent exponential growth
    const maxAddressesForNextDepth = CONFIG.BRANCHING.DEPTH_LIMITS[depth + 1] || CONFIG.BRANCHING.DEPTH_LIMITS[5];
    if (newAddresses.length > maxAddressesForNextDepth) {
      console.log(`Limiting new addresses for depth ${depth + 1} from ${newAddresses.length} to ${maxAddressesForNextDepth}`);
      newAddresses.splice(maxAddressesForNextDepth);
      newPrevTxs.splice(maxAddressesForNextDepth);
    }
    
    currentAddresses = newAddresses;
    prevTxs = newPrevTxs;
    
    console.log(`Depth ${depth} completed. New addresses found: ${newAddresses.length}`, newAddresses);
    console.log(`Depth confidence: ${depthConfidence.toFixed(3)}`);
    
    // Early termination if confidence is too low
    if (depthConfidence < CONFIG.BRANCHING.MIN_CONFIDENCE_THRESHOLD && depth > 1) {
      console.log(`Stopping analysis at depth ${depth} due to low confidence: ${depthConfidence}`);
      break;
    }
    
    if (currentAddresses.length === 0) {
      console.log(`No more addresses to process at depth ${depth}, stopping.`);
      break;
    }
  }
  
  // Final validation: ensure total endpoint values don't exceed main loss
  const totalEndpointValues = Array.from(endpointValues.values()).reduce((sum, value) => sum + value, 0);
  console.log(`💰 Final validation:`);
  console.log(`   - Main loss: ${initialLossValue} ETH`);
  console.log(`   - Total endpoint values: ${totalEndpointValues} ETH`);
  console.log(`   - Conservation check: ${totalEndpointValues <= initialLossValue ? '✅ PASSED' : '❌ FAILED'}`);
  
  if (totalEndpointValues > initialLossValue) {
    console.log(`⚠️ WARNING: Total endpoint values (${totalEndpointValues} ETH) exceed main loss (${initialLossValue} ETH)`);
    console.log(`   This violates conservation of value - some endpoints may be incorrectly identified`);
  }
  
  // Count cross-chain exits
  crossChainExits = crossChainActivities.length;
  
  // Update node risk scores
  for (const node of nodes) {
    const riskAssessment = riskAssessments.find(r => r.address.toLowerCase() === node.name.toLowerCase());
    if (riskAssessment) {
      node.risk_score = riskAssessment.risk_score;
      node.risk_level = riskAssessment.risk_level;
    }
  }
  
  // Compile high-risk addresses
  const highRiskAddresses = riskAssessments
    .filter(r => r.risk_level === 'HIGH')
    .map(r => ({
      address: r.address,
      risk_score: r.risk_score,
      patterns: patternDetections
        .filter(p => p.peel_chain || p.round_number_frequency > 0.3 || p.rapid_turnover)
        .map(p => {
          if (p.peel_chain) return 'peel_chain';
          if (p.round_number_frequency > 0.3) return 'round_numbers';
          if (p.rapid_turnover) return 'rapid_turnover';
          return '';
        })
        .filter(p => p !== ''),
      total_funds: '0' // Would need to calculate from transactions
    }));
  
  const enhancedFlowAnalysisResult: EnhancedFlowAnalysis = {
    flow_analysis: {
      total_depth_reached: Math.min(depth, maxDepth),
      total_addresses_analyzed: totalAddressesAnalyzed,
      total_value_traced: totalValueTraced.toFixed(2),
      high_confidence_paths: highConfidencePaths,
      cross_chain_exits: crossChainExits,
      endpoints_detected: endpoints.length,
      endpoint_types: [...new Set(endpoints.map(e => e.type))]
    },
    risk_assessment: {
      high_risk_addresses: highRiskAddresses
    },
    forensic_evidence: {
      chain_of_custody: links,
      confidence_scores: links.map(l => l.confidence_score),
      pattern_matches: patternDetections,
      cross_references: crossChainActivities
    },
    endpoints: endpoints.map(e => ({
      address: e.address,
      type: e.type,
      confidence: e.confidence,
      reasoning: e.reasoning,
      incoming_value: e.incomingValue,
      incoming_transaction: e.incomingTransaction
    }))
  };
  
  // Clean up cache after analysis
  cleanupCache();
  
  return enhancedFlowAnalysisResult;
} 

/**
 * Detect if an address is a true endpoint (where funds stop flowing)
 */
export async function detectEndpoint(
  address: string,
  chainId: number,
  startblock: number,
  etherscanModule: any
): Promise<{
  isEndpoint: boolean;
  endpointType: string;
  confidence: number;
  reasoning: string[];
}> {
  // 🔄 FIXED: Use the corrected Etherscan functions with DESC sorting and pagination
  const { 
    getEvmTransactionsWithPagination, 
    getEvmInternalTransactionsWithPagination, 
    getEvmERC20TransfersWithPagination 
  } = etherscanModule;
  
  try {
    // Check if it's a known endpoint
    const addressLower = address.toLowerCase();
    if (KNOWN_ADDRESSES.KNOWN_ENDPOINTS.includes(addressLower)) {
      return {
        isEndpoint: true,
        endpointType: 'known_endpoint',
        confidence: 0.95,
        reasoning: ['Address is in known endpoint database']
      };
    }
    
    if (KNOWN_ADDRESSES.EXCHANGES.includes(addressLower)) {
      return {
        isEndpoint: true,
        endpointType: 'exchange',
        confidence: 0.9,
        reasoning: ['Address is a known exchange']
      };
    }
    
    if (KNOWN_ADDRESSES.MIXERS.includes(addressLower)) {
      return {
        isEndpoint: true,
        endpointType: 'mixer',
        confidence: 0.85,
        reasoning: ['Address is a known mixer']
      };
    }
    
    if (KNOWN_ADDRESSES.BRIDGES.includes(addressLower)) {
      return {
        isEndpoint: true,
        endpointType: 'bridge',
        confidence: 0.8,
        reasoning: ['Address is a known bridge']
      };
    }
    
    // 🔄 FIXED: Use pagination for comprehensive endpoint detection
    // Check for outgoing transactions with pagination support
    const [normal, internal, erc20] = await Promise.all([
      getEvmTransactionsWithPagination(address, chainId, startblock),
      getEvmInternalTransactionsWithPagination(address, chainId, startblock),
      getEvmERC20TransfersWithPagination(address, chainId, startblock)
    ]);
    
    const allTxs = [...(normal || []), ...(internal || []), ...(erc20 || [])];
    const outgoingTxs = allTxs.filter((tx: any) => 
      tx.from && tx.from.toLowerCase() === addressLower
    );
    
    // If no outgoing transactions, it's likely an endpoint
    if (outgoingTxs.length === 0) {
      return {
        isEndpoint: true,
        endpointType: 'no_outgoing',
        confidence: 0.7,
        reasoning: ['No outgoing transactions found']
      };
    }
    
    // Check if all outgoing transactions are very small (dust)
    const significantOutgoing = outgoingTxs.filter((tx: any) => {
      const value = Number(tx.value) / 1e18;
      return value >= CONFIG.BRANCHING.MIN_VALUE_THRESHOLD;
    });
    
    if (significantOutgoing.length === 0 && outgoingTxs.length > 0) {
      return {
        isEndpoint: true,
        endpointType: 'dust_only',
        confidence: 0.6,
        reasoning: ['Only dust transactions outgoing']
      };
    }
    
    // Check if it's a contract (has code)
    // This would require additional API call to eth_getCode
    // For now, we'll assume it's not an endpoint if it has significant outgoing transactions
    
    return {
      isEndpoint: false,
      endpointType: 'active',
      confidence: 0.3,
      reasoning: [`Has ${significantOutgoing.length} significant outgoing transactions`]
    };
    
  } catch (error) {
    console.error('Error detecting endpoint for', address, ':', error);
    return {
      isEndpoint: false,
      endpointType: 'error',
      confidence: 0.0,
      reasoning: ['Error occurred during endpoint detection']
    };
  }
} 