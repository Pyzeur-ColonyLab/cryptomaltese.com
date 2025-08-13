import { TransactionPath } from '../types/fund-flow';

export interface PatternDetectionResult {
    patternType: string;
    confidence: number;
    affectedAddresses: string[];
    details: any;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    indicators: string[];
}

export interface AdvancedPatternAnalysis {
    patterns: PatternDetectionResult[];
    overallRiskScore: number;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    patternSummary: string;
    recommendations: string[];
}

export class PatternDetector {
    
    async analyzeAllPaths(paths: TransactionPath[]): Promise<PatternDetectionResult[]> {
        const patterns: PatternDetectionResult[] = [];
        
        // Detect peel chain patterns
        const peelChainPattern = this.detectPeelChainPattern(paths);
        if (peelChainPattern) {
            patterns.push(peelChainPattern);
        }
        
        // Detect rapid movement patterns
        const rapidMovementPattern = this.detectRapidMovementPattern(paths);
        if (rapidMovementPattern) {
            patterns.push(rapidMovementPattern);
        }
        
        // Detect round number patterns
        const roundNumberPattern = this.detectRoundNumberPattern(paths);
        if (roundNumberPattern) {
            patterns.push(roundNumberPattern);
        }
        
        // Detect coordinated movement patterns
        const coordinatedPattern = this.detectCoordinatedMovementPattern(paths);
        if (coordinatedPattern) {
            patterns.push(coordinatedPattern);
        }
        
        // Detect new advanced patterns
        const dustPattern = this.detectDustPattern(paths);
        if (dustPattern) {
            patterns.push(dustPattern);
        }
        
        const layeringPattern = this.detectLayeringPattern(paths);
        if (layeringPattern) {
            patterns.push(layeringPattern);
        }
        
        const smurfingPattern = this.detectSmurfingPattern(paths);
        if (smurfingPattern) {
            patterns.push(smurfingPattern);
        }
        
        const structuringPattern = this.detectStructuringPattern(paths);
        if (structuringPattern) {
            patterns.push(structuringPattern);
        }
        
        return patterns;
    }

    async performAdvancedAnalysis(paths: TransactionPath[]): Promise<AdvancedPatternAnalysis> {
        const patterns = await this.analyzeAllPaths(paths);
        
        // Calculate overall risk score
        const riskScore = this.calculateOverallRiskScore(patterns, paths);
        const riskLevel = this.determineRiskLevel(riskScore);
        
        // Generate pattern summary
        const patternSummary = this.generatePatternSummary(patterns);
        
        // Generate recommendations
        const recommendations = this.generateRecommendations(patterns, riskLevel);
        
        return {
            patterns,
            overallRiskScore: riskScore,
            riskLevel,
            patternSummary,
            recommendations
        };
    }
    
    private detectPeelChainPattern(paths: TransactionPath[]): PatternDetectionResult | null {
        // Group transactions by depth level
        const depthGroups = new Map<number, TransactionPath[]>();
        
        for (const path of paths) {
            if (!depthGroups.has(path.depthLevel)) {
                depthGroups.set(path.depthLevel, []);
            }
            depthGroups.get(path.depthLevel)!.push(path);
        }
        
        // Check for decreasing transaction counts at each depth
        let isPeelChain = true;
        let previousCount = Infinity;
        
        const maxDepth = Math.max(...Array.from(depthGroups.keys()));
        for (let depth = 1; depth <= maxDepth; depth++) {
            const currentCount = depthGroups.get(depth)?.length || 0;
            
            if (currentCount >= previousCount) {
                isPeelChain = false;
                break;
            }
            
            previousCount = currentCount;
        }
        
        if (isPeelChain && depthGroups.size > 2) {
            const confidence = Math.min(0.9, 0.6 + (depthGroups.size * 0.1));
            const riskLevel = depthGroups.size > 4 ? 'high' : depthGroups.size > 3 ? 'medium' : 'low';
            
            return {
                patternType: 'peel_chain',
                confidence,
                affectedAddresses: paths.map(p => p.fromAddress),
                details: {
                    depthLevels: depthGroups.size,
                    transactionDistribution: Array.from(depthGroups.entries()).map(([depth, paths]) => ({
                        depth,
                        count: paths.length
                    }))
                },
                riskLevel,
                description: `Peel chain pattern detected with ${depthGroups.size} depth levels, indicating systematic fund distribution`,
                indicators: ['Decreasing transaction counts', 'Multiple depth levels', 'Systematic distribution']
            };
        }
        
        return null;
    }
    
    private detectRapidMovementPattern(paths: TransactionPath[]): PatternDetectionResult | null {
        // Check for transactions happening in quick succession
        const timeSortedPaths = paths
            .filter(p => p.timestamp)
            .sort((a, b) => a.timestamp!.getTime() - b.timestamp!.getTime());
        
        let rapidMovements = 0;
        const timeThreshold = 5 * 60 * 1000; // 5 minutes
        
        for (let i = 1; i < timeSortedPaths.length; i++) {
            const timeDiff = timeSortedPaths[i].timestamp!.getTime() - timeSortedPaths[i-1].timestamp!.getTime();
            if (timeDiff < timeThreshold) {
                rapidMovements++;
            }
        }
        
        if (rapidMovements > timeSortedPaths.length * 0.3) { // 30% threshold
            const confidence = Math.min(0.9, 0.6 + (rapidMovements / timeSortedPaths.length) * 0.3);
            const riskLevel = rapidMovements > timeSortedPaths.length * 0.5 ? 'high' : 'medium';
            
            return {
                patternType: 'rapid_movement',
                confidence,
                affectedAddresses: timeSortedPaths.map(p => p.fromAddress),
                details: {
                    rapidMovements,
                    totalTransactions: timeSortedPaths.length,
                    percentage: (rapidMovements / timeSortedPaths.length) * 100
                },
                riskLevel,
                description: `Rapid movement pattern detected with ${rapidMovements} transactions in quick succession`,
                indicators: ['Quick succession', 'High frequency', 'Urgent movement indicators']
            };
        }
        
        return null;
    }
    
    private detectRoundNumberPattern(paths: TransactionPath[]): PatternDetectionResult | null {
        // Check for transactions with round number values
        const roundNumberPaths = paths.filter(path => {
            if (!path.valueAmount) return false;
            return this.isRoundNumber(path.valueAmount);
        });
        
        if (roundNumberPaths.length > paths.length * 0.2) { // 20% threshold
            const confidence = Math.min(0.8, 0.5 + (roundNumberPaths.length / paths.length) * 0.3);
            const riskLevel = roundNumberPaths.length > paths.length * 0.4 ? 'medium' : 'low';
            
            return {
                patternType: 'round_numbers',
                confidence,
                affectedAddresses: roundNumberPaths.map(p => p.fromAddress),
                details: {
                    roundNumberCount: roundNumberPaths.length,
                    totalTransactions: paths.length,
                    percentage: (roundNumberPaths.length / paths.length) * 100
                },
                riskLevel,
                description: `Round number pattern detected with ${roundNumberPaths.length} transactions using round values`,
                indicators: ['Round number values', 'Systematic amounts', 'Precise value indicators']
            };
        }
        
        return null;
    }
    
    private detectCoordinatedMovementPattern(paths: TransactionPath[]): PatternDetectionResult | null {
        // Check for coordinated movements to the same destination
        const destinationGroups = new Map<string, TransactionPath[]>();
        
        for (const path of paths) {
            if (!destinationGroups.has(path.toAddress)) {
                destinationGroups.set(path.toAddress, []);
            }
            destinationGroups.get(path.toAddress)!.push(path);
        }
        
        // Look for destinations with multiple incoming transactions from different sources
        const coordinatedDestinations = Array.from(destinationGroups.entries())
            .filter(([_, paths]) => paths.length > 1)
            .filter(([_, paths]) => {
                const uniqueSources = new Set(paths.map(p => p.fromAddress));
                return uniqueSources.size > 1;
            });
        
        if (coordinatedDestinations.length > 0) {
            const confidence = Math.min(0.9, 0.7 + (coordinatedDestinations.length * 0.1));
            const riskLevel = coordinatedDestinations.length > 3 ? 'high' : 'medium';
            
            return {
                patternType: 'coordinated',
                confidence,
                affectedAddresses: coordinatedDestinations.flatMap(([_, paths]) => 
                    paths.map(p => p.fromAddress).concat(paths.map(p => p.toAddress))
                ),
                details: {
                    coordinatedDestinations: coordinatedDestinations.length,
                    destinations: coordinatedDestinations.map(([dest, paths]) => ({
                        address: dest,
                        incomingCount: paths.length,
                        uniqueSources: new Set(paths.map(p => p.fromAddress)).size
                    }))
                },
                riskLevel,
                description: `Coordinated movement pattern detected with ${coordinatedDestinations.length} destinations receiving funds from multiple sources`,
                indicators: ['Multiple sources', 'Coordinated timing', 'Organized movement indicators']
            };
        }
        
        return null;
    }
    
    private isRoundNumber(value: number): boolean {
        // Check if value is a round number (ends with 0s or is a common round number)
        const str = value.toString();
        if (str.endsWith('0')) return true;
        
        // Check for common round numbers
        const commonRoundNumbers = [0.1, 0.5, 1, 2, 5, 10, 50, 100, 500, 1000];
        return commonRoundNumbers.includes(value);
    }

    // New advanced pattern detection methods
    private detectDustPattern(paths: TransactionPath[]): PatternDetectionResult | null {
        const dustThreshold = 0.001; // 0.001 ETH
        const dustTransactions = paths.filter(p => p.valueAmount && p.valueAmount < dustThreshold);
        
        if (dustTransactions.length > paths.length * 0.3) { // 30% threshold
            const confidence = Math.min(0.9, 0.5 + (dustTransactions.length / paths.length) * 0.4);
            
            return {
                patternType: 'dust',
                confidence,
                affectedAddresses: dustTransactions.map(p => p.fromAddress),
                details: {
                    dustCount: dustTransactions.length,
                    totalTransactions: paths.length,
                    percentage: (dustTransactions.length / paths.length) * 100,
                    averageDustValue: dustTransactions.reduce((sum, p) => sum + (p.valueAmount || 0), 0) / dustTransactions.length
                },
                riskLevel: 'medium',
                description: 'High volume of dust transactions detected, potentially indicating micro-laundering',
                indicators: ['Small transaction values', 'High transaction count', 'Micro-laundering indicators']
            };
        }
        
        return null;
    }

    private detectLayeringPattern(paths: TransactionPath[]): PatternDetectionResult | null {
        // Look for complex transaction chains with multiple intermediate addresses
        const depthGroups = new Map<number, TransactionPath[]>();
        
        for (const path of paths) {
            if (!depthGroups.has(path.depthLevel)) {
                depthGroups.set(path.depthLevel, []);
            }
            depthGroups.get(path.depthLevel)!.push(path);
        }
        
        // Check for layering (multiple intermediate steps)
        if (depthGroups.size > 3) {
            const intermediateAddresses = new Set<string>();
            for (let depth = 2; depth < depthGroups.size; depth++) {
                const pathsAtDepth = depthGroups.get(depth) || [];
                pathsAtDepth.forEach(p => intermediateAddresses.add(p.fromAddress));
            }
            
            if (intermediateAddresses.size > 5) {
                return {
                    patternType: 'layering',
                    confidence: 0.8,
                    affectedAddresses: Array.from(intermediateAddresses),
                    details: {
                        depthLevels: depthGroups.size,
                        intermediateAddresses: intermediateAddresses.size,
                        complexity: intermediateAddresses.size * depthGroups.size
                    },
                    riskLevel: 'high',
                    description: 'Complex layering pattern detected with multiple intermediate addresses',
                    indicators: ['Multiple depth levels', 'Many intermediate addresses', 'Complex transaction chains']
                };
            }
        }
        
        return null;
    }

    private detectSmurfingPattern(paths: TransactionPath[]): PatternDetectionResult | null {
        // Look for transactions split into many small amounts
        const valueGroups = new Map<string, TransactionPath[]>();
        
        for (const path of paths) {
            if (path.valueAmount) {
                const valueKey = path.valueAmount.toFixed(6);
                if (!valueGroups.has(valueKey)) {
                    valueGroups.set(valueKey, []);
                }
                valueGroups.get(valueKey)!.push(path);
            }
        }
        
        // Check for many transactions with similar small values
        const smallValueThreshold = 0.01; // 0.01 ETH
        const smallValueTransactions = paths.filter(p => p.valueAmount && p.valueAmount < smallValueThreshold);
        
        if (smallValueTransactions.length > 10 && valueGroups.size > 5) {
            return {
                patternType: 'smurfing',
                confidence: 0.75,
                affectedAddresses: smallValueTransactions.map(p => p.fromAddress),
                details: {
                    smallValueCount: smallValueTransactions.length,
                    uniqueValueCount: valueGroups.size,
                    averageValue: smallValueTransactions.reduce((sum, p) => sum + (p.valueAmount || 0), 0) / smallValueTransactions.length
                },
                riskLevel: 'high',
                description: 'Smurfing pattern detected with many small, similar-value transactions',
                indicators: ['Multiple small transactions', 'Similar transaction values', 'Fund splitting indicators']
            };
        }
        
        return null;
    }

    private detectStructuringPattern(paths: TransactionPath[]): PatternDetectionResult | null {
        // Look for transactions structured to avoid reporting thresholds
        const reportingThreshold = 0.1; // 0.1 ETH
        const belowThresholdTransactions = paths.filter(p => p.valueAmount && p.valueAmount < reportingThreshold);
        
        if (belowThresholdTransactions.length > paths.length * 0.7) { // 70% threshold
            const totalValue = paths.reduce((sum, p) => sum + (p.valueAmount || 0), 0);
            const averageValue = totalValue / paths.length;
            
            if (averageValue < reportingThreshold * 0.8) {
                return {
                    patternType: 'structuring',
                    confidence: 0.85,
                    affectedAddresses: belowThresholdTransactions.map(p => p.fromAddress),
                    details: {
                        belowThresholdCount: belowThresholdTransactions.length,
                        totalTransactions: paths.length,
                        percentage: (belowThresholdTransactions.length / paths.length) * 100,
                        averageValue,
                        totalValue
                    },
                    riskLevel: 'critical',
                    description: 'Structuring pattern detected with transactions designed to avoid reporting thresholds',
                    indicators: ['Below reporting thresholds', 'High transaction volume', 'Avoidance behavior']
                };
            }
        }
        
        return null;
    }

    // Risk assessment methods
    private calculateOverallRiskScore(patterns: PatternDetectionResult[], paths: TransactionPath[]): number {
        let totalScore = 0;
        let maxPossibleScore = 0;
        
        // Base risk from patterns
        for (const pattern of patterns) {
            const patternWeight = this.getPatternWeight(pattern.patternType);
            const riskMultiplier = this.getRiskMultiplier(pattern.riskLevel);
            
            totalScore += pattern.confidence * patternWeight * riskMultiplier;
            maxPossibleScore += patternWeight * riskMultiplier;
        }
        
        // Additional risk factors
        const volumeRisk = this.calculateVolumeRisk(paths);
        const complexityRisk = this.calculateComplexityRisk(paths);
        const timeRisk = this.calculateTimeRisk(paths);
        
        totalScore += volumeRisk + complexityRisk + timeRisk;
        maxPossibleScore += 3; // Max additional risk factors
        
        return Math.min(100, (totalScore / maxPossibleScore) * 100);
    }

    private getPatternWeight(patternType: string): number {
        const weights: { [key: string]: number } = {
            'peel_chain': 1.2,
            'rapid_movement': 1.0,
            'round_numbers': 0.8,
            'coordinated': 1.1,
            'dust': 0.9,
            'layering': 1.3,
            'smurfing': 1.4,
            'structuring': 1.5
        };
        
        return weights[patternType] || 1.0;
    }

    private getRiskMultiplier(riskLevel: string): number {
        const multipliers: { [key: string]: number } = {
            'low': 0.5,
            'medium': 1.0,
            'high': 1.5,
            'critical': 2.0
        };
        
        return multipliers[riskLevel] || 1.0;
    }

    private calculateVolumeRisk(paths: TransactionPath[]): number {
        const totalValue = paths.reduce((sum, p) => sum + (p.valueAmount || 0), 0);
        if (totalValue > 100) return 0.8; // High value
        if (totalValue > 10) return 0.5;  // Medium value
        return 0.2; // Low value
    }

    private calculateComplexityRisk(paths: TransactionPath[]): number {
        const uniqueAddresses = new Set(paths.flatMap(p => [p.fromAddress, p.toAddress])).size;
        if (uniqueAddresses > 20) return 0.8; // High complexity
        if (uniqueAddresses > 10) return 0.5; // Medium complexity
        return 0.2; // Low complexity
    }

    private calculateTimeRisk(paths: TransactionPath[]): number {
        const timeSortedPaths = paths.filter(p => p.timestamp).sort((a, b) => 
            a.timestamp!.getTime() - b.timestamp!.getTime()
        );
        
        if (timeSortedPaths.length < 2) return 0.2;
        
        const totalTime = timeSortedPaths[timeSortedPaths.length - 1].timestamp!.getTime() - 
                         timeSortedPaths[0].timestamp!.getTime();
        const timePerTransaction = totalTime / timeSortedPaths.length;
        
        if (timePerTransaction < 60000) return 0.8; // Very fast
        if (timePerTransaction < 300000) return 0.5; // Fast
        return 0.2; // Normal
    }

    private determineRiskLevel(riskScore: number): 'low' | 'medium' | 'high' | 'critical' {
        if (riskScore >= 80) return 'critical';
        if (riskScore >= 60) return 'high';
        if (riskScore >= 40) return 'medium';
        return 'low';
    }

    private generatePatternSummary(patterns: PatternDetectionResult[]): string {
        if (patterns.length === 0) return 'No suspicious patterns detected';
        
        const patternCounts = patterns.reduce((acc, pattern) => {
            acc[pattern.patternType] = (acc[pattern.patternType] || 0) + 1;
            return acc;
        }, {} as { [key: string]: number });
        
        const patternDescriptions = Object.entries(patternCounts)
            .map(([type, count]) => `${count} ${type.replace('_', ' ')} pattern${count > 1 ? 's' : ''}`)
            .join(', ');
        
        return `Detected ${patterns.length} pattern types: ${patternDescriptions}`;
    }

    private generateRecommendations(patterns: PatternDetectionResult[], riskLevel: string): string[] {
        const recommendations: string[] = [];
        
        if (riskLevel === 'critical' || riskLevel === 'high') {
            recommendations.push('Immediate investigation required');
            recommendations.push('Consider regulatory reporting');
        }
        
        if (patterns.some(p => p.patternType === 'structuring')) {
            recommendations.push('Review for anti-money laundering compliance');
        }
        
        if (patterns.some(p => p.patternType === 'layering')) {
            recommendations.push('Analyze intermediate addresses for suspicious activity');
        }
        
        if (patterns.some(p => p.patternType === 'peel_chain')) {
            recommendations.push('Monitor for continued fund distribution');
        }
        
        if (patterns.some(p => p.patternType === 'smurfing')) {
            recommendations.push('Investigate source of small transactions');
        }
        
        if (recommendations.length === 0) {
            recommendations.push('Continue monitoring for new patterns');
        }
        
        return recommendations;
    }
} 