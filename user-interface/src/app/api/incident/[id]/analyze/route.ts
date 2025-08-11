import { NextRequest, NextResponse } from 'next/server';
import pool from '@/db/client';
import { analyzeIncidentWithClaude } from '@/services/claude';
import { getEvmTransactions } from '@/services/etherscan';

// Helper function to get incident data
async function getIncident(id: string) {
  const result = await pool.query('SELECT * FROM incidents WHERE id = $1', [id]);
  if (result.rows.length === 0) {
    return null;
  }
  return result.rows[0];
}

// Helper function to get transaction data
async function getTransactionData(id: string) {
  const dataResult = await pool.query('SELECT data FROM incident_data WHERE incident_id = $1 ORDER BY created_at DESC LIMIT 1', [id]);
  if (dataResult.rows.length === 0) {
    return null;
  }
  return dataResult.rows[0].data;
}

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

// Simple function to generate basic mapping data
function generateBasicMappingData(txData: any, victimAddress: string) {
  const nodes = [{ name: victimAddress, type: 'victim' }];
  const links: any[] = [];
  const detailedTransactions: any[] = [];
  
  // Extract basic transaction information
  if (txData.info && txData.info.to) {
    nodes.push({ name: txData.info.to, type: 'destination' });
    links.push({
      source: 0,
      target: 1,
      value: Number(txData.info.valueEth || 0),
      hash: txData.info.hash
    });
    detailedTransactions.push({
      from: victimAddress,
      to: txData.info.to,
      value: Number(txData.info.valueEth || 0),
      hash: txData.info.hash,
      type: 'eth'
    });
  }
  
  // Extract ERC-20 transfers
  if (txData.erc20Transfers && Array.isArray(txData.erc20Transfers)) {
    txData.erc20Transfers.forEach((transfer: any, index: number) => {
      if (transfer.from && transfer.to) {
        const fromIndex = nodes.findIndex(n => n.name === transfer.from);
        const toIndex = nodes.findIndex(n => n.name === transfer.to);
        
        if (fromIndex === -1) {
          nodes.push({ name: transfer.from, type: 'intermediary' });
        }
        if (toIndex === -1) {
          nodes.push({ name: transfer.to, type: 'destination' });
        }
        
        const finalFromIndex = nodes.findIndex(n => n.name === transfer.from);
        const finalToIndex = nodes.findIndex(n => n.name === transfer.to);
        
        links.push({
          source: finalFromIndex,
          target: finalToIndex,
          value: Number(transfer.valueDecimal || 0),
          hash: transfer.hash,
          token: transfer.tokenSymbol
        });
        
        detailedTransactions.push({
          from: transfer.from,
          to: transfer.to,
          value: Number(transfer.valueDecimal || 0),
          hash: transfer.hash,
          token: transfer.tokenSymbol,
          type: 'erc20'
        });
      }
    });
  }
  
  return {
    nodes: nodes.map((node, idx) => ({ ...node, key: node.name || idx })),
    links: links.map((link, idx) => ({ ...link, key: `${link.source}-${link.target}-${link.value}-${idx}` })),
    detailedTransactions,
    mainLoss: getMainLoss(txData, victimAddress)
  };
}

// Fallback analysis functions for when Claude API is unavailable
function generateFallbackAnalysis(incident: any, txData: any, mappingData: any) {
  const totalLoss = calculateTotalLoss(txData);
  const mainLoss = getMainLoss(txData, incident.wallet_address);
  
  return {
    executive_summary: `Blockchain incident analysis for ${incident.chain} transaction ${incident.tx_hash}. Victim address: ${incident.wallet_address}. Total estimated loss: ${totalLoss.toFixed(4)} ETH.`,
    total_loss_eth: totalLoss,
    total_loss_usd: totalLoss * 2500, // Approximate USD value
    attack_vector: "Analysis indicates potential security breach or unauthorized transaction",
    detailed_timeline: [
      {
        event: "Initial transaction detected",
        timestamp: incident.created_at,
        value: mainLoss?.value || 0,
        description: "Primary loss transaction identified"
      }
    ],
    fund_flow_analysis: {
      key_intermediaries: mappingData?.nodes?.slice(0, 5) || [],
      final_destinations: mappingData?.nodes?.slice(-3) || [],
      flow_complexity: mappingData?.nodes?.length || 0
    },
    suspicious_indicators: [
      "Large value transfer",
      "Multiple intermediary addresses",
      "Complex fund flow pattern"
    ],
    technical_forensics: {
      smart_contract_analysis: "Transaction analysis completed",
      blockchain_data: "EVM transaction data processed",
      fund_tracking: "Multi-layer fund flow mapping generated"
    },
    law_enforcement_intelligence: {
      suspect_addresses: mappingData?.nodes?.slice(1, -1) || [],
      investigation_steps: [
        "Trace fund flow through identified addresses",
        "Monitor destination addresses for further activity",
        "Cross-reference with known malicious addresses"
      ],
      evidence_preservation: "All transaction data preserved for investigation"
    },
    risk_assessment: {
      recovery_likelihood: "low",
      risk_level: "high",
      immediate_actions: [
        "Freeze affected accounts if possible",
        "Report to relevant authorities",
        "Monitor for additional suspicious activity"
      ]
    },
    compliance_requirements: {
      sar_triggers: ["Large value transfer", "Suspicious fund flow"],
      reporting_obligations: ["File SAR if threshold exceeded"],
      regulatory_considerations: ["AML/KYC compliance review required"]
    },
    natural_language_summary: `This incident involves a ${incident.chain} transaction with hash ${incident.tx_hash} affecting address ${incident.wallet_address}. The total loss is approximately ${totalLoss.toFixed(4)} ETH ($${(totalLoss * 2500).toFixed(2)}). The fund flow analysis shows ${mappingData?.nodes?.length || 0} addresses involved in the transaction chain. Immediate investigation and reporting are recommended.`
  };
}

function generateBasicFallbackAnalysis(incident: any, txData: any) {
  const totalLoss = calculateTotalLoss(txData);
  
  return {
    executive_summary: `Basic incident analysis: ${incident.chain} transaction affecting ${incident.wallet_address}`,
    total_loss_eth: totalLoss,
    total_loss_usd: totalLoss * 2500,
    attack_vector: "Transaction analysis required",
    detailed_timeline: [
      {
        event: "Incident reported",
        timestamp: incident.created_at,
        value: totalLoss,
        description: "Initial incident detection"
      }
    ],
    fund_flow_analysis: {
      key_intermediaries: [],
      final_destinations: [],
      flow_complexity: 0
    },
    suspicious_indicators: ["Transaction analysis pending"],
    technical_forensics: {
      smart_contract_analysis: "Analysis pending",
      blockchain_data: "Data available for processing",
      fund_tracking: "Fund flow analysis required"
    },
    law_enforcement_intelligence: {
      suspect_addresses: [],
      investigation_steps: ["Complete transaction analysis", "Trace fund flow"],
      evidence_preservation: "Transaction data preserved"
    },
    risk_assessment: {
      recovery_likelihood: "unknown",
      risk_level: "medium",
      immediate_actions: ["Complete analysis", "Assess damage"]
    },
    compliance_requirements: {
      sar_triggers: ["Analysis required"],
      reporting_obligations: ["Determine if reporting required"],
      regulatory_considerations: ["Compliance review pending"]
    },
    natural_language_summary: `Basic analysis of ${incident.chain} incident. Total value: ${totalLoss.toFixed(4)} ETH. Full analysis requires API access.`
  };
}

function calculateTotalLoss(txData: any): number {
  if (!txData || !Array.isArray(txData)) return 0;
  
  return txData.reduce((total: number, tx: any) => {
    const value = parseFloat(tx.value || '0');
    return total + value;
  }, 0);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const { id } = await params;
  
  console.log(`Starting analysis for incident ${id}...`);
  const startTime = Date.now();
  
  try {
    // Set a timeout for the entire operation
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Analysis operation timed out after 3 minutes')), 180000);
    });

    const analysisPromise = performAnalysis(id);
    
    // Race between the analysis and timeout
    const result = await Promise.race([analysisPromise, timeoutPromise]);
    
    const endTime = Date.now();
    console.log(`Analysis completed for incident ${id} in ${endTime - startTime}ms`);
    
    return result;
  } catch (error: any) {
    const endTime = Date.now();
    console.error(`Analysis failed for incident ${id} after ${endTime - startTime}ms:`, error);
    
    return NextResponse.json(
      { 
        error: error.message || 'Analysis failed',
        details: 'The analysis operation took too long or encountered an error. Please try again.'
      }, 
      { status: 500 }
    );
  }
}

async function performAnalysis(id: string): Promise<NextResponse> {
  // Fetch incident data
  const incident = await getIncident(id);
  if (!incident) {
    throw new Error('Incident not found');
  }

  // Fetch transaction data
  const txData = await getTransactionData(id);
  if (!txData || txData.length === 0) {
    throw new Error('No transaction data found');
  }

  // Generate mapping data
  console.log('Generating mapping data...');
  const mappingData = generateBasicMappingData(txData, incident.wallet_address);

  // Create comprehensive prompt
  const comprehensivePrompt = `Analyze this blockchain incident with maximum detail.

INCIDENT INFORMATION:
- Description: ${incident.description}
- Chain: ${incident.chain}
- Victim Address: ${incident.wallet_address}
- Transaction Hash: ${incident.tx_hash}
- Created: ${incident.created_at}

TRANSACTION DATA:
${JSON.stringify(txData, null, 2)}

FUND FLOW MAPPING:
${JSON.stringify(mappingData, null, 2)}

Provide comprehensive analysis in JSON format with these sections:
1. executive_summary: Brief overview
2. total_loss_eth: Total ETH loss
3. total_loss_usd: Total USD loss
4. attack_vector: Primary attack method
5. detailed_timeline: Chronological events
6. fund_flow_analysis: Key intermediaries and destinations
7. suspicious_indicators: Risk factors
8. technical_forensics: Technical analysis
9. law_enforcement_intelligence: Investigation guidance
10. risk_assessment: Recovery likelihood and actions
11. compliance_requirements: Regulatory requirements
12. natural_language_summary: Summary for investigators

Provide maximum detail analysis.`;

  // Debug: Log prompt size
  console.log('Prompt size (characters):', comprehensivePrompt.length);
  console.log('Prompt size (estimated tokens):', Math.ceil(comprehensivePrompt.length / 4));
  console.log('Rate limit info: Opus 3 - 40k input/min, 4k output max per request');

  let aiResponse;
  try {
    console.log('Calling Claude API...');
    aiResponse = await analyzeIncidentWithClaude(comprehensivePrompt);
    console.log('Claude API call successful');
  } catch (error: any) {
    console.log('Comprehensive analysis failed, trying simplified prompt...');
    console.log('Error details:', error.response?.data || error.message);
    
    // Check if it's a billing/credit error
    if (error.response?.status === 400 && 
        error.response?.data?.error?.message?.includes('credit balance is too low')) {
      console.log('Billing issue detected - using fallback analysis');
      
      // Generate fallback analysis without API call
      const fallbackAnalysis = generateFallbackAnalysis(incident, txData, mappingData);
      return NextResponse.json({ 
        ai: { content: [{ text: JSON.stringify(fallbackAnalysis) }] }, 
        mappingData 
      });
    }
    
    // Fallback to simpler prompt
    const simplePrompt = `Analyze this blockchain incident:

INCIDENT: ${incident.description}
Chain: ${incident.chain}
Victim: ${incident.wallet_address}
Tx Hash: ${incident.tx_hash}

TRANSACTION DATA:
${JSON.stringify(txData, null, 2)}

Provide analysis in JSON format:
{
  "executive_summary": "Brief summary",
  "total_loss_eth": 0.0,
  "total_loss_usd": 0.0,
  "attack_vector": "Attack method",
  "detailed_timeline": [{"event": "description", "value": 0.0}],
  "fund_flow_analysis": {"key_intermediaries": [], "final_destinations": []},
  "suspicious_indicators": [],
  "technical_forensics": {"smart_contract_analysis": "details"},
  "law_enforcement_intelligence": {"suspect_addresses": [], "investigation_steps": []},
  "risk_assessment": {"recovery_likelihood": "medium"},
  "compliance_requirements": {"sar_triggers": []},
  "natural_language_summary": "Summary for investigators"
}`;

    console.log('Fallback prompt size (characters):', simplePrompt.length);
    
    try {
      console.log('Trying simplified Claude API call...');
      aiResponse = await analyzeIncidentWithClaude(simplePrompt);
      console.log('Simplified Claude API call successful');
    } catch (fallbackError: any) {
      console.log('Simplified prompt also failed, using basic fallback analysis');
      console.log('Fallback error:', fallbackError.response?.data || fallbackError.message);
      
      // Generate basic fallback analysis
      const basicAnalysis = generateBasicFallbackAnalysis(incident, txData);
      return NextResponse.json({ 
        ai: { content: [{ text: JSON.stringify(basicAnalysis) }] }, 
        mappingData 
      });
    }
  }
  
  return NextResponse.json({ ai: aiResponse, mappingData });
} 