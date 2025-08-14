'use client';
import { ResponsiveSankey } from '@nivo/sankey';
import { preventCircularLinks, CircularLinkPreventionResult, validateSankeyData } from './CircularLinkPrevention';
import { useState, useEffect } from 'react';

interface SafeSankeyProps {
    data: SankeyData;
    method?: 'simple' | 'enhanced' | 'full';
    showWarnings?: boolean;
    onDataProcessed?: (result: CircularLinkPreventionResult) => void;
    [key: string]: unknown; // Allow passing through other Sankey props
}

export default function SafeSankey({ 
    data, 
    method = 'enhanced', 
    showWarnings = true,
    onDataProcessed,
    ...sankeyProps 
}: SafeSankeyProps) {
    const [safeData, setSafeData] = useState<any>(null);
    const [processingResult, setProcessingResult] = useState<CircularLinkPreventionResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isProcessing, setIsProcessing] = useState(true);

    useEffect(() => {
        setIsProcessing(true);
        setError(null);
        
        try {
            console.log('🔍 SafeSankey received data:', data);
            console.log('🔍 Data structure check:', {
                hasData: !!data,
                hasLinks: !!data.links,
                hasNodes: !!data.nodes,
                linksCount: data.links?.length || 0,
                nodesCount: data.nodes?.length || 0
            });
            
            if (!data.links || !data.nodes) {
                setError('Invalid data structure provided');
                setIsProcessing(false);
                return;
            }

            // Validate data structure first
            const validation = validateSankeyData(data);
            if (!validation.isValid) {
                setError(`Data validation failed: ${validation.errors.join(', ')}`);
                setIsProcessing(false);
                return;
            }

            // Apply circular link prevention
            const result = preventCircularLinks(data);
            console.log('🔍 Circular link prevention result:', result);
            console.log('🔍 Safe data after prevention:', result.data);
            
            setSafeData(result.data);
            setProcessingResult(result);
            setError(null);

            // Notify parent component
            if (onDataProcessed) {
                onDataProcessed(result);
            }

            // Show warnings if enabled
            if (showWarnings && result.cycleCount > 0) {
                console.warn(`SafeSankey: Removed ${result.cycleCount} circular links:`, result.removedLinks);
                if (result.warnings.length > 0) {
                    console.warn('Warnings:', result.warnings);
                }
            }

        } catch (err) {
            setError(`Error processing data: ${err instanceof Error ? err.message : 'Unknown error'}`);
            console.error('SafeSankey error:', err);
        } finally {
            setIsProcessing(false);
        }
    }, [data, method, showWarnings, onDataProcessed]);

    if (error) {
        return (
            <div className="sankey-error">
                <h3>Visualization Error</h3>
                <p>{error}</p>
                <details>
                    <summary>Technical Details</summary>
                    <pre>{JSON.stringify({ data, error }, null, 2)}</pre>
                </details>
            </div>
        );
    }

    if (isProcessing) {
        return (
            <div className="sankey-loading">
                <p>Processing visualization data...</p>
            </div>
        );
    }

    if (!safeData || safeData.nodes.length === 0 || safeData.links.length === 0) {
        console.log('🔍 SafeSankey: No data available after processing:', {
            hasSafeData: !!safeData,
            safeDataNodesCount: safeData?.nodes?.length || 0,
            safeDataLinksCount: safeData?.links?.length || 0
        });
        
        return (
            <div className="sankey-error">
                <h3>No Data Available</h3>
                <p>No valid data to display after circular link prevention.</p>
                {processingResult && processingResult.cycleCount > 0 && (
                    <p>Removed {processingResult.cycleCount} circular links.</p>
                )}
            </div>
        );
    }

    return (
        <div className="safe-sankey-container">
            {showWarnings && processingResult && processingResult.cycleCount > 0 && (
                <div className="sankey-warning">
                    <p>
                        ⚠️ Removed {processingResult.cycleCount} circular links to prevent rendering errors.
                        {processingResult.removedLinks.length > 0 && (
                            <details>
                                <summary>View removed links</summary>
                                <ul>
                                    {processingResult.removedLinks.slice(0, 5).map((link, index) => (
                                        <li key={index}>
                                            {link.source} → {link.target} ({link.reason})
                                        </li>
                                    ))}
                                    {processingResult.removedLinks.length > 5 && (
                                        <li>... and {processingResult.removedLinks.length - 5} more</li>
                                    )}
                                </ul>
                            </details>
                        )}
                    </p>
                </div>
            )}
            
            <ResponsiveSankey
                data={safeData}
                {...sankeyProps}
            />
        </div>
    );
} 