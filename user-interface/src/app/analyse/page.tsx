"use client";
import React, { useState, useMemo } from 'react';
import styles from './Analyse.module.css';
import SafeSankey from './components/SafeSankey';
import PatternAnalysis from './components/PatternAnalysis';
import ClassificationConfidence from './components/ClassificationConfidence';

// Professional color scheme matching user's request
const COLOR_SCHEME = {
  VICTIM: '#3b82f6',        // Blue for victim wallet
  INTERMEDIATE: '#fbbf24',  // Yellow for intermediate nodes
  ENDPOINT: '#ef4444',      // Red for endpoint nodes
  FLOW: '#3b82f6',          // Blue for tracked flow
  ENDPOINT_FLOW: '#ef4444'  // Red for endpoint flow
};







// Shorten address for display
function shortenAddress(address: string) {
  if (!address) return 'N/A';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

interface AnalysisData {
  id: string;
  incident_id: string;
  created_at: string;
  flow_analysis: {
    total_depth_reached: number;
    total_addresses_analyzed: number;
    total_value_traced: string;
    high_confidence_paths: number;
    cross_chain_exits: number;
    endpoints_detected?: number;
    endpoint_types?: string[];
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
    confidence_scores: number[];
    pattern_matches: any[];
    cross_references: any[];
  };
  detailed_transactions: any[];
  summary: string;
  endpoints?: Array<{
    address: string;
    type: string;
    confidence: number;
    reasoning: string[];
    incoming_value: number;
    incoming_transaction: string;
  }>;
}

export default function Analyse() {
  const [incidentId, setIncidentId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null);
  const [analysisId, setAnalysisId] = useState<string | null>(null);
  const [existingAnalyses, setExistingAnalyses] = useState<AnalysisData[]>([]);
  const [hasCheckedExisting, setHasCheckedExisting] = useState(false);
  const [showExistingAnalyses, setShowExistingAnalyses] = useState(false);
  // AI Analysis temporarily disabled - will be developed separately





  async function handleAnalyse() {
    setError('');
    setAnalysisData(null);
    setAnalysisId(null);
    setExistingAnalyses([]);
    setShowExistingAnalyses(false);
    
    if (!incidentId) {
      setError('Please enter an Incident ID.');
      return;
    }
    
    // Clean the incident ID (remove leading/trailing spaces)
    const cleanIncidentId = incidentId.trim();
    
    if (!cleanIncidentId) {
      setError('Please enter a valid Incident ID.');
      return;
    }
    
    // Basic UUID validation
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(cleanIncidentId)) {
      setError('Please enter a valid UUID format (e.g., 123e4567-e89b-12d3-a456-426614174000).');
      return;
    }
    
    setLoading(true);
    
    try {
      
      // Check if analyses already exist for this incident
      const existingRes = await fetch(`/api/analysis?incident_id=${cleanIncidentId}`);
      
      if (existingRes.ok) {
        // Found existing analyses - show them and offer to load or run new
        const existingData = await existingRes.json();
        
        setExistingAnalyses(existingData);
        setShowExistingAnalyses(true);
        setHasCheckedExisting(true);
        setLoading(false);
        return;
      }
      
      // No existing analysis found - run new analysis
      await runNewAnalysis(cleanIncidentId);
      
    } catch (e: any) {
      console.error('Analysis check failed:', e);
      setError(e.message || 'Failed to check for existing analysis. Please try again.');
      setLoading(false);
    }
  }

  async function runNewAnalysis(incidentId: string) {
    try {
      // Call the new microservice-enabled fund flow analysis endpoint
      console.log('🔍 Starting fund flow analysis with Python microservice...');
      
      const res = await fetch('/api/fund-flow/analyze', { 
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          incidentId,
          config: {
            maxDepth: 6,
            enableAIClassification: true
          }
        })
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || `HTTP ${res.status}: ${res.statusText}`);
      }
      
      const data = await res.json();
      
      // Start progress tracking
      const analysisId = data.analysisId;
      setAnalysisId(analysisId);
      setIsRunning(true);
      
      // Poll for progress updates
      const progressInterval = setInterval(async () => {
        try {
          const progressRes = await fetch(`/api/fund-flow/analyze?analysisId=${analysisId}`);
          if (progressRes.ok) {
            const progressData = await progressRes.json();
            setProgress(progressData.analysis);
            
            if (progressData.analysis.status === 'completed') {
              clearInterval(progressInterval);
              setIsRunning(false);
              setAnalysisData(progressData.analysis.results_data);
            } else if (progressData.analysis.status === 'failed') {
              clearInterval(progressInterval);
              setIsRunning(false);
              setError(progressData.analysis.error_message || 'Analysis failed');
            }
          }
        } catch (error) {
          console.error('Progress check failed:', error);
        }
      }, 3000); // Check every 3 seconds
      
      setLoading(false);
      
    } catch (e: any) {
      console.error('Analysis failed:', e);
      setError(e.message || 'Failed to start analysis. Please try again.');
      setLoading(false);
    }
  }
      
      // Format the data for display
      const formattedData: AnalysisData = {
        id: analysisId,
        incident_id: incidentId,
        created_at: new Date().toISOString(),
        flow_analysis: data.enhanced_analysis.flow_analysis,
        risk_assessment: data.enhanced_analysis.risk_assessment,
        forensic_evidence: data.enhanced_analysis.forensic_evidence,
        detailed_transactions: data.detailedTransactions || [],
        summary: data.summary || 'Enhanced fund flow analysis completed',
        endpoints: data.enhanced_analysis.endpoints || []
      };
      
      setAnalysisData(formattedData);
      setShowExistingAnalyses(false);
      setHasCheckedExisting(false);
      
    } catch (e: any) {
      clearTimeout(timeoutId);
      console.error('Analysis failed:', e);
      setError(e.message || 'Failed to generate analysis. Please try again.');
    }
    setLoading(false);
  }

  async function forceNewAnalysis() {
    if (!incidentId) {
      setError('Please enter an Incident ID.');
      return;
    }
    
    const cleanIncidentId = incidentId.trim();
    await runNewAnalysis(cleanIncidentId);
  }

  async function loadAnalysisById(analysisId: string) {
    setLoading(true);
    setError('');
    
    try {
      const res = await fetch(`/api/analysis?id=${analysisId}`);
      
      if (res.ok) {
        const data = await res.json();
        
        setAnalysisId(data.id);
        
        // Extract detailedTransactions from the stored analysis data
        const detailedTransactions = data.analysis_data?.detailedTransactions || [];
        
        const formattedData: AnalysisData = {
          id: data.id,
          incident_id: data.incident_id,
          created_at: data.created_at,
          flow_analysis: data.analysis_data.enhanced_analysis.flow_analysis,
          risk_assessment: data.analysis_data.enhanced_analysis.risk_assessment,
          forensic_evidence: data.analysis_data.enhanced_analysis.forensic_evidence,
          detailed_transactions: detailedTransactions,
          summary: data.analysis_data.summary || 'Enhanced fund flow analysis (loaded from history)'
        };
        
        setAnalysisData(formattedData);
        setShowExistingAnalyses(false);
        setHasCheckedExisting(true);
      } else {
        setError('Failed to load analysis');
      }
    } catch (error) {
      console.error('Error loading analysis:', error);
      setError('Failed to load analysis');
    }
    setLoading(false);
  }

  function formatAddress(address: string) {
    if (!address) return 'Unknown';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }

  function formatValue(value: number | string) {
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    return `${numValue.toFixed(4)} ETH`;
  }

  function formatConfidence(confidence: number) {
    return `${(confidence * 100).toFixed(1)}%`;
  }

  function getRiskLevelText(riskScore: number) {
    if (riskScore >= 700) return 'HIGH';
    if (riskScore >= 300) return 'MEDIUM';
    return 'LOW';
  }

  function handleIncidentIdChange(e: React.ChangeEvent<HTMLInputElement>) {
    setIncidentId(e.target.value);
    if (hasCheckedExisting) {
      setHasCheckedExisting(false);
      setShowExistingAnalyses(false);
      setExistingAnalyses([]);
    }
  }

  // Process detailed transactions into Sankey diagram data
  const sankeyData = useMemo(() => {
    if (!analysisData?.detailed_transactions) return null;
    
    console.log('🔍 Processing sankeyData with detailed_transactions:', analysisData.detailed_transactions);
    console.log('🔍 Total value traced:', analysisData.flow_analysis?.total_value_traced);

    // Create a proper fund flow structure
    const flowData = {
      nodes: [] as any[],
      links: [] as any[]
    };

    // Find the victim wallet from the original ETH transaction
    const originalTx = analysisData.detailed_transactions.find(tx => tx.type === 'eth');
    const victimWallet = originalTx?.from;
    
    if (!victimWallet) {
      return null;
    }

    // Add victim wallet as first node
    const victimNode = {
      name: shortenAddress(victimWallet),
      fullName: victimWallet,
      index: 0,
      type: 'victim',
      key: `node-victim-${victimWallet}`
    };
    
    flowData.nodes.push(victimNode);

    let nodeIndex = 1;
    let linkIndex = 0;
    const addressToIndex = new Map<string, number>();
    const existingLinks = new Map<string, number>();
    const visitedAddresses = new Set<string>(); // Track visited addresses to prevent cycles
    addressToIndex.set(victimWallet.toLowerCase(), 0); // Use lowercase for consistency
    visitedAddresses.add(victimWallet.toLowerCase());

    // Process tracked transactions (these are the fund flow paths)
    const trackedTxs = analysisData.detailed_transactions.filter(tx => tx.type === 'tracked');

    trackedTxs.forEach((tx, index) => {
      const from = tx.from;
      const to = tx.to;
      const value = typeof tx.value === 'number' ? tx.value : parseFloat(tx.value) || 0;
      
      console.log(`🔍 Processing transaction: ${from} → ${to}, value: ${tx.value} (parsed: ${value})`);

      if (!from || !to) {
        return;
      }

      // Skip self-loops
      if (from.toLowerCase() === to.toLowerCase()) {
        console.warn(`Skipping self-loop transaction: ${from} → ${to}`);
        return;
      }

      // Skip if target already visited (prevents cycles)
      const toLower = to.toLowerCase();
      if (visitedAddresses.has(toLower)) {
        console.warn(`Skipping circular transaction: ${from} → ${to} (target already visited)`);
        return;
      }

      // Add source node if not exists (use lowercase for comparison)
      const fromLower = from.toLowerCase();
      if (!addressToIndex.has(fromLower)) {
        addressToIndex.set(fromLower, nodeIndex);
        const sourceNode = {
          name: shortenAddress(from),
          fullName: from,
          index: nodeIndex,
          type: 'intermediate',
          key: `node-intermediate-${from}-${nodeIndex}`
        };
        flowData.nodes.push(sourceNode);
        nodeIndex++;
      }

      // Add target node if not exists (use lowercase for comparison)
      if (!addressToIndex.has(toLower)) {
        addressToIndex.set(toLower, nodeIndex);
        const targetNode = {
          name: shortenAddress(to),
          fullName: to,
          index: nodeIndex,
          type: 'intermediate',
          key: `node-intermediate-${to}-${nodeIndex}`
        };
        flowData.nodes.push(targetNode);
        nodeIndex++;
      }

      // Create link (use lowercase for lookup)
      const sourceIndex = addressToIndex.get(fromLower);
      const targetIndex = addressToIndex.get(toLower);
      const linkKey = `${fromLower}-${toLower}`;
      
      if (existingLinks.has(linkKey)) {
        // Update existing link value
        const existingValue = existingLinks.get(linkKey)!;
        existingLinks.set(linkKey, existingValue + value);
        
        const existingLinkIndex = flowData.links.findIndex(l => 
          l.source === sourceIndex && l.target === targetIndex
        );
        if (existingLinkIndex !== -1) {
          flowData.links[existingLinkIndex].value += value;
        }
      } else {
        // Create new link
        existingLinks.set(linkKey, value);
        const newLink = {
          source: sourceIndex,
          target: targetIndex,
          value: value,
          sourceName: from,
          targetName: to,
          description: tx.description || 'Fund flow',
          type: 'tracked',
          depth: tx.depth,
          key: `link-${sourceIndex}-${targetIndex}-${linkIndex++}`
        };
        flowData.links.push(newLink);
        
        // Mark target as visited to prevent cycles
        visitedAddresses.add(toLower);
      }
    });

    // Process endpoint transactions
    const endpointTxs = analysisData.detailed_transactions.filter(tx => tx.type === 'endpoint');

    endpointTxs.forEach((tx, index) => {
      const to = tx.to;
      const value = typeof tx.value === 'number' ? tx.value : parseFloat(tx.value) || 0;

      if (!to) {
        return;
      }

      // Add endpoint node if not exists, or update existing node type
      const toLower = to.toLowerCase();
      if (!addressToIndex.has(toLower)) {
        addressToIndex.set(toLower, nodeIndex);
        const endpointNode = {
          name: shortenAddress(to),
          fullName: to,
          index: nodeIndex,
          type: 'endpoint',
          key: `node-endpoint-${to}-${nodeIndex}`
        };
        flowData.nodes.push(endpointNode);
        nodeIndex++;
      } else {
        // Update existing node type to endpoint
        const existingNodeIndex = flowData.nodes.findIndex(n => n.fullName.toLowerCase() === toLower);
        if (existingNodeIndex !== -1) {
          flowData.nodes[existingNodeIndex].type = 'endpoint';
        }
      }

      // Find the source transaction that leads to this endpoint
      const sourceTx = trackedTxs.find(t => t.to.toLowerCase() === toLower);
      if (sourceTx && addressToIndex.has(sourceTx.from.toLowerCase())) {
        const sourceIndex = addressToIndex.get(sourceTx.from.toLowerCase());
        const targetIndex = addressToIndex.get(toLower);
        
        // Skip if this would create a cycle (endpoint pointing back to an earlier node)
        if (sourceIndex !== undefined && targetIndex !== undefined) {
          const endpointLinkKey = `endpoint-${sourceTx.from.toLowerCase()}-${toLower}`;
          if (!existingLinks.has(endpointLinkKey)) {
            existingLinks.set(endpointLinkKey, value);
            const endpointLink = {
              source: sourceIndex,
              target: targetIndex,
              value: value,
              sourceName: sourceTx.from,
              targetName: to,
              description: `Endpoint: ${tx.endpointType || 'Unknown'}`,
              type: 'endpoint',
              confidence: tx.confidence,
              key: `endpoint-${sourceIndex}-${targetIndex}-${linkIndex++}`
            };
            flowData.links.push(endpointLink);
          }
        }
      }
    });

    // Add link from victim to first intermediate node if it doesn't exist
    if (trackedTxs.length > 0) {
      const firstTx = trackedTxs[0];
      const victimWalletLower = victimWallet.toLowerCase();
      const firstTxFromLower = firstTx.from.toLowerCase();
      const firstTxToLower = firstTx.to.toLowerCase();
      
      // Only create victim link if it's a valid forward flow (not a cycle)
      if (firstTxFromLower === victimWalletLower && 
          !existingLinks.has(`${victimWalletLower}-${firstTxToLower}`) &&
          firstTxFromLower !== firstTxToLower) { // Prevent self-loops
        
        const targetIndex = addressToIndex.get(firstTxToLower);
        if (targetIndex !== undefined) {
          const victimLink = {
            source: 0, // victim wallet index
            target: targetIndex,
            value: firstTx.value || 0,
            sourceName: victimWallet,
            targetName: firstTx.to,
            description: 'Initial fund transfer',
            type: 'tracked',
            depth: 0,
            key: `link-victim-${targetIndex}-${linkIndex++}`
          };
          flowData.links.unshift(victimLink);
        }
      }
    }
    
    console.log('🔍 Final sankeyData flowData:', flowData);
    console.log('🔍 Total nodes:', flowData.nodes.length);
    console.log('🔍 Total links:', flowData.links.length);
    console.log('🔍 Total value in links:', flowData.links.reduce((sum, link) => sum + (link.value || 0), 0));

    return flowData;
  }, [analysisData?.detailed_transactions]);

  // Generate colored Sankey data for Nivo
  const coloredSankeyData = useMemo(() => {
    if (!sankeyData) return null;

    // Convert to Nivo format with proper colors
    const nodes = sankeyData.nodes.map((node, index) => {
      let color = COLOR_SCHEME.INTERMEDIATE;
      
      if (node.type === 'victim') {
        color = COLOR_SCHEME.VICTIM;
      } else if (node.type === 'endpoint') {
        color = COLOR_SCHEME.ENDPOINT;
      }
      
      return {
        id: node.name || `node-${index}`,
        label: shortenAddress(node.name || `Node ${index}`),
        color: color,
        key: node.name || `node-${index}`
      };
    });

    const links = sankeyData.links.map((link, index) => {
      const sourceNode = sankeyData.nodes[link.source];
      const targetNode = sankeyData.nodes[link.target];
      
      let linkColor = COLOR_SCHEME.FLOW;
      if (sourceNode?.type === 'endpoint' || targetNode?.type === 'endpoint') {
        linkColor = COLOR_SCHEME.ENDPOINT_FLOW;
      }
      
      return {
        source: sourceNode?.name || `node-${link.source}`,
        target: targetNode?.name || `node-${link.target}`,
        value: link.value || 0,
        color: linkColor,
        key: `${sourceNode?.name || link.source}-${targetNode?.name || link.target}-${index}`
      };
    });

    console.log('🔍 Final coloredSankeyData:', { nodes, links });
    console.log('🔍 Total nodes in colored data:', nodes.length);
    console.log('🔍 Total links in colored data:', links.length);
    console.log('🔍 Total value in colored links:', links.reduce((sum, link) => sum + (link.value || 0), 0));
    
    return { nodes, links };
  }, [sankeyData]);

  return (
    <div className={styles.analyseContainer}>
      {/* Input Section */}
      <div className={styles.inputSection}>
        <h2>Enhanced Fund Flow Analysis</h2>
        
        <div className={styles.inputGroup}>
          <label htmlFor="incidentId">
            Incident ID
          </label>
          <input
            id="incidentId"
            type="text"
            value={incidentId}
            onChange={handleIncidentIdChange}
            placeholder="Enter incident UUID (e.g., 123e4567-e89b-12d3-a456-426614174000)"
            className={styles.inputField}
          />
        </div>
        
        <button 
          onClick={hasCheckedExisting ? forceNewAnalysis : handleAnalyse} 
          disabled={loading || !incidentId}
          className={styles.analyseButton}
        >
          {loading ? 'Running Analysis...' : hasCheckedExisting ? 'Run New Analysis' : 'Start'}
        </button>
        
        {/* Enhanced Fund Flow Algorithm Status */}
        <div className={styles.aiToggleContainer}>
          <div className={styles.aiToggleHeader}>
            <div className={styles.aiToggleIcon}>
              🔍
            </div>
            <div className={styles.aiToggleContent}>
              <div className={styles.aiToggleText}>
                Enhanced Fund Flow Algorithm
              </div>
              <div className={styles.aiToggleDescription}>
                Automatically detects high-activity nodes (&gt;1000 tx) as potential endpoints
              </div>
            </div>
          </div>
          <div className={styles.aiToggleStatus}>
            <div className={`${styles.aiToggleStatusDot} ${styles.aiToggleStatusDotActive}`} />
            <span className={styles.aiToggleStatusText}>
              Active
            </span>
          </div>
        </div>
        
        {error && (
          <div className={styles.errorMessage}>
            {error}
          </div>
        )}
        
        {isRunning && (
          <div className={styles.loadingContainer}>
            <div className={styles.spinner}></div>
            <p>Analysis running in Python microservice...</p>
            {progress && (
              <div className={styles.progressInfo}>
                <p>Status: {progress.status}</p>
                {progress.progress_data && (
                  <p>Progress: {JSON.stringify(progress.progress_data)}</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Existing Analyses Section */}
      {showExistingAnalyses && (
        <div className={styles.historySection}>
          <h3>Analysis History ({existingAnalyses.length} analyses found)</h3>
          <p>Multiple analyses exist for this incident. You can load any of them or run a new analysis.</p>
          {existingAnalyses.length > 0 ? (
            <div className={styles.tableContainer}>
              <table className={styles.dataTable}>
                <thead>
                  <tr>
                    <th>Analysis ID</th>
                    <th>Created</th>
                    <th>Value Traced</th>
                    <th>Addresses</th>
                    <th>Depth</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {existingAnalyses.map((analysis) => {
                    const analysisData = analysis.analysis_data?.enhanced_analysis;
                    return (
                      <tr key={analysis.id}>
                        <td className={styles.addressCell}>
                          {analysis.id.slice(0, 8)}...
                        </td>
                        <td>
                          {new Date(analysis.created_at).toLocaleString()}
                        </td>
                        <td>
                          {analysisData ? formatValue(analysisData.flow_analysis.total_value_traced) : 'N/A'}
                        </td>
                        <td>
                          {analysisData ? analysisData.flow_analysis.total_addresses_analyzed : 'N/A'}
                        </td>
                        <td>
                          {analysisData ? analysisData.flow_analysis.total_depth_reached : 'N/A'}
                        </td>
                        <td>
                          <button 
                            onClick={() => loadAnalysisById(analysis.id)}
                            className={styles.loadButton}
                          >
                            📊 Load
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p>No existing analyses found for this incident.</p>
          )}
        </div>
      )}

      {/* Analysis Results */}
      {analysisData && (
        <div className={styles.resultsSection}>
          <div className={styles.analysisSummary}>
            <h3>Analysis ID: {analysisId}</h3>
            <p>{analysisData.summary}</p>
          </div>

          {/* Flow Analysis Summary */}
          <div className={styles.resultsCard}>
            <h3>Flow Analysis Summary</h3>
            
            <div className={styles.metricsGrid}>
              <div className={styles.metricCard}>
                <div className={styles.metricValue}>
                  {analysisData.flow_analysis.total_depth_reached}
                </div>
                <div className={styles.metricLabel}>Layers Traced</div>
              </div>
              
              <div className={styles.metricCard}>
                <div className={styles.metricValue}>
                  {analysisData.flow_analysis.total_addresses_analyzed}
                </div>
                <div className={styles.metricLabel}>Addresses Analyzed</div>
              </div>
              
              <div className={styles.metricCard}>
                <div className={styles.metricValue}>
                  {formatValue(analysisData.flow_analysis.total_value_traced)}
                </div>
                <div className={styles.metricLabel}>ETH Traced</div>
              </div>
              
              <div className={styles.metricCard}>
                <div className={styles.metricValue}>
                  {analysisData.flow_analysis.high_confidence_paths}
                </div>
                <div className={styles.metricLabel}>High Confidence Paths</div>
              </div>
              
              <div className={styles.metricCard}>
                <div className={styles.metricValue}>
                  {analysisData.flow_analysis.cross_chain_exits}
                </div>
                <div className={styles.metricLabel}>Cross-Chain Exits</div>
              </div>
            </div>
          </div>

          {/* Detected Endpoints */}
          {analysisData.endpoints && analysisData.endpoints.length > 0 && (
            <div className={styles.resultsCard}>
              <h3>Detected Endpoints ({analysisData.endpoints.length})</h3>
              <div className={styles.tableContainer}>
                <table className={styles.dataTable}>
                  <thead>
                    <tr>
                      <th>Address</th>
                      <th>Type</th>
                      <th>Confidence</th>
                      <th>Reasoning</th>
                      <th>Incoming Value</th>
                      <th>Incoming Transaction</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analysisData.endpoints.map((endpoint, index) => (
                      <tr key={index}>
                        <td className={styles.addressCell}>
                          {formatAddress(endpoint.address)}
                        </td>
                        <td>
                          <span className={`${styles.typeBadge} ${styles[endpoint.type.toLowerCase()]}`}>
                            {endpoint.type.toUpperCase()}
                          </span>
                        </td>
                        <td>{formatConfidence(endpoint.confidence)}</td>
                        <td>
                          {endpoint.reasoning.length > 0 ? (
                            <div>
                              {endpoint.reasoning.map((reason, rIndex) => (
                                <span key={rIndex} className={styles.patternBadge}>
                                  {reason}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span style={{ color: '#6b7280' }}>None</span>
                          )}
                        </td>
                        <td>{formatValue(endpoint.incoming_value)}</td>
                        <td>
                          {endpoint.incoming_transaction ? `${endpoint.incoming_transaction.slice(0, 8)}...` : 'N/A'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* High Risk Addresses */}
          {analysisData.risk_assessment.high_risk_addresses.length > 0 && (
            <div className={styles.resultsCard}>
              <h3>High Risk Addresses ({analysisData.risk_assessment.high_risk_addresses.length})</h3>
              
              <div className={styles.tableContainer}>
                <table className={styles.dataTable}>
                  <thead>
                    <tr>
                      <th>Address</th>
                      <th>Risk Score</th>
                      <th>Risk Level</th>
                      <th>Patterns</th>
                      <th>Total Funds</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analysisData.risk_assessment.high_risk_addresses.map((address, index) => (
                      <tr key={index}>
                        <td className={styles.addressCell}>
                          {formatAddress(address.address)}
                        </td>
                        <td>{address.risk_score}</td>
                        <td>
                          <span className={`${styles.riskBadge} ${styles[getRiskLevelText(address.risk_score).toLowerCase()]}`}>
                            {getRiskLevelText(address.risk_score)}
                          </span>
                        </td>
                        <td>
                          {address.patterns.length > 0 ? (
                            <div>
                              {address.patterns.map((pattern, pIndex) => (
                                <span key={pIndex} className={styles.patternBadge}>
                                  {pattern}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span style={{ color: '#6b7280' }}>None detected</span>
                          )}
                        </td>
                        <td>{address.total_funds}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Fund Flow Mapping Diagram */}
          {coloredSankeyData && coloredSankeyData.nodes.length > 0 && (
            <div className={styles.resultsCard}>
              <h3 style={{ margin: '1rem 0', color: '#374151' }}>Fund Flow Mapping Diagram</h3>
              <p style={{ margin: '1rem 0', color: '#6b7280', fontSize: '0.875rem' }}>
                Visual representation of fund flow from victim wallet to endpoints. Flow direction: Left to Right.
              </p>


                


              {/* Validate data before rendering */}
              {(() => {
                const nodeKeys = new Set();
                const linkKeys = new Set();
                let hasDuplicates = false;

                // Check for duplicate node keys
                coloredSankeyData.nodes.forEach(node => {
                  if (nodeKeys.has(node.key)) {
                    console.error('Duplicate node key:', node.key);
                    hasDuplicates = true;
                  }
                  nodeKeys.add(node.key);
                });

                // Check for duplicate link keys
                coloredSankeyData.links.forEach(link => {
                  if (linkKeys.has(link.key)) {
                    console.error('Duplicate link key:', link.key);
                    hasDuplicates = true;
                  }
                  linkKeys.add(link.key);
                });

                if (hasDuplicates) {
                  return (
                    <div style={{ 
                      padding: '1rem', 
                      background: '#fee2e2', 
                      border: '1px solid #fecaca',
                      borderRadius: '6px',
                      color: '#dc2626'
                    }}>
                      Error: Duplicate data detected. Please try refreshing the analysis.
                    </div>
                  );
                }

                return (
                  <>


                    <div style={{ 
                      background: '#f8fafc', 
                      borderRadius: '8px', 
                      padding: '1.5rem',
                      border: '1px solid #e2e8f0'
                    }}>
                      <div style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center', 
                        marginBottom: '1rem',
                        fontSize: '0.9rem',
                        color: '#666'
                      }}>
                        <span><strong>Nodes:</strong> {coloredSankeyData.nodes.length}</span>
                        <span><strong>Links:</strong> {coloredSankeyData.links.length}</span>
                        <span><strong>Total Value:</strong> {formatValue(analysisData.flow_analysis.total_value_traced)} ETH</span>
                      </div>
                      
                      <div style={{ 
                        height: '500px', 
                        width: '100%', 
                        maxHeight: '800px' 
                      }}>
                        <SafeSankey
                          data={coloredSankeyData}
                          method="enhanced"
                          showWarnings={true}
                          onDataProcessed={(result) => {
                            if (result.cycleCount > 0) {
                              console.log(`SafeSankey processed: ${result.cycleCount} circular links removed`);
                            }
                          }}
                          margin={{ top: 40, right: 60, bottom: 40, left: 60 }}
                          align="justify"
                          colors={(node) => {
                            // Custom color scheme matching legend
                            if (node.id === coloredSankeyData.nodes[0]?.id) {
                              return COLOR_SCHEME.VICTIM; // First node = Victim (Blue)
                            } else if (node.id === coloredSankeyData.nodes[coloredSankeyData.nodes.length - 1]?.id) {
                              return COLOR_SCHEME.ENDPOINT; // Last node = Endpoint (Red)
                            } else {
                              return COLOR_SCHEME.INTERMEDIATE; // Middle nodes = Intermediate (Yellow)
                            }
                          }}
                          nodeOpacity={0.9}
                          nodeHoverOthersOpacity={0.35}
                          nodeThickness={20}
                          nodeSpacing={24}
                          nodeBorderWidth={2}
                          nodeBorderColor={{ from: 'color', modifiers: [['darker', 0.8]] }}
                          linkOpacity={0.7}
                          linkHoverOthersOpacity={0.1}
                          linkContract={3}
                          enableLinkGradient={true}
                          labelPosition="outside"
                          labelOrientation="vertical"
                          labelPadding={30}
                          labelTextColor={{ from: 'color', modifiers: [['darker', 1]] }}
                          animate={true}
                          theme={{
                            tooltip: {
                              container: {
                                background: '#ffffff',
                                color: '#333333',
                                fontSize: '12px',
                                borderRadius: '4px',
                                boxShadow: '0 3px 6px rgba(0,0,0,0.3)',
                                border: '1px solid #cccccc'
                              }
                            }
                          }}
                        />
                      </div>
                      
                      {/* Legend Section */}
                      <div style={{ 
                        margin: '1rem 0', 
                        padding: '1rem', 
                        background: '#f8f9fa', 
                        borderRadius: '8px',
                        border: '1px solid #e2e8f0'
                      }}>
                        <div style={{ 
                          color: '#374151', 
                          fontWeight: '600', 
                          fontSize: '0.9rem',
                          marginBottom: '0.75rem',
                          textAlign: 'center'
                        }}>
                          Diagram Legend
                        </div>
                        
                        {/* Legend with exact colors from specification */}
                        <div style={{ 
                          display: 'flex', 
                          justifyContent: 'center',
                          gap: '2rem', 
                          flexWrap: 'wrap',
                          alignItems: 'center',
                          marginBottom: '0.75rem'
                        }}>
                          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            <div style={{ 
                              width: '16px', 
                              height: '16px', 
                              backgroundColor: COLOR_SCHEME.VICTIM, 
                              borderRadius: '3px',
                              border: '1px solid #ddd'
                            }}></div>
                            <span style={{ color: '#374151', fontSize: '0.875rem', fontWeight: '500' }}>Victim Wallet (Blue)</span>
                          </div>
                          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            <div style={{ 
                              width: '16px', 
                              height: '16px', 
                              backgroundColor: COLOR_SCHEME.INTERMEDIATE, 
                              borderRadius: '3px',
                              border: '1px solid #ddd'
                            }}></div>
                            <span style={{ color: '#374151', fontSize: '0.875rem', fontWeight: '500' }}>Intermediate (Yellow)</span>
                          </div>
                          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            <div style={{ 
                              width: '16px', 
                              height: '16px', 
                              backgroundColor: COLOR_SCHEME.ENDPOINT, 
                              borderRadius: '3px',
                              border: '1px solid #ddd'
                            }}></div>
                            <span style={{ color: '#374151', fontSize: '0.875rem', fontWeight: '500' }}>Endpoint (Red)</span>
                          </div>
                        </div>
                        

                        
                        {/* 🔄 NEW: Flow Direction Legend as specified */}
                        <div style={{ 
                          display: 'flex', 
                          justifyContent: 'center',
                          alignItems: 'center',
                          padding: '0.75rem',
                          background: '#e8f4fd',
                          borderRadius: '6px',
                          border: '1px solid #bfdbfe'
                        }}>
                          <div style={{ 
                            display: 'flex', 
                            gap: '0.5rem', 
                            alignItems: 'center',
                            color: '#1e40af',
                            fontSize: '0.875rem',
                            fontWeight: '500'
                          }}>
                            <span>🔄</span>
                            <span><strong>Flow Direction:</strong> Left to Right (Victim → Hacker → Endpoints)</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
          )}

          {/* Pattern Analysis Section */}
          {analysisData && analysisId && (
            <div className={styles.resultsCard}>
              <h3>Advanced Pattern Detection</h3>
              <PatternAnalysis 
                analysisId={analysisId} 
                onAnalysisComplete={(analysis) => {
                  console.log('Pattern analysis completed:', analysis);
                }}
              />
              
              <ClassificationConfidence />
            </div>
          )}

          {/* Transaction List */}
          <div className={styles.resultsCard}>
            <h3>Transaction Details ({analysisData.detailed_transactions.length} transactions)</h3>
            
            {analysisData.detailed_transactions.length > 0 ? (
              <div className={styles.tableContainer}>
                <table className={styles.dataTable}>
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th>Hash</th>
                      <th>From</th>
                      <th>To</th>
                      <th>Value</th>
                      <th>Block</th>
                      <th>Timestamp</th>
                      <th>Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analysisData.detailed_transactions.map((tx, index) => (
                      <tr key={index}>
                        <td>
                          <span className={`${styles.typeBadge} ${styles[tx.type]}`}>
                            {tx.type.toUpperCase()}
                          </span>
                        </td>
                        <td className={styles.hashCell}>
                          {tx.hash ? `${tx.hash.slice(0, 8)}...${tx.hash.slice(-6)}` : 'N/A'}
                        </td>
                        <td className={styles.addressCell}>
                          {formatAddress(tx.from)}
                        </td>
                        <td className={styles.addressCell}>
                          {formatAddress(tx.to)}
                        </td>
                        <td>
                          {tx.value ? formatValue(tx.value) : 'N/A'}
                          {tx.tokenSymbol && ` (${tx.tokenSymbol})`}
                        </td>
                        <td>{tx.blockNumber || 'N/A'}</td>
                        <td>
                          {tx.timestamp && tx.timestamp !== 'N/A' ? new Date(parseInt(tx.timestamp) * 1000).toLocaleString() : 'N/A'}
                        </td>
                        <td>
                          <div className={styles.descriptionCell}>
                            {tx.description || 'No description'}
                            {tx.confidence && (
                              <div className={styles.confidenceBadge}>
                                Confidence: {formatConfidence(tx.confidence)}
                              </div>
                            )}
                            {tx.depth !== undefined && (
                              <div className={styles.depthBadge}>
                                Depth: {tx.depth}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className={styles.emptyState}>
                No transaction data available
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  );
} 