'use client';
import { useState, useEffect } from 'react';
import styles from './ClassificationConfidence.module.css';

interface ClassificationData {
    address: string;
    classification: string;
    confidence: number;
    reasoning: string;
    riskLevel: string;
    keyIndicators: string[];
    transactionCount: number;
    lastUpdated: string;
}

interface CacheStats {
    totalEntries: number;
    expiredEntries: number;
    memoryUsage: number;
    hitRate: number;
}

export default function ClassificationConfidence() {
    const [classifications, setClassifications] = useState<ClassificationData[]>([]);
    const [cacheStats, setCacheStats] = useState<CacheStats | null>(null);
    const [loading, setLoading] = useState(false);
    const [selectedAddress, setSelectedAddress] = useState<string>('');
    const [showCacheStats, setShowCacheStats] = useState(false);

    useEffect(() => {
        loadClassifications();
        loadCacheStats();
    }, []);

    const loadClassifications = async () => {
        setLoading(true);
        try {
            const response = await fetch('/api/ai/classification?action=list');
            if (response.ok) {
                const data = await response.json();
                if (data.success && data.keys) {
                    // Load details for each address
                    const classificationPromises = data.keys.map(async (address: string) => {
                        const detailResponse = await fetch(`/api/ai/classification?action=get&address=${address}`);
                        if (detailResponse.ok) {
                            const detailData = await detailResponse.json();
                            return detailData.classification;
                        }
                        return null;
                    });
                    
                    const results = await Promise.all(classificationPromises);
                    const validClassifications = results.filter(Boolean);
                    setClassifications(validClassifications);
                }
            }
        } catch (error) {
            console.error('Failed to load classifications:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadCacheStats = async () => {
        try {
            const response = await fetch('/api/ai/classification?action=stats');
            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    setCacheStats(data.stats);
                }
            }
        } catch (error) {
            console.error('Failed to load cache stats:', error);
        }
    };

    const clearCache = async () => {
        try {
            const response = await fetch('/api/ai/classification', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'clear' })
            });
            
            if (response.ok) {
                await loadClassifications();
                await loadCacheStats();
            }
        } catch (error) {
            console.error('Failed to clear cache:', error);
        }
    };

    const invalidateClassification = async (address: string) => {
        try {
            const response = await fetch('/api/ai/classification', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'invalidate', address })
            });
            
            if (response.ok) {
                await loadClassifications();
                await loadCacheStats();
            }
        } catch (error) {
            console.error('Failed to invalidate classification:', error);
        }
    };

    const getConfidenceColor = (confidence: number) => {
        if (confidence >= 0.8) return '#10b981'; // Green
        if (confidence >= 0.6) return '#f59e0b'; // Yellow
        return '#ef4444'; // Red
    };

    const getRiskLevelColor = (riskLevel: string) => {
        switch (riskLevel.toLowerCase()) {
            case 'low': return '#10b981';
            case 'medium': return '#f59e0b';
            case 'high': return '#f97316';
            case 'critical': return '#ef4444';
            default: return '#6b7280';
        }
    };

    const formatAddress = (address: string) => {
        return `${address.slice(0, 6)}...${address.slice(-4)}`;
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleString();
    };

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h2>AI Classification Confidence</h2>
                <div className={styles.headerActions}>
                    <button 
                        onClick={() => setShowCacheStats(!showCacheStats)}
                        className={styles.statsButton}
                    >
                        {showCacheStats ? 'Hide' : 'Show'} Cache Stats
                    </button>
                    <button 
                        onClick={clearCache}
                        className={styles.clearButton}
                    >
                        Clear Cache
                    </button>
                </div>
            </div>

            {showCacheStats && cacheStats && (
                <div className={styles.cacheStats}>
                    <h3>Cache Statistics</h3>
                    <div className={styles.statsGrid}>
                        <div className={styles.statItem}>
                            <span className={styles.statLabel}>Total Entries:</span>
                            <span className={styles.statValue}>{cacheStats.totalEntries}</span>
                        </div>
                        <div className={styles.statItem}>
                            <span className={styles.statLabel}>Hit Rate:</span>
                            <span className={styles.statValue}>{(cacheStats.hitRate * 100).toFixed(1)}%</span>
                        </div>
                        <div className={styles.statItem}>
                            <span className={styles.statLabel}>Memory Usage:</span>
                            <span className={styles.statValue}>{(cacheStats.memoryUsage / 1024).toFixed(2)} KB</span>
                        </div>
                        <div className={styles.statItem}>
                            <span className={styles.statLabel}>Expired Entries:</span>
                            <span className={styles.statValue}>{cacheStats.expiredEntries}</span>
                        </div>
                    </div>
                </div>
            )}

            <div className={styles.classificationsList}>
                <h3>Address Classifications ({classifications.length})</h3>
                
                {loading ? (
                    <div className={styles.loading}>Loading classifications...</div>
                ) : classifications.length === 0 ? (
                    <div className={styles.emptyState}>No classifications found in cache</div>
                ) : (
                    <div className={styles.classificationsGrid}>
                        {classifications.map((classification, index) => (
                            <div key={index} className={styles.classificationCard}>
                                <div className={styles.cardHeader}>
                                    <div className={styles.addressInfo}>
                                        <span className={styles.address}>{formatAddress(classification.address)}</span>
                                        <span className={styles.classificationType}>{classification.classification}</span>
                                    </div>
                                    <div className={styles.confidenceIndicator}>
                                        <div 
                                            className={styles.confidenceBar}
                                            style={{ 
                                                width: `${classification.confidence * 100}%`,
                                                backgroundColor: getConfidenceColor(classification.confidence)
                                            }}
                                        />
                                        <span className={styles.confidenceText}>
                                            {(classification.confidence * 100).toFixed(0)}%
                                        </span>
                                    </div>
                                </div>
                                
                                <div className={styles.cardBody}>
                                    <div className={styles.riskLevel}>
                                        <span 
                                            className={styles.riskBadge}
                                            style={{ backgroundColor: getRiskLevelColor(classification.riskLevel) }}
                                        >
                                            {classification.riskLevel.toUpperCase()}
                                        </span>
                                    </div>
                                    
                                    <div className={styles.reasoning}>
                                        <strong>Reasoning:</strong> {classification.reasoning}
                                    </div>
                                    
                                    <div className={styles.indicators}>
                                        <strong>Key Indicators:</strong>
                                        <ul>
                                            {classification.keyIndicators.map((indicator, idx) => (
                                                <li key={idx}>{indicator}</li>
                                            ))}
                                        </ul>
                                    </div>
                                    
                                    <div className={styles.metadata}>
                                        <span>Transactions: {classification.transactionCount}</span>
                                        <span>Updated: {formatDate(classification.lastUpdated)}</span>
                                    </div>
                                </div>
                                
                                <div className={styles.cardActions}>
                                    <button 
                                        onClick={() => setSelectedAddress(classification.address)}
                                        className={styles.viewButton}
                                    >
                                        View Details
                                    </button>
                                    <button 
                                        onClick={() => invalidateClassification(classification.address)}
                                        className={styles.invalidateButton}
                                    >
                                        Invalidate
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {selectedAddress && (
                <div className={styles.modal}>
                    <div className={styles.modalContent}>
                        <div className={styles.modalHeader}>
                            <h3>Classification Details</h3>
                            <button 
                                onClick={() => setSelectedAddress('')}
                                className={styles.closeButton}
                            >
                                ×
                            </button>
                        </div>
                        <div className={styles.modalBody}>
                            <p><strong>Address:</strong> {selectedAddress}</p>
                            <p><strong>Full Address:</strong> {selectedAddress}</p>
                            {/* Add more detailed information here */}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
} 