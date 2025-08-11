"use client";
import React, { useState } from 'react';
import styles from './ConsultReport.module.css';

function extractSummary(aiResult: any): string {
  if (aiResult && aiResult.content && Array.isArray(aiResult.content)) {
    const textObj = aiResult.content.find((c: any) => c.type === 'text');
    if (textObj && textObj.text) {
      try {
        // Try to parse the entire text as JSON first
        const parsed = JSON.parse(textObj.text);
        if (parsed.natural_language_summary) return parsed.natural_language_summary;
        if (parsed.executive_summary) return parsed.executive_summary;
      } catch {
        // If not valid JSON, try to extract JSON block
        const jsonMatch = textObj.text.match(/JSON Output:\n({[\s\S]*?})\n/);
        if (jsonMatch) {
          try {
            const parsed = JSON.parse(jsonMatch[1]);
            if (parsed.natural_language_summary) return parsed.natural_language_summary;
            if (parsed.executive_summary) return parsed.executive_summary;
          } catch {}
        }
        
        // Fallback: extract 'Natural Language Summary for Investigator' section
        const nlsInvestigator = textObj.text.match(/Natural Language Summary for Investigator:\n([\s\S]*)/);
        if (nlsInvestigator) return nlsInvestigator[1].trim();
        
        // Remove JSON Output and everything up to the next summary
        let text = textObj.text.replace(/JSON Output:[\s\S]*?\n\n/, '');
        // Remove any remaining JSON block
        text = text.replace(/\{[\s\S]*?\}\n?/, '');
        // Fallback: extract 'Natural Language Summary' section
        const nlsMatch = text.match(/Natural Language Summary:\n([\s\S]*)/);
        if (nlsMatch) return nlsMatch[1].trim();
        // Fallback: extract 'summary:' line
        const summaryMatch = text.match(/summary\s*[:=]\s*"([^"]+)"/i);
        if (summaryMatch) return summaryMatch[1];
        return text.trim();
      }
    }
  }
  return 'No summary found.';
}

function extractDetailedAnalysis(aiResult: any): any {
  if (aiResult && aiResult.content && Array.isArray(aiResult.content)) {
    const textObj = aiResult.content.find((c: any) => c.type === 'text');
    if (textObj && textObj.text) {
      try {
        // Try to parse the entire text as JSON first
        return JSON.parse(textObj.text);
      } catch {
        // If not valid JSON, try to extract JSON block
        const jsonMatch = textObj.text.match(/JSON Output:\n({[\s\S]*?})\n/);
        if (jsonMatch) {
          try {
            return JSON.parse(jsonMatch[1]);
          } catch {}
        }
      }
    }
  }
  return null;
}

// Pagination component for analysis blocks
function PaginatedBlock({ title, content, itemsPerPage = 5 }: { title: string, content: any, itemsPerPage?: number }) {
  const [currentPage, setCurrentPage] = useState(1);
  
  if (!content) return null;
  
  // Handle different content types
  let contentArray: any[] = [];
  
  if (Array.isArray(content)) {
    contentArray = content;
  } else if (typeof content === 'object') {
    // Convert object to array of key-value pairs
    contentArray = Object.entries(content).map(([key, value]) => ({
      key,
      value,
      display: `${key}: ${typeof value === 'string' ? value : JSON.stringify(value)}`
    }));
  } else {
    contentArray = [content];
  }
  
  const totalPages = Math.ceil(contentArray.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentItems = contentArray.slice(startIndex, endIndex);
  
  return (
    <div style={{ marginBottom: '20px' }}>
      <h3 style={{ color: '#333', marginBottom: '10px' }}>{title}</h3>
      <div style={{ marginBottom: '10px' }}>
        {currentItems.map((item: any, index: number) => (
          <div key={index} style={{ 
            padding: '10px', 
            marginBottom: '8px', 
            backgroundColor: '#f8f9fa', 
            borderRadius: '5px',
            border: '1px solid #e9ecef'
          }}>
            {item.display ? (
              <p style={{ margin: 0, lineHeight: '1.5' }}>{item.display}</p>
            ) : typeof item === 'string' ? (
              <p style={{ margin: 0, lineHeight: '1.5' }}>{item}</p>
            ) : typeof item === 'object' && item !== null ? (
              <div>
                {Object.entries(item).map(([key, value], subIndex) => (
                  <div key={subIndex} style={{ marginBottom: '5px' }}>
                    <strong>{key}:</strong>{' '}
                    {typeof value === 'string' ? (
                      <span>{value}</span>
                    ) : Array.isArray(value) ? (
                      <span>{value.join(', ')}</span>
                    ) : (
                      <pre style={{ 
                        margin: '5px 0 0 0', 
                        fontSize: '11px', 
                        overflow: 'auto',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        backgroundColor: '#fff',
                        padding: '5px',
                        borderRadius: '3px',
                        border: '1px solid #dee2e6'
                      }}>
                        {JSON.stringify(value, null, 2)}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <pre style={{ 
                margin: 0, 
                fontSize: '12px', 
                overflow: 'auto',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word'
              }}>
                {JSON.stringify(item, null, 2)}
              </pre>
            )}
          </div>
        ))}
      </div>
      {totalPages > 1 && (
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          gap: '10px',
          marginTop: '10px'
        }}>
          <button
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
            style={{
              padding: '5px 10px',
              border: '1px solid #ddd',
              borderRadius: '3px',
              backgroundColor: currentPage === 1 ? '#f5f5f5' : '#fff',
              cursor: currentPage === 1 ? 'not-allowed' : 'pointer'
            }}
          >
            Previous
          </button>
          <span style={{ fontSize: '14px' }}>
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages}
            style={{
              padding: '5px 10px',
              border: '1px solid #ddd',
              borderRadius: '3px',
              backgroundColor: currentPage === totalPages ? '#f5f5f5' : '#fff',
              cursor: currentPage === totalPages ? 'not-allowed' : 'pointer'
            }}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

// Sankey diagram rendering
// NOTE: Requires 'recharts' package. Install with: npm install recharts
import { Sankey, Tooltip, ResponsiveContainer } from 'recharts';
import Modal from './components/Modal';

export default function ConsultReport() {
  const [incidentId, setIncidentId] = useState('');
  const [loading, setLoading] = useState(false);
  const [aiResult, setAiResult] = useState<any>(null);
  const [mappingData, setMappingData] = useState<any>(null);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [reportReady, setReportReady] = useState(false);

  async function handleGenerate() {
    setError('');
    setAiResult(null);
    setMappingData(null);
    setShowModal(false);
    setReportReady(false);
    if (!incidentId) {
      setError('Please enter an Incident ID.');
      return;
    }
    setLoading(true);
    
    // Set a timeout for the entire operation
    const timeoutId = setTimeout(() => {
      setLoading(false);
      setError('Analysis timed out after 3 minutes. Please try again.');
    }, 180000); // 3 minutes
    
    try {
      console.log('Starting analysis request...');
      const res = await fetch(`/api/incident/${incidentId}/analyze`, { 
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      clearTimeout(timeoutId);
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || errorData.details || `HTTP ${res.status}: ${res.statusText}`);
      }
      
      const data = await res.json();
      if (!data.ai) {
        throw new Error('No analysis data received from server');
      }
      
      console.log('Analysis completed successfully');
      setAiResult(data.ai);
      setMappingData(data.mappingData);
      setReportReady(true);
    } catch (e: any) {
      clearTimeout(timeoutId);
      console.error('Analysis failed:', e);
      setError(e.message || 'Failed to generate report. Please try again.');
    }
    setLoading(false);
  }

  function handleConsult() {
    setShowModal(true);
  }

  function handleDownloadPDF() {
    if (incidentId) {
      window.open(`/api/incident/${incidentId}/report`, '_blank');
    }
  }

  const detailedAnalysis = extractDetailedAnalysis(aiResult);

  return (
    <>
      <div className={styles.consultBox}>
        <label htmlFor="incidentId">Incident ID</label>
        <input
          id="incidentId"
          type="text"
          value={incidentId}
          onChange={e => setIncidentId(e.target.value)}
          placeholder="Paste incident UUID..."
          className={styles.input}
        />
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
          <button onClick={handleGenerate} disabled={loading || !incidentId} style={{
            width: '100%',
            padding: '16px',
            fontSize: '1.2rem',
            fontWeight: 600,
            background: loading ? '#9ca3af' : '#6366f1',
            color: '#fff',
            border: 'none',
            borderRadius: '10px',
            marginTop: 16,
            marginBottom: 0,
            cursor: loading ? 'not-allowed' : 'pointer',
            transition: 'background 0.2s',
          }}>
            {loading ? 'Analyzing incident data... (this may take 1-2 minutes)' : 'Generate comprehensive report'}
          </button>
        </div>
        {error && <div className={styles.error}>{error}</div>}
        {reportReady && (
          <div style={{display: 'flex', gap: '1rem', marginTop: '1rem'}}>
            <button className={styles.closeBtn} onClick={handleConsult}>Consult detailed report</button>
            <button className={styles.closeBtn} onClick={handleDownloadPDF}>Download comprehensive PDF</button>
          </div>
        )}
      </div>
      <Modal open={showModal && !!aiResult} onClose={() => setShowModal(false)}>
        <div style={{ maxHeight: '70vh', overflowY: 'auto', padding: '20px' }}>
          <h2 style={{ color: '#6366f1', marginBottom: '20px' }}>Analysis Report</h2>
          
          {/* Natural Language Summary */}
          <div style={{ marginBottom: '20px' }}>
            <h3 style={{ color: '#333', marginBottom: '10px' }}>Summary</h3>
            <div className={styles.summaryText}>{extractSummary(aiResult)}</div>
          </div>
        </div>
        <div style={{display: 'flex', gap: '1rem'}}>
          <button className={styles.closeBtn} onClick={() => setShowModal(false)}>Close</button>
        </div>
      </Modal>
    </>
  );
} 