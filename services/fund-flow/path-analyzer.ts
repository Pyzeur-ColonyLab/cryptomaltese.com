export interface PromisingPath {
    to: string;
    hash: string;
    value: number;
    timestamp: Date;
    confidence: number;
    detectedPatterns: any;
}

export class PathAnalyzer {
    
    async selectPromisingPaths(
        transactions: any[], 
        config: any
    ): Promise<PromisingPath[]> {
        if (transactions.length === 0) {
            return [];
        }
        
        // Filter and score transactions
        const scoredPaths = transactions
            .filter(tx => this.isValidTransaction(tx))
            .map(tx => this.scoreTransaction(tx, config))
            .filter(path => path.confidence > 0.3); // Minimum confidence threshold
        
        // Sort by confidence score (descending)
        scoredPaths.sort((a, b) => b.confidence - a.confidence);
        
        // Apply adaptive branching strategy
        const maxPaths = this.calculateMaxPaths(config, scoredPaths.length);
        
        // Select top paths with diversity considerations
        return this.selectDiversePaths(scoredPaths.slice(0, maxPaths));
    }
    
    private isValidTransaction(tx: any): boolean {
        return (
            tx.to && 
            tx.to !== '0x0000000000000000000000000000000000000000' && // Not burn address
            tx.value && 
            parseFloat(tx.value) > 0 && // Positive value
            tx.hash // Has transaction hash
        );
    }
    
    private scoreTransaction(tx: any, config: any): PromisingPath {
        let confidence = 0.5; // Base confidence
        const detectedPatterns: any = {};
        
        // Value-based scoring
        const value = parseFloat(tx.value);
        if (value > 1) {
            confidence += 0.2; // High value transactions
            detectedPatterns.highValue = true;
        } else if (value > 0.1) {
            confidence += 0.1; // Medium value transactions
        }
        
        // Time-based scoring
        if (tx.timeStamp) {
            const txTime = parseInt(tx.timeStamp) * 1000;
            const now = Date.now();
            const timeDiff = now - txTime;
            
            if (timeDiff < 24 * 60 * 60 * 1000) { // Within 24 hours
                confidence += 0.15; // Recent transactions
                detectedPatterns.recent = true;
            } else if (timeDiff < 7 * 24 * 60 * 60 * 1000) { // Within a week
                confidence += 0.1; // Recent transactions
            }
        }
        
        // Gas-based scoring (if available)
        if (tx.gasPrice && tx.gasUsed) {
            const gasPrice = parseInt(tx.gasPrice);
            if (gasPrice > 20000000000) { // > 20 gwei
                confidence += 0.1; // High gas price indicates urgency
                detectedPatterns.highGas = true;
            }
        }
        
        // Contract interaction scoring
        if (tx.input && tx.input !== '0x') {
            confidence += 0.05; // Contract interaction
            detectedPatterns.contractInteraction = true;
        }
        
        // Address pattern scoring
        if (this.hasSuspiciousPatterns(tx)) {
            confidence += 0.1; // Suspicious patterns
            detectedPatterns.suspiciousPatterns = true;
        }
        
        // Normalize confidence to 0-1 range
        confidence = Math.min(confidence, 1.0);
        
        return {
            to: tx.to,
            hash: tx.hash,
            value: value,
            timestamp: tx.timeStamp ? new Date(parseInt(tx.timeStamp) * 1000) : new Date(),
            confidence: confidence,
            detectedPatterns: detectedPatterns
        };
    }
    
    private hasSuspiciousPatterns(tx: any): boolean {
        // Check for known suspicious patterns
        const suspiciousPatterns = [
            '0x0000000000000000000000000000000000000000', // Burn address
            '0x1111111254fb6c44bAC0beD2854e76F90643097d', // 1inch router
            '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D', // Uniswap V2 router
            '0xE592427A0AEce92De3Edee1F18E0157C05861564'  // Uniswap V3 router
        ];
        
        return suspiciousPatterns.includes(tx.to);
    }
    
    private calculateMaxPaths(config: any, totalTransactions: number): number {
        // Adaptive branching based on available transactions and depth
        const baseMaxPaths = config.maxPaths || 10;
        const maxPaths = Math.min(baseMaxPaths, totalTransactions);
        
        // Ensure we don't exceed reasonable limits
        return Math.min(maxPaths, 50);
    }
    
    private selectDiversePaths(paths: PromisingPath[]): PromisingPath[] {
        if (paths.length <= 3) {
            return paths; // Return all if few paths
        }
        
        const selected: PromisingPath[] = [];
        const usedAddresses = new Set<string>();
        
        // First, select the highest confidence path
        if (paths.length > 0) {
            selected.push(paths[0]);
            usedAddresses.add(paths[0].to);
        }
        
        // Then select diverse paths (different destinations)
        for (const path of paths.slice(1)) {
            if (selected.length >= 5) break; // Limit to 5 paths
            
            if (!usedAddresses.has(path.to)) {
                selected.push(path);
                usedAddresses.add(path.to);
            }
        }
        
        // If we still have room, add more high-confidence paths
        for (const path of paths.slice(1)) {
            if (selected.length >= 5) break;
            
            if (!selected.some(p => p.hash === path.hash)) {
                selected.push(path);
            }
        }
        
        return selected;
    }
    
    // Additional utility methods for path analysis
    
    public analyzePathComplexity(paths: PromisingPath[]): number {
        if (paths.length === 0) return 0;
        
        const uniqueDestinations = new Set(paths.map(p => p.to)).size;
        const avgConfidence = paths.reduce((sum, p) => sum + p.confidence, 0) / paths.length;
        const valueVariance = this.calculateValueVariance(paths.map(p => p.value));
        
        // Complexity score based on diversity and confidence
        return (uniqueDestinations / paths.length) * avgConfidence * (1 + valueVariance);
    }
    
    private calculateValueVariance(values: number[]): number {
        if (values.length < 2) return 0;
        
        const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
        const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
        
        return Math.sqrt(variance) / mean; // Coefficient of variation
    }
    
    public detectAnomalies(paths: PromisingPath[]): any[] {
        const anomalies: any[] = [];
        
        // Detect unusual value distributions
        const values = paths.map(p => p.value);
        const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
        const stdDev = Math.sqrt(
            values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length
        );
        
        paths.forEach(path => {
            const zScore = Math.abs(path.value - mean) / stdDev;
            if (zScore > 2) { // More than 2 standard deviations
                anomalies.push({
                    type: 'value_anomaly',
                    path: path,
                    zScore: zScore,
                    description: `Value ${path.value} is ${zScore.toFixed(2)} standard deviations from mean`
                });
            }
        });
        
        // Detect timing anomalies
        const timestamps = paths.map(p => p.timestamp.getTime()).sort((a, b) => a - b);
        if (timestamps.length > 1) {
            const intervals = [];
            for (let i = 1; i < timestamps.length; i++) {
                intervals.push(timestamps[i] - timestamps[i-1]);
            }
            
            const avgInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
            
            intervals.forEach((interval, index) => {
                if (interval < avgInterval * 0.1) { // Very rapid succession
                    anomalies.push({
                        type: 'timing_anomaly',
                        path: paths[index + 1],
                        interval: interval,
                        description: `Transaction occurred ${interval}ms after previous (much faster than average ${avgInterval}ms)`
                    });
                }
            });
        }
        
        return anomalies;
    }
} 