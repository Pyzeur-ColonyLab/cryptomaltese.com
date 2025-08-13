import { NextRequest, NextResponse } from 'next/server';
import pool from '@/db/client';
import { enhancedFlowAnalysis, EnhancedFlowAnalysis } from '@/services/enhanced-fund-tracker';
import { FundFlowTracker } from '@/services/fund-flow/tracker';
import { PatternDetector } from '@/services/fund-flow/pattern-detector';
import { AddressClassifier } from '@/services/fund-flow/address-classifier';
import { PathAnalyzer } from '@/services/fund-flow/path-analyzer';
import { getEvmTransactions, getEvmTransactionDetails } from '@/services/etherscan';

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

export async function POST(request: NextRequest, context: any) {
  const { id } = await Promise.resolve(context.params);
  const body = await request.json();
  
  console.log('🔍 Enhanced mapping API received:', { id, body });
  
  try {
    // Clean and validate the incident ID
    const cleanId = id.trim();
    
    // Basic UUID validation
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(cleanId)) {
      return NextResponse.json({ error: 'Invalid incident ID format' }, { status: 400 });
    }
    
    console.log('Starting enhanced mapping generation for incident:', cleanId);
    
    // Fetch incident
    const result = await pool.query('SELECT * FROM incidents WHERE id = $1', [cleanId]);
    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Incident not found' }, { status: 404 });
    }
    const incident = result.rows[0];
    if (incident.chain === 'bitcoin') {
      return NextResponse.json({ error: 'Bitcoin mapping not supported yet.' }, { status: 400 });
    }
    
    // Fetch transaction/token data from incident_data
    const dataResult = await pool.query('SELECT data FROM incident_data WHERE incident_id = $1 ORDER BY created_at DESC LIMIT 1', [cleanId]);
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
    
    // Run enhanced flow analysis
    console.log('Running enhanced flow analysis...');
    console.log('🔍 HACK BLOCK VALIDATION:');
    console.log(`   - Incident block number: ${incident.block_number}`);
    console.log(`   - Startblock used: ${startblock}`);
    console.log(`   - Main loss transaction:`, mainLossTx ? {
      hash: mainLossTx.hash,
      blockNumber: mainLossTx.blockNumber,
      timeStamp: mainLossTx.timeStamp
    } : 'None');
    console.log('Parameters:', {
      address: incident.wallet_address,
      chain: incident.chain,
      maxDepth: 6,
      startblock,
      mainLossTx: mainLossTx ? {
        hash: mainLossTx.hash,
        from: mainLossTx.from,
        to: mainLossTx.to,
        value: mainLossTx.value,
        blockNumber: mainLossTx.blockNumber,
        timeStamp: mainLossTx.timeStamp
      } : null
    });

    // 🔄 NEW: Run enhanced fund flow analysis
    let enhancedAnalysis: EnhancedFlowAnalysis;
    try {
      console.log('🔍 Running enhanced fund flow analysis...');
      
      // Create a mock Etherscan service for the new tracker
      const mockEtherscanService = {
        async getTransactions(address: string, timestamp: Date) {
          const chainId = CHAIN_IDS[incident.chain] || 1;
          return await getEvmTransactions(address, chainId);
        },
        async getOutgoingTransactions(address: string, minBlockNumber: number = 0) {
          const chainId = CHAIN_IDS[incident.chain] || 1;
          const allTxs = await getEvmTransactions(address, chainId);
          
          // Filter by both hack block number AND progressive block filtering
          return allTxs.filter((tx: any) => {
            // Must be outgoing transaction
            if (tx.from?.toLowerCase() !== address.toLowerCase()) return false;
            
            // Must have block number
            if (!tx.blockNumber) return false;
            
            // Must be after the hack block number
            if (parseInt(incident.block_number || '0') > 0) {
              const hackBlock = parseInt(incident.block_number);
              const txBlock = parseInt(tx.blockNumber, 16);
              if (txBlock <= hackBlock) return false;
            }
            
            // Must be after the progressive block threshold
            if (minBlockNumber > 0) {
              const txBlock = parseInt(tx.blockNumber, 16);
              if (txBlock <= minBlockNumber) return false;
            }
            
            return true;
          });
        },
        async getTransactionByHash(hash: string) {
          // Since we already have the transaction details in mainLossTx, return them directly
          if (mainLossTx && mainLossTx.hash === hash) {
            return {
              hash: mainLossTx.hash,
              from: mainLossTx.from,
              to: mainLossTx.to,
              value: mainLossTx.value,
              timeStamp: mainLossTx.timeStamp,
              blockNumber: mainLossTx.blockNumber
            };
          }
          
          // Fallback: try to get from Etherscan (but this might not work due to API structure)
          try {
            const chainId = CHAIN_IDS[incident.chain] || 1;
            return await getEvmTransactionDetails(hash, chainId);
          } catch (error) {
            console.log(`❌ Error fetching transaction details for ${hash}:`, error);
            return null;
          }
        }
      };

      const tracker = new FundFlowTracker(
        mockEtherscanService,
        new PatternDetector(),
        new AddressClassifier(),
        new PathAnalyzer()
      );

      // Run fund flow analysis with new algorithm
      const trackerConfig = { 
        maxDepth: 6, 
        highVolumeThreshold: 1000, // Mark nodes with >1000 tx as potential endpoints
        enableAIClassification: false // Disabled for now
      };
      
      console.log('🔍 Tracker configuration:', trackerConfig);
      console.log('🔍 High activity threshold: 1000 transactions');
      
      // Get the hack transaction hash from mainLossTx
      const hackTransactionHash = mainLossTx?.hash;
      if (!hackTransactionHash) {
        throw new Error('No hack transaction hash found in mainLossTx');
      }
      
      console.log(`🔍 Using hack transaction hash: ${hackTransactionHash}`);
      
      const fundFlowAnalysis = await tracker.analyzeIncident(
        cleanId,
        incident.wallet_address,
        mainLoss.value?.toString() || '0',
        new Date(incident.discovered_at),
        hackTransactionHash,
        trackerConfig
      );

      console.log('✅ Fund flow analysis completed:', fundFlowAnalysis);
      
      // Identify potential endpoints from the paths
      const potentialEndpoints = fundFlowAnalysis.paths
        .filter(p => p.patterns?.isPotentialEndpoint)
        .map(p => ({
          address: p.fromAddress,
          type: 'potential_endpoint',
          confidence: p.confidenceScore || 0,
          reasoning: [`High activity: ${p.patterns.transactionCount} transactions`],
          incoming_value: 0,
          incoming_transaction: 'ENDPOINT_MARKER'
        }));

      console.log('🔍 Potential endpoints identified:', potentialEndpoints);

      // Convert fund flow analysis to enhanced format
      enhancedAnalysis = {
        flow_analysis: {
          total_depth_reached: fundFlowAnalysis.paths.length > 0 ? Math.max(...fundFlowAnalysis.paths.map(p => p.depthLevel)) : 0,
          total_addresses_analyzed: new Set(fundFlowAnalysis.paths.flatMap(p => [p.fromAddress, p.toAddress])).size,
          total_value_traced: fundFlowAnalysis.paths.reduce((sum, p) => sum + (p.valueAmount || 0), 0).toString(),
          high_confidence_paths: fundFlowAnalysis.paths.filter(p => (p.confidenceScore || 0) > 0.7).length,
          cross_chain_exits: 0,
          endpoints_detected: fundFlowAnalysis.paths.filter(p => p.patterns?.isPotentialEndpoint).length,
          endpoint_types: fundFlowAnalysis.paths
            .filter(p => p.patterns?.isPotentialEndpoint)
            .map(p => 'potential_endpoint')
        },
        risk_assessment: {
          high_risk_addresses: []
        },
        forensic_evidence: {
          chain_of_custody: fundFlowAnalysis.paths.map(p => ({
            source: p.fromAddress,
            target: p.toAddress,
            value: p.valueAmount?.toString() || '0',
            confidence_score: p.confidenceScore || 0,
            reasoning_flags: ['Enhanced fund flow analysis']
          })),
          confidence_scores: fundFlowAnalysis.paths.map(p => p.confidenceScore || 0),
          pattern_matches: [],
          cross_references: []
        },
        endpoints: potentialEndpoints
      };

    } catch (claudeError) {
      console.log('⚠️ Claude analysis failed, falling back to enhanced tracker:', claudeError);
      
      // Fallback to original enhanced tracker
      enhancedAnalysis = await enhancedFlowAnalysis(
        incident.wallet_address,
        incident.chain,
        6, // maxDepth
        startblock,
        mainLossTx
      );
    }
    
    console.log('Enhanced analysis result:', {
      total_depth_reached: enhancedAnalysis.flow_analysis.total_depth_reached,
      total_addresses_analyzed: enhancedAnalysis.flow_analysis.total_addresses_analyzed,
      total_value_traced: enhancedAnalysis.flow_analysis.total_value_traced,
      chain_of_custody_length: enhancedAnalysis.forensic_evidence.chain_of_custody.length
    });
    
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
    
    // Generate detailed transactions for the report
    console.log('Generating detailed transactions...');
    const detailedTransactions = [];
    
    // Add the original incident transaction first
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
        gasPrice: txData.info.gasPrice,
        description: 'Original hack transaction'
      });
    }
    
    // Add ERC-20 transactions from original incident
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
          timestamp: transfer.timeStamp,
          description: 'Original ERC-20 transfer'
        });
      });
    }
    
    // Add internal transactions from original incident
    if (txData.internal && Array.isArray(txData.internal)) {
      txData.internal.forEach((internal: any) => {
        detailedTransactions.push({
          type: 'internal',
          hash: internal.hash,
          from: internal.from,
          to: internal.to,
          value: internal.value,
          blockNumber: internal.blockNumber,
          timestamp: internal.timeStamp,
          description: 'Original internal transaction'
        });
      });
    }
    
    // 🔄 NEW: Add all tracked transactions from the enhanced fund flow analysis
    // This includes all the transactions discovered during the fund tracking process
    if (enhancedAnalysis.forensic_evidence && enhancedAnalysis.forensic_evidence.chain_of_custody) {
      console.log(`Adding ${enhancedAnalysis.forensic_evidence.chain_of_custody.length} tracked transactions from fund flow analysis`);
      
      enhancedAnalysis.forensic_evidence.chain_of_custody.forEach((custodyItem: any, index: number) => {
        // Handle the actual chain of custody structure
        detailedTransactions.push({
          type: 'tracked',
          hash: `flow_${index}`, // Generate a unique identifier since we don't have actual tx hash
          from: custodyItem.source,
          to: custodyItem.target,
          value: custodyItem.value,
          blockNumber: 'N/A', // We don't have block number in chain of custody
          timestamp: 'N/A', // We don't have timestamp in chain of custody
          description: `Fund flow tracking - ${custodyItem.reasoning_flags?.join(', ') || 'No flags'}`,
          confidence: custodyItem.confidence_score,
          depth: index // Use index as depth indicator
        });
      });
    }
    
    // 🔄 NEW: Add endpoint transactions
    if (enhancedAnalysis.endpoints && enhancedAnalysis.endpoints.length > 0) {
      console.log(`Adding ${enhancedAnalysis.endpoints.length} endpoint transactions`);
      
      enhancedAnalysis.endpoints.forEach((endpoint: any) => {
        if (endpoint.incoming_transaction) {
          detailedTransactions.push({
            type: 'endpoint',
            hash: endpoint.incoming_transaction,
            from: 'Unknown', // We don't have the 'from' for endpoints
            to: endpoint.address,
            value: endpoint.incoming_value,
            blockNumber: 'N/A', // We don't have block number for endpoints
            timestamp: 'N/A', // We don't have timestamp for endpoints
            description: `Endpoint detected: ${endpoint.type} (confidence: ${endpoint.confidence})`,
            endpointType: endpoint.type,
            confidence: endpoint.confidence
          });
        }
      });
    }
    
    console.log('Detailed transactions generated:', detailedTransactions.length);
    
    // Create summary for the mapping
    const summary = `Enhanced fund flow mapping for incident ${id}. Victim address: ${incident.wallet_address}. Chain: ${incident.chain}. Total transactions analyzed: ${detailedTransactions.length}. High-risk addresses detected: ${enhancedAnalysis.risk_assessment.high_risk_addresses.length}`;
    
    const response = {
      nodes: keyedNodes,
      links: keyedLinks,
      enhanced_analysis: enhancedAnalysis,
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
    
    console.log('Enhanced mapping generation completed successfully');
    
    // Store the analysis data for future retrieval
    try {
      const analysisData = {
        enhanced_analysis: enhancedAnalysis,
        detailedTransactions,
        summary,
        nodes: keyedNodes,
        links: keyedLinks,
        incident: {
          id: incident.id,
          wallet_address: incident.wallet_address,
          tx_hash: incident.tx_hash,
          chain: incident.chain,
          discovered_at: incident.discovered_at,
          block_number: incident.block_number
        }
      };
      
      const storeResult = await fetch(`${request.nextUrl.origin}/api/analysis`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          incident_id: cleanId,
          analysis_data: analysisData
        })
      });
      
      if (storeResult.ok) {
        const storeResponse = await storeResult.json();
        console.log('Analysis stored with ID:', storeResponse.id);
        response.analysis_id = storeResponse.id;
      } else {
        console.warn('Failed to store analysis data:', await storeResult.text());
      }
    } catch (storeError) {
      console.warn('Error storing analysis data:', storeError);
    }
    
    return NextResponse.json(response);
  } catch (err: any) {
    console.error('Error in /api/incident/[id]/enhanced-mapping:', err);
    return NextResponse.json({ error: err.message || 'Failed to generate enhanced mapping' }, { status: 500 });
  }
} 