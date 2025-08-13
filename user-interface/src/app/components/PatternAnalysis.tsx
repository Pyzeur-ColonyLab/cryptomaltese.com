'use client';
import { useState, useEffect } from 'react';
import styles from './PatternAnalysis.module.css';

interface PatternDetectionResult {
    patternType: string;
    confidence: number;
    affectedAddresses: string[];
    details: any;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    indicators: string[];
}

interface AdvancedPatternAnalysis {
    patterns: PatternDetectionResult[];
    overallRiskScore: number;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    patternSummary: string;
    recommendations: string[];
}

interface PatternAnalysisProps {
    analysisId: number | string;
    onAnalysisComplete?: (analysis: AdvancedPatternAnalysis) => void;
}

export default function PatternAnalysis({ analysisId, onAnalysisComplete }: PatternAnalysisProps) {
    const [analysis, setAnalysis] = useState<AdvancedPatternAnalysis | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const runPatternAnalysis = async () => {
        setIsLoading(true);
        setError(null);
        
        try {
            const response = await fetch('/api/fund-flow/pattern-analysis', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ analysisId })
            });
            
            if (!response.ok) {
                throw new Error('Pattern analysis failed');
            }
            
            const result = await response.json();
            setAnalysis(result.analysis);
            
            if (onAnalysisComplete) {
                onAnalysisComplete(result.analysis);
            }
            
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const getRiskLevelColor = (riskLevel: string) => {
        switch (riskLevel) {
            case 'critical': return '#dc2626';
            case 'high': return '#ea580c';
            case 'medium': return '#d97706';
            case 'low': return '#16a34a';
            default: return '#6b7280';
        }
    };

    const getPatternIcon = (patternType: string) => {
        switch (patternType) {
            case 'peel_chain': return '🔗';
            case 'rapid_movement': return '⚡';
            case 'round_numbers': return '🔢';
            case 'coordinated': return '🎯';
            case 'dust': return '💨';
            case 'layering': return '🏗️';
            case 'smurfing': return '🧙';
            case 'structuring': return '📊';
            default: return '❓';
        }
    };

    const formatPatternType = (patternType: string) => {
        return patternType.split('_').map(word => 
            word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' ');
    };

    if (error) {
        return (
            <div className={styles.errorContainer}>
                <div className={styles.errorIcon}>❌</div>
                <h3>Pattern Analysis Failed</h3>
                <p>{error}</p>
                <button onClick={runPatternAnalysis} className={styles.retryButton}>
                    Try Again
                </button>
            </div>
        );
    }

    if (!analysis && !isLoading) {
        return (
            <div className={styles.startContainer}>
                <h3>Pattern Detection Analysis</h3>
                <p>Run advanced pattern analysis to detect money laundering patterns</p>
                <button onClick={runPatternAnalysis} className={styles.startButton}>
                    Start Pattern Analysis
                </button>
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className={styles.loadingContainer}>
                <div className={styles.spinner}></div>
                <p>Analyzing transaction patterns...</p>
            </div>
        );
    }

    if (!analysis) return null;

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h2>Pattern Analysis Results</h2>
                <div className={styles.riskScore}>
                    <span>Risk Score:</span>
                    <span 
                        className={styles.scoreValue}
                        style={{ color: getRiskLevelColor(analysis.riskLevel) }}
                    >
                        {analysis.overallRiskScore.toFixed(1)}
                    </span>
                    <span 
                        className={styles.riskLevel}
                        style={{ backgroundColor: getRiskLevelColor(analysis.riskLevel) }}
                    >
                        {analysis.riskLevel.toUpperCase()}
                    </span>
                </div>
            </div>

            <div className={styles.summary}>
                <h3>Pattern Summary</h3>
                <p>{analysis.patternSummary}</p>
            </div>

            <div className={styles.patternsGrid}>
                {analysis.patterns.map((pattern, index) => (
                    <div key={index} className={styles.patternCard}>
                        <div className={styles.patternHeader}>
                            <span className={styles.patternIcon}>
                                {getPatternIcon(pattern.patternType)}
                            </span>
                            <h4>{formatPatternType(pattern.patternType)}</h4>
                            <span 
                                className={styles.confidence}
                                style={{ backgroundColor: getRiskLevelColor(pattern.riskLevel) }}
                            >
                                {(pattern.confidence * 100).toFixed(0)}%
                            </span>
                        </div>
                        
                        <p className={styles.description}>{pattern.description}</p>
                        
                        <div className={styles.indicators}>
                            <strong>Indicators:</strong>
                            <ul>
                                {pattern.indicators.map((indicator, idx) => (
                                    <li key={idx}>{indicator}</li>
                                ))}
                            </ul>
                        </div>
                        
                        <div className={styles.details}>
                            <strong>Details:</strong>
                            <pre>{JSON.stringify(pattern.details, null, 2)}</pre>
                        </div>
                        
                        <div className={styles.affectedAddresses}>
                            <strong>Affected Addresses:</strong>
                            <div className={styles.addressList}>
                                {pattern.affectedAddresses.slice(0, 5).map((address, idx) => (
                                    <span key={idx} className={styles.address}>
                                        {address.slice(0, 8)}...{address.slice(-6)}
                                    </span>
                                ))}
                                {pattern.affectedAddresses.length > 5 && (
                                    <span className={styles.moreAddresses}>
                                        +{pattern.affectedAddresses.length - 5} more
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <div className={styles.recommendations}>
                <h3>Recommendations</h3>
                <ul>
                    {analysis.recommendations.map((rec, index) => (
                        <li key={index} className={styles.recommendation}>
                            {rec}
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
} 