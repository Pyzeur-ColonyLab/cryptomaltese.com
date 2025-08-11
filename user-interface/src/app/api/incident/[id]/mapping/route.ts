import { NextRequest, NextResponse } from 'next/server';
import pool from '@/db/client';
import { enhancedFlowAnalysis, EnhancedFlowAnalysis } from '@/services/enhanced-fund-tracker';

const CHAIN_IDS: Record<string, number> = {
  ethereum: 1,
  avalanche: 43114,
};

// Helper to get value in ETH or top ERC-20
function getMainLoss(txData: any, victim: string) {
  // ETH loss
  let ethLoss = 0;
  if (txData.info && txData.info.from && txData.info.from.toLowerCase() === victim.toLowerCase()) {
    ethLoss = Number(txData.info.valueEth || 0);
  }
  // ERC-20 loss
  let topToken = null;
  let topTokenLoss = 0;
  if (txData.erc20Transfers && Array.isArray(txData.erc20Transfers)) {
    for (const t of txData.erc20Transfers) {
      if (t.from && t.from.toLowerCase() === victim.toLowerCase()) {
        const val = Number(t.valueDecimal || 0);
        if (val > topTokenLoss) {
          topTokenLoss = val;
          topToken = t;
        }
      }
    }
  }
  if (topTokenLoss > ethLoss) {
    return { type: 'erc20', token: topToken, value: topTokenLoss };
  } else {
    return { type: 'eth', value: ethLoss };
  }
}

async function getEvmTransactionsAllTypes(address: string, chainId: number, startblock: number = 0) {
  const { getEvmTransactions } = await import('@/services/etherscan');
  // Normal transactions
  const normal = await getEvmTransactions(address, chainId, startblock);
  // Internal transactions
  let internal = [];
  try {
    const { getEvmInternalTransactions } = await import('@/services/etherscan');
    internal = await getEvmInternalTransactions(address, chainId, startblock);
  } catch (e) { internal = []; }
  // ERC20 transfers
  let erc20 = [];
  try {
    const { getEvmERC20Transfers } = await import('@/services/etherscan');
    erc20 = await getEvmERC20Transfers(address, chainId, startblock);
  } catch (e) { erc20 = []; }
  return { normal, internal, erc20 };
}

async function buildFlow(address: string, chain: string, maxDepth: number, type: 'normal' | 'internal' | 'erc20', startblock: number, mainLossTx?: any) {
  const CHAIN_IDS: Record<string, number> = { ethereum: 1, avalanche: 43114 };
  const chainId = CHAIN_IDS[chain];
  const nodes: any[] = [];
  const links: any[] = [];
  const nodeMap = new Map<string, number>();
  
  // Start with the victim address
  nodes.push({ name: address });
  nodeMap.set(address, 0);
  
  // Track current addresses for each path (top 3)
  let currentAddresses = [address];
  let prevTxs = [mainLossTx || null];
  
  for (let depth = 0; depth < maxDepth; depth++) {
    const newAddresses: string[] = [];
    const newPrevTxs: any[] = [];
    
    // Process each current address
    for (let pathIndex = 0; pathIndex < currentAddresses.length; pathIndex++) {
      const currentAddress = currentAddresses[pathIndex];
      const prevTx = prevTxs[pathIndex];
      
      let txs = [];
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
        
        console.log(`Fetching transactions for ${currentAddress} at depth ${depth}, startblock: ${effectiveStartblock} (prevTx block: ${prevTx?.blockNumber || 'N/A'})`);
        const all = await getEvmTransactionsAllTypes(currentAddress, chainId, effectiveStartblock);
        txs = all[type];
      } catch (e) { txs = []; }
      
      // For first layer, match by hash if available
      if (depth === 0 && mainLossTx && mainLossTx.hash) {
        const matchByHash = txs.find((tx: any) => tx.hash && tx.hash.toLowerCase() === mainLossTx.hash.toLowerCase());
        if (matchByHash) {
          txs = [matchByHash];
        } else {
          continue; // Skip this path if hash doesn't match
        }
      } else if (depth === 0 && (!mainLossTx || !mainLossTx.hash)) {
        continue; // Skip this path if no main loss transaction
      } else {
        // For subsequent layers, select the top 3 largest outgoing transactions after prevTx
        let filtered = txs;
        if (prevTx && (prevTx.blockNumber || prevTx.timeStamp)) {
          filtered = txs.filter((tx: any) => {
            if (tx.blockNumber && prevTx.blockNumber) {
              return Number(tx.blockNumber) > Number(prevTx.blockNumber);
            } else if (tx.timeStamp && prevTx.timeStamp) {
              return Number(tx.timeStamp) > Number(prevTx.timeStamp);
            }
            return true;
          });
        }
        
        if (filtered.length > 0) {
          // Sort by value and take top 3
          const sorted = filtered.sort((a, b) => {
            const aValue = Number(a.value) / 1e18;
            const bValue = Number(b.value) / 1e18;
            return bValue - aValue;
          });
          txs = sorted.slice(0, 3); // Take top 3
        } else {
          continue; // Skip this path if no transactions
        }
      }
      
      // Add transactions to graph
      for (const tx of txs) {
        if (!tx || !tx.to) continue;
        
        let toIdx = nodeMap.get(tx.to);
        if (toIdx === undefined) {
          toIdx = nodes.length;
          nodes.push({ name: tx.to });
          nodeMap.set(tx.to, toIdx);
        }
        
        const fromIdx = nodeMap.get(currentAddress);
        if (fromIdx !== undefined && fromIdx !== toIdx && Number(tx.value) > 0) {
          links.push({ 
            source: fromIdx, 
            target: toIdx, 
            value: Number(tx.value) / 1e18 
          });
          
          // Add to next layer addresses (avoid duplicates)
          if (!newAddresses.includes(tx.to)) {
            newAddresses.push(tx.to);
            newPrevTxs.push(tx);
          }
        }
      }
    }
    
    // Update for next iteration
    currentAddresses = newAddresses;
    prevTxs = newPrevTxs;
    
    // Stop if no more addresses to process
    if (currentAddresses.length === 0) break;
  }
  
  // Add unique keys
  const keyedNodes = nodes.map((node, idx) => ({ ...node, key: node.name || idx }));
  const keyedLinks = links.map((link, idx) => ({ ...link, key: `${link.source}-${link.target}-${link.value}-${idx}` }));
  return { nodes: keyedNodes, links: keyedLinks };
}

// Build a combined flow: at each layer, pick the top 3 largest outgoing txs (normal or internal)
async function buildCombinedFlow(address: string, chain: string, maxDepth: number, startblock: number, mainLossTx?: any) {
  const chainId = CHAIN_IDS[chain];
  const nodes: any[] = [];
  const links: any[] = [];
  const nodeMap = new Map<string, number>();
  
  // Start with the victim address
  nodes.push({ name: address });
  nodeMap.set(address, 0);
  
  // Track current addresses for each path (top 3)
  let currentAddresses = [address];
  let prevTxs = [mainLossTx || null];
  
  for (let depth = 0; depth < maxDepth; depth++) {
    const newAddresses: string[] = [];
    const newPrevTxs: any[] = [];
    
    // Process each current address
    for (let pathIndex = 0; pathIndex < currentAddresses.length; pathIndex++) {
      const currentAddress = currentAddresses[pathIndex];
      const prevTx = prevTxs[pathIndex];
      
      let txsNormal = [];
      let txsInternal = [];
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
        
        console.log(`Fetching transactions for ${currentAddress} at depth ${depth}, startblock: ${effectiveStartblock} (prevTx block: ${prevTx?.blockNumber || 'N/A'})`);
        const all = await getEvmTransactionsAllTypes(currentAddress, chainId, effectiveStartblock);
        txsNormal = all.normal || [];
        txsInternal = all.internal || [];
      } catch (e) { txsNormal = []; txsInternal = []; }
      
      let txs = [...txsNormal, ...txsInternal];
      
      // For first layer, match by hash if available
      if (depth === 0 && mainLossTx && mainLossTx.hash) {
        const matchByHash = txs.find((tx: any) => tx.hash && tx.hash.toLowerCase() === mainLossTx.hash.toLowerCase());
        if (matchByHash) {
          txs = [matchByHash];
        } else {
          continue; // Skip this path if hash doesn't match
        }
      } else if (depth === 0 && (!mainLossTx || !mainLossTx.hash)) {
        continue; // Skip this path if no main loss transaction
      } else {
        // For subsequent layers, select the top 3 largest outgoing transactions after prevTx
        let filtered = txs;
        if (prevTx && (prevTx.blockNumber || prevTx.timeStamp)) {
          filtered = txs.filter((tx: any) => {
            if (tx.blockNumber && prevTx.blockNumber) {
              return Number(tx.blockNumber) > Number(prevTx.blockNumber);
            } else if (tx.timeStamp && prevTx.timeStamp) {
              return Number(tx.timeStamp) > Number(prevTx.timeStamp);
            }
            return true;
          });
        }
        
        if (filtered.length > 0) {
          // Sort by value and take top 3
          const sorted = filtered.sort((a, b) => {
            const aValue = Number(a.value) / 1e18;
            const bValue = Number(b.value) / 1e18;
            return bValue - aValue;
          });
          txs = sorted.slice(0, 3); // Take top 3
        } else {
          continue; // Skip this path if no transactions
        }
      }
      
      // Add transactions to graph
      for (const tx of txs) {
        if (!tx || !tx.to) continue;
        
        let toIdx = nodeMap.get(tx.to);
        if (toIdx === undefined) {
          toIdx = nodes.length;
          nodes.push({ name: tx.to });
          nodeMap.set(tx.to, toIdx);
        }
        
        const fromIdx = nodeMap.get(currentAddress);
        if (fromIdx !== undefined && fromIdx !== toIdx && Number(tx.value) > 0) {
          links.push({ 
            source: fromIdx, 
            target: toIdx, 
            value: Number(tx.value) / 1e18 
          });
          
          // Add to next layer addresses (avoid duplicates)
          if (!newAddresses.includes(tx.to)) {
            newAddresses.push(tx.to);
            newPrevTxs.push(tx);
          }
        }
      }
    }
    
    // Update for next iteration
    currentAddresses = newAddresses;
    prevTxs = newPrevTxs;
    
    // Stop if no more addresses to process
    if (currentAddresses.length === 0) break;
  }
  
  // Add unique keys
  const keyedNodes = nodes.map((node, idx) => ({ ...node, key: node.name || idx }));
  const keyedLinks = links.map((link, idx) => ({ ...link, key: `${link.source}-${link.target}-${link.value}-${idx}` }));
  return { nodes: keyedNodes, links: keyedLinks };
}

// Enhanced mapping using the new fund tracking algorithm
async function buildEnhancedFlow(address: string, chain: string, maxDepth: number, startblock: number, mainLossTx?: any) {
  try {
    console.log('Starting enhanced flow analysis...');
    
    // Use the enhanced fund tracking algorithm
    const enhancedAnalysis: EnhancedFlowAnalysis = await enhancedFlowAnalysis(
      address,
      chain,
      maxDepth,
      startblock,
      mainLossTx
    );
    
    // Convert enhanced analysis to graph format for visualization
    const nodes: any[] = [];
    const links: any[] = [];
    const nodeMap = new Map<string, number>();
    
    // Process chain of custody to build graph
    enhancedAnalysis.forensic_evidence.chain_of_custody.forEach((link: any, index: number) => {
      // Get source and target addresses from the link
      const sourceAddress = link.source;
      const targetAddress = link.target;
      
      // Add source node if not exists
      if (!nodeMap.has(sourceAddress)) {
        const sourceIdx = nodes.length;
        nodeMap.set(sourceAddress, sourceIdx);
        nodes.push({ 
          name: sourceAddress,
          risk_score: 0,
          confidence_score: 0
        });
      }
      
      // Add target node if not exists
      if (!nodeMap.has(targetAddress)) {
        const targetIdx = nodes.length;
        nodeMap.set(targetAddress, targetIdx);
        nodes.push({ 
          name: targetAddress,
          risk_score: 0,
          confidence_score: 0
        });
      }
      
      // Add link
      const sourceIdx = nodeMap.get(sourceAddress);
      const targetIdx = nodeMap.get(targetAddress);
      
      if (sourceIdx !== undefined && targetIdx !== undefined) {
        links.push({
          source: sourceIdx,
          target: targetIdx,
          value: link.value,
          confidence_score: link.confidence_score,
          reasoning_flags: link.reasoning_flags || []
        });
      }
    });
    
    // Add unique keys
    const keyedNodes = nodes.map((node, idx) => ({ ...node, key: node.name || idx }));
    const keyedLinks = links.map((link, idx) => ({ ...link, key: `${link.source}-${link.target}-${link.value}-${idx}` }));
    
    return { 
      nodes: keyedNodes, 
      links: keyedLinks,
      enhanced_analysis: enhancedAnalysis
    };
  } catch (error) {
    console.error('Error in enhanced flow analysis:', error);
    // Fallback to basic flow if enhanced analysis fails
    return await buildCombinedFlow(address, chain, maxDepth, startblock, mainLossTx);
  }
}

export async function POST(request: NextRequest, context: any) {
  const { id } = await Promise.resolve(context.params);
  try {
    console.log('Starting mapping generation for incident:', id);
    
    // Fetch incident
    const result = await pool.query('SELECT * FROM incidents WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Incident not found' }, { status: 404 });
    }
    const incident = result.rows[0];
    if (incident.chain === 'bitcoin') {
      return NextResponse.json({ error: 'Bitcoin mapping not supported yet.' }, { status: 400 });
    }
    
    // Fetch transaction/token data from incident_data
    const dataResult = await pool.query('SELECT data FROM incident_data WHERE incident_id = $1 ORDER BY created_at DESC LIMIT 1', [id]);
    if (dataResult.rows.length === 0) {
      return NextResponse.json({ error: 'No transaction data found for this incident.' }, { status: 404 });
    }
    const txData = dataResult.rows[0].data;
    
    // Identify main loss
    const mainLoss = getMainLoss(txData, incident.wallet_address);
    console.log('Main loss identified:', mainLoss);
    
    // Find the main loss transaction (for ETH or ERC20)
    let mainLossTx = null;
    if (mainLoss.type === 'eth' && txData.info && txData.info.from && txData.info.valueEth) {
      mainLossTx = txData.info;
    } else if (mainLoss.type === 'erc20' && txData.erc20Transfers && Array.isArray(txData.erc20Transfers)) {
      mainLossTx = txData.erc20Transfers.find((t: any) => t.from && t.from.toLowerCase() === incident.wallet_address.toLowerCase() && Number(t.valueDecimal || 0) === mainLoss.value);
    }
    
    const startblock = incident.block_number || 0;
    
    // Build flows for each type
    console.log('Building flows...');
    const ethFlow = await buildFlow(incident.wallet_address, incident.chain, 6, 'normal', startblock, mainLossTx);
    const internalFlow = await buildFlow(incident.wallet_address, incident.chain, 6, 'internal', startblock, mainLossTx);
    const erc20Flow = await buildFlow(incident.wallet_address, incident.chain, 6, 'erc20', startblock, mainLossTx);
    const combinedFlow = await buildCombinedFlow(incident.wallet_address, incident.chain, 6, startblock, mainLossTx);
    
    // Build enhanced flow using the new algorithm
    console.log('Building enhanced flow...');
    const enhancedFlow = await buildEnhancedFlow(incident.wallet_address, incident.chain, 6, startblock, mainLossTx);
    
    // Generate detailed transactions for the report
    console.log('Generating detailed transactions...');
    const detailedTransactions = [];
    
    // Add ETH transactions
    if (txData.info) {
      detailedTransactions.push({
        type: 'eth',
        hash: txData.info.hash,
        from: txData.info.from,
        to: txData.info.to,
        value: txData.info.valueEth,
        blockNumber: txData.info.blockNumber,
        timestamp: txData.info.timeStamp,
        gasUsed: txData.info.gasUsed,
        gasPrice: txData.info.gasPrice
      });
    }
    
    // Add ERC-20 transactions
    if (txData.erc20Transfers && Array.isArray(txData.erc20Transfers)) {
      txData.erc20Transfers.forEach((transfer: any) => {
        detailedTransactions.push({
          type: 'erc20',
          hash: transfer.hash,
          from: transfer.from,
          to: transfer.to,
          tokenSymbol: transfer.tokenSymbol,
          tokenName: transfer.tokenName,
          value: transfer.valueDecimal,
          blockNumber: transfer.blockNumber,
          timestamp: transfer.timeStamp
        });
      });
    }
    
    // Add internal transactions
    if (txData.internal && Array.isArray(txData.internal)) {
      txData.internal.forEach((internal: any) => {
        detailedTransactions.push({
          type: 'internal',
          hash: internal.hash,
          from: internal.from,
          to: internal.to,
          value: internal.value,
          blockNumber: internal.blockNumber,
          timestamp: internal.timeStamp
        });
      });
    }
    
    console.log('Detailed transactions generated:', detailedTransactions.length);
    
    // Create summary for the mapping
    const summary = `Fund flow mapping for incident ${id}. Victim address: ${incident.wallet_address}. Chain: ${incident.chain}. Total transactions analyzed: ${detailedTransactions.length}`;
    
    const response = {
      ethFlow,
      internalFlow,
      erc20Flow,
      combinedFlow,
      enhancedFlow, // New enhanced flow analysis
      detailedTransactions,
      summary,
      pngDataUrl: null, // Will be populated by frontend when Sankey diagram is generated
      incident: {
        id: incident.id,
        wallet_address: incident.wallet_address,
        tx_hash: incident.tx_hash,
        chain: incident.chain,
        discovered_at: incident.discovered_at,
        block_number: incident.block_number
      }
    };
    
    console.log('Mapping generation completed successfully');
    return NextResponse.json(response);
  } catch (err: any) {
    console.error('Error in /api/incident/[id]/mapping:', err);
    return NextResponse.json({ error: err.message || 'Failed to generate mapping' }, { status: 500 });
  }
} 