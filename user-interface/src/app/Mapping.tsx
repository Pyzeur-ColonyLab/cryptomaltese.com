"use client";
import React, { useState, useMemo } from 'react';
import styles from './ConsultReport.module.css';
import { ResponsiveSankey } from '@nivo/sankey';
import Modal from './components/Modal';
import { toPng } from 'html-to-image';

// Utility to shorten wallet addresses
function shortenAddress(address: string) {
  if (!address) return '';
  return address.length > 12 ? `${address.slice(0, 6)}...${address.slice(-4)}` : address;
}

// Professional color scheme matching user's request
const COLOR_SCHEME = {
  VICTIM: '#3b82f6',        // Blue for victim wallet
  INTERMEDIATE: '#fbbf24',  // Yellow for intermediate nodes
  ENDPOINT: '#ef4444',      // Red for endpoint nodes
  FLOW: '#3b82f6',          // Blue for tracked flow
  ENDPOINT_FLOW: '#ef4444'  // Red for endpoint flow
};

const Mapping: React.FC = () => {
  const [incidentId, setIncidentId] = useState('');
  const [mappingLoading, setMappingLoading] = useState(false);
  const [mappingError, setMappingError] = useState<string | null>(null);
  const [flows, setFlows] = useState<{ ethFlow: any; internalFlow: any; erc20Flow: any; combinedFlow: any }>({ 
    ethFlow: null, 
    internalFlow: null, 
    erc20Flow: null, 
    combinedFlow: null 
  });
  const [selectedFlow, setSelectedFlow] = useState<'ethFlow' | 'internalFlow' | 'erc20Flow' | 'combinedFlow'>('combinedFlow');
  const [showSankeyModal, setShowSankeyModal] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);

  // Convert data to Nivo Sankey format
  const nivoSankeyData = useMemo(() => {
    const selectedSankeyData = selectedFlow === 'combinedFlow' ? flows.combinedFlow : flows[selectedFlow];
    
    if (!selectedSankeyData?.nodes) return null;

    // Convert to Nivo format
    const nodes = selectedSankeyData.nodes.map((node: any, index: number) => {
      let nodeColor = COLOR_SCHEME.INTERMEDIATE;
      
      // First node is always the victim
      if (index === 0) {
        nodeColor = COLOR_SCHEME.VICTIM;
      }
      // Last nodes are endpoints (approximate by checking if they're on the right side)
      else if (index > selectedSankeyData.nodes.length * 0.7) {
        nodeColor = COLOR_SCHEME.ENDPOINT;
      }
      
      return {
        id: node.name || `node-${index}`,
        label: shortenAddress(node.name || `Node ${index}`),
        color: nodeColor
      };
    });

    const links = selectedSankeyData.links.map((link: any) => {
      const sourceNode = selectedSankeyData.nodes[link.source];
      const targetNode = selectedSankeyData.nodes[link.target];
      
      let linkColor = COLOR_SCHEME.FLOW;
      
      // If target is an endpoint, use endpoint flow color
      if (targetNode && link.target > selectedSankeyData.nodes.length * 0.7) {
        linkColor = COLOR_SCHEME.ENDPOINT_FLOW;
      }
      
      return {
        source: sourceNode?.name || `node-${link.source}`,
        target: targetNode?.name || `node-${link.target}`,
        value: link.value || 0,
        color: linkColor
      };
    });

    return { nodes, links };
  }, [flows, selectedFlow]);

  async function handleGenerateMapping() {
    setMappingLoading(true);
    setMappingError(null);
    setFlows({ ethFlow: null, internalFlow: null, erc20Flow: null, combinedFlow: null });
    try {
      const res = await fetch(`/api/incident/${incidentId}/mapping`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to generate mapping');
      const data = await res.json();
      setFlows({ ethFlow: data.ethFlow, internalFlow: data.internalFlow, erc20Flow: data.erc20Flow, combinedFlow: data.combinedFlow });
    } catch (e: any) {
      setMappingError(e.message);
    } finally {
      setMappingLoading(false);
    }
  }

  const handleOpenSankeyModal = () => setShowSankeyModal(true);
  const handleCloseSankeyModal = () => setShowSankeyModal(false);

  async function handleDownloadComprehensiveReport() {
    setPdfLoading(true);
    try {
      console.log('Starting comprehensive report download...');
      
      // First, generate the Sankey diagram PNG
      const svg = document.querySelector('.nivo-sankey svg');
      let pngDataUrl = null;
      
      if (svg) {
        try {
          console.log('Found SVG element, generating PNG...');
          pngDataUrl = await toPng(svg);
          console.log('Sankey diagram PNG generated successfully, length:', pngDataUrl.length);
        } catch (pngError) {
          console.error('Failed to generate Sankey PNG:', pngError);
        }
      } else {
        console.log('SVG element not found, cannot generate PNG');
      }
      
      // Send the PNG data URL to the report generation
      console.log('Sending POST request to report endpoint...');
      const res = await fetch(`/api/incident/${incidentId}/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          pngDataUrl,
          sankeySummary: flows[selectedFlow]?.summary || 'Fund Flow Mapping'
        }),
      });
      
      console.log('Report response status:', res.status);
      
      if (!res.ok) throw new Error('Failed to generate comprehensive report');
      const blob = await res.blob();
      const link = document.createElement('a');
      link.href = window.URL.createObjectURL(blob);
      link.download = `comprehensive-incident-report-${incidentId}.pdf`;
      link.click();
      console.log('Report downloaded successfully');
    } catch (e) {
      console.error('Failed to download comprehensive report:', e);
      alert('Failed to download comprehensive report: ' + e.message);
    } finally {
      setPdfLoading(false);
    }
  }

  const buttonStyle = {
    width: '100%',
    padding: '16px',
    fontSize: '1.2rem',
    fontWeight: 600,
    background: '#6366f1',
    color: '#fff',
    border: 'none',
    borderRadius: '10px',
    marginTop: 16,
    marginBottom: 0,
    cursor: 'pointer',
    transition: 'background 0.2s',
  } as React.CSSProperties;

  // Check if selected flow is valid
  const isValidSankeyData = nivoSankeyData && nivoSankeyData.nodes.length > 0 && nivoSankeyData.links.length > 0;

  return (
    <>
      <div className={styles.consultBox}>
        <label htmlFor="incidentId">Incident ID</label>
        <input
          id="incidentId"
          type="text"
          value={incidentId}
          onChange={(e) => setIncidentId(e.target.value)}
          placeholder="Enter incident ID"
        />
        <button onClick={handleGenerateMapping} style={buttonStyle}>
          {mappingLoading ? 'Generating...' : 'Generate Mapping'}
        </button>
        {mappingError && <p style={{ color: 'red', marginTop: 8 }}>{mappingError}</p>}
      </div>

      {isValidSankeyData && (
        <div className={styles.consultBox}>
          <h3>Fund Flow Mapping</h3>
          <div style={{ marginBottom: 16 }}>
            <label>Flow Type: </label>
            <select value={selectedFlow} onChange={(e) => setSelectedFlow(e.target.value)}>
              <option value="combinedFlow">Combined Flow</option>
              <option value="ethFlow">ETH Flow</option>
              <option value="internalFlow">Internal Flow</option>
              <option value="erc20Flow">ERC-20 Flow</option>
            </select>
          </div>
          
          {/* Header Information matching CodeSandbox style */}
          <div style={{ 
            background: '#f8fafc', 
            borderRadius: '8px', 
            padding: '16px', 
            border: '1px solid #e2e8f0',
            marginBottom: '16px',
            textAlign: 'center'
          }}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-around', 
              alignItems: 'center',
              marginBottom: '8px',
              fontSize: '16px',
              fontWeight: '600',
              color: '#374151'
            }}>
              <span><strong>Nodes:</strong> {nivoSankeyData.nodes.length}</span>
              <span><strong>Links:</strong> {nivoSankeyData.links.length}</span>
              <span><strong>Total Value:</strong> {nivoSankeyData.links.reduce((sum, link) => sum + (link.value || 0), 0).toFixed(4)} ETH</span>
            </div>
          </div>

          {/* Nivo Sankey Diagram Container */}
          <div style={{ 
            border: '1px solid #e2e8f0', 
            borderRadius: '12px', 
            padding: '20px', 
            backgroundColor: '#ffffff',
            marginBottom: '16px',
            height: '500px'
          }}>
            <ResponsiveSankey
              data={nivoSankeyData}
                                margin={{ top: 40, right: 60, bottom: 40, left: 60 }}
              align="justify"
              colors={(node) => {
                // Custom color scheme matching legend
                if (node.id === nivoSankeyData.nodes[0]?.id) {
                  return COLOR_SCHEME.VICTIM; // First node = Victim (Red)
                } else if (node.id === nivoSankeyData.nodes[nivoSankeyData.nodes.length - 1]?.id) {
                  return COLOR_SCHEME.ENDPOINT; // Last node = Endpoint (Orange)
                } else {
                  return COLOR_SCHEME.INTERMEDIATE; // Middle nodes = Intermediate (Blue)
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
              motionStiffness={140}
              motionDamping={9}
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

          {/* Legend matching CodeSandbox style */}
          <div style={{ 
            margin: '16px 0', 
            padding: '20px', 
            background: '#f8f9fa', 
            borderRadius: '12px',
            border: '1px solid #e2e8f0'
          }}>
            <div style={{ 
              color: '#374151', 
              fontWeight: '600', 
              fontSize: '16px',
              marginBottom: '16px',
              textAlign: 'center'
            }}>
              Diagram Legend
            </div>
            
            {/* Node Types Legend */}
            <div style={{ 
              display: 'flex', 
              justifyContent: 'center',
              gap: '2rem', 
              flexWrap: 'wrap',
              alignItems: 'center',
              marginBottom: '16px'
            }}>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <div style={{ 
                  width: '20px', 
                  height: '20px', 
                  backgroundColor: COLOR_SCHEME.VICTIM, 
                  borderRadius: '4px',
                  border: '1px solid #ddd'
                }}></div>
                <span style={{ color: '#374151', fontSize: '14px', fontWeight: '500' }}>Victim Wallet (Blue)</span>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <div style={{ 
                  width: '20px', 
                  height: '20px', 
                  backgroundColor: COLOR_SCHEME.INTERMEDIATE, 
                  borderRadius: '4px',
                  border: '1px solid #ddd'
                }}></div>
                <span style={{ color: '#374151', fontSize: '14px', fontWeight: '500' }}>Intermediate (Yellow)</span>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <div style={{ 
                  width: '20px', 
                  height: '20px', 
                  backgroundColor: COLOR_SCHEME.ENDPOINT, 
                  borderRadius: '4px',
                  border: '1px solid #ddd'
                }}></div>
                <span style={{ color: '#374151', fontSize: '14px', fontWeight: '500' }}>Endpoint (Red)</span>
              </div>
            </div>
            

            

          </div>

          <button onClick={handleOpenSankeyModal} style={buttonStyle}>
            View Full Diagram
          </button>
          
          <button onClick={handleDownloadComprehensiveReport} style={{
            ...buttonStyle,
            background: '#10b981',
            marginTop: 16
          }}>
            {pdfLoading ? 'Generating Report...' : 'Download Comprehensive Report'}
          </button>
        </div>
      )}

      {/* Sankey Modal */}
      {showSankeyModal && (
        <Modal open={showSankeyModal} onClose={handleCloseSankeyModal} showCloseButton={false} fullScreen={true}>
          <div style={{ 
            width: '100%', 
            height: '100%', 
            padding: '20px',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              marginBottom: '20px',
              padding: '0 20px'
            }}>
              <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 600 }}>Fund Flow Mapping - Full View</h2>
              <button 
                onClick={handleCloseSankeyModal}
                style={{
                  background: '#6366f1',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '12px 20px',
                  fontSize: '16px',
                  cursor: 'pointer',
                  fontWeight: 600
                }}
              >
                Close
              </button>
            </div>
            
            <div style={{ 
              flex: 1,
              border: '1px solid #e2e8f0', 
              borderRadius: '12px', 
              padding: '20px', 
              backgroundColor: '#ffffff',
              overflow: 'hidden'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <span style={{ fontSize: '16px', fontWeight: '600' }}><strong>Nodes:</strong> {nivoSankeyData?.nodes.length}</span>
                <span style={{ fontSize: '16px', fontWeight: '600' }}><strong>Links:</strong> {nivoSankeyData?.links.length}</span>
              </div>
              <div style={{ height: 'calc(100vh - 200px)' }}>
                <ResponsiveSankey
                  data={nivoSankeyData}
                  margin={{ top: 40, right: 60, bottom: 40, left: 60 }}
                  align="justify"
                  colors={(node) => {
                    // Custom color scheme matching legend
                    if (node.id === nivoSankeyData.nodes[0]?.id) {
                      return COLOR_SCHEME.VICTIM; // First node = Victim (Red)
                    } else if (node.id === nivoSankeyData.nodes[nivoSankeyData.nodes.length - 1]?.id) {
                      return COLOR_SCHEME.ENDPOINT; // Last node = Endpoint (Orange)
                    } else {
                      return COLOR_SCHEME.INTERMEDIATE; // Middle nodes = Intermediate (Blue)
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
                  motionStiffness={140}
                  motionDamping={9}
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
            </div>
          </div>
        </Modal>
      )}
    </>
  );
};

export default Mapping; 