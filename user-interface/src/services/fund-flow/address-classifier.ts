export interface AddressClassification {
    type: 'exchange' | 'mixer' | 'bridge' | 'defi' | 'wallet' | 'other';
    confidence: number;
    reasoning: string[];
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    keyIndicators: string[];
}

export class AddressClassifier {
    private classificationCache: any;
    
    constructor() {
        // Initialize classification cache
        this.initializeCache();
    }
    
    private async initializeCache() {
        try {
            const { ClassificationCache } = await import('../ai/classification-cache');
            this.classificationCache = new ClassificationCache();
        } catch (error) {
            console.log('Failed to initialize classification cache:', error);
        }
    }
    
    async classifyAddress(address: string, transactions: any[]): Promise<AddressClassification> {
        // Check cache first
        if (this.classificationCache) {
            try {
                const cached = await this.classificationCache.getClassification(address);
                if (cached) {
                    console.log(`✅ Cache hit for ${address}: ${cached.classification} (confidence: ${cached.confidence})`);
                    return {
                        type: cached.classification as any,
                        confidence: cached.confidence,
                        reasoning: [cached.reasoning],
                        riskLevel: cached.riskLevel as any,
                        keyIndicators: cached.keyIndicators
                    };
                }
            } catch (error) {
                console.log('Cache lookup failed:', error);
            }
        }
        
        // Try Claude AI classification (always for testing)
        try {
            console.log(`🤖 Attempting Claude AI classification for ${address} with ${transactions.length} transactions`);
            const aiClassification = await this.classifyWithClaude(address, transactions);
            if (aiClassification && aiClassification.confidence > 0.7) {
                console.log(`✅ Claude classified ${address} as ${aiClassification.type} (confidence: ${aiClassification.confidence})`);
                
                // Cache the result
                if (this.classificationCache) {
                    try {
                        await this.classificationCache.setClassification(
                            address,
                            aiClassification.type,
                            aiClassification.confidence,
                            aiClassification.reasoning.join('; '),
                            aiClassification.riskLevel,
                            aiClassification.keyIndicators,
                            transactions.length
                        );
                    } catch (error) {
                        console.log('Failed to cache classification:', error);
                    }
                }
                
                return aiClassification;
            } else {
                console.log(`⚠️ Claude classification confidence too low: ${aiClassification?.confidence || 'undefined'}`);
            }
        } catch (error: any) {
            console.log(`⚠️ Claude classification failed for ${address}, using heuristics:`, error.message);
        }
        
        // Fallback to heuristics
        const heuristicClassification = this.classifyWithHeuristics(address, transactions);
        
        // Cache heuristic result as well
        if (this.classificationCache) {
            try {
                await this.classificationCache.setClassification(
                    address,
                    heuristicClassification.type,
                    heuristicClassification.confidence,
                    heuristicClassification.reasoning.join('; '),
                    heuristicClassification.riskLevel,
                    heuristicClassification.keyIndicators,
                    transactions.length
                );
            } catch (error) {
                console.log('Failed to cache heuristic classification:', error);
            }
        }
        
        return heuristicClassification;
    }

    private async classifyWithClaude(address: string, transactions: any[]): Promise<AddressClassification> {
        try {
            const { analyzeIncidentWithClaude } = await import('../claude');
            
            const prompt = this.buildClassificationPrompt(address, transactions);
            
            const result = await analyzeIncidentWithClaude(prompt);
            
            if (result.success && result.content) {
                return this.parseClaudeResponse(result.content);
            }
        } catch (error: any) {
            console.log(`Claude API call failed:`, error.message);
        }
        
        throw new Error('Claude classification failed');
    }

    private buildClassificationPrompt(address: string, transactions: any[]): string {
        const stats = this.calculateTransactionStats(transactions);
        
        return `Analyze this Ethereum address and classify its type based on transaction patterns:

Address: ${address}
Transaction Count: ${transactions.length}
Average Transaction Value: ${stats.avgValue} ETH
Unique Counterparties: ${stats.uniqueCounterparties}
Transaction Frequency: ${stats.frequency} tx/day
Value Distribution: ${JSON.stringify(stats.valueDistribution)}
Time Patterns: ${JSON.stringify(stats.timePatterns)}

Transaction Sample (first 20):
${JSON.stringify(transactions.slice(0, 20), null, 2)}

Classify this address as one of:
- exchange: Centralized exchange (high volume, many counterparties, regular patterns)
- mixer: Mixing/tumbling service (privacy-focused, complex patterns)
- bridge: Cross-chain bridge contract (specific contract interactions)
- defi: DeFi protocol (smart contract interactions, yield farming, etc.)
- wallet: Regular user wallet (moderate activity, personal use patterns)
- other: Doesn't fit standard categories

Respond in JSON format:
{
  "classification": "exchange|mixer|bridge|defi|wallet|other",
  "confidence": 0.85,
  "reasoning": ["Brief explanation of classification rationale"],
  "risk_level": "low|medium|high|critical",
  "key_indicators": ["list", "of", "key", "indicators"]
}`;
    }

    private parseClaudeResponse(response: string): AddressClassification {
        try {
            // Extract JSON from response
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('No JSON found in response');
            }
            
            const parsed = JSON.parse(jsonMatch[0]);
            
            return {
                type: parsed.classification || 'other',
                confidence: parsed.confidence || 0.5,
                reasoning: Array.isArray(parsed.reasoning) ? parsed.reasoning : [parsed.reasoning || 'AI analysis'],
                riskLevel: parsed.risk_level || 'medium',
                keyIndicators: Array.isArray(parsed.key_indicators) ? parsed.key_indicators : [parsed.key_indicators || 'AI detected']
            };
        } catch (error: any) {
            console.log('Failed to parse Claude response:', error.message);
            throw new Error('Invalid Claude response format');
        }
    }

    private classifyWithHeuristics(address: string, transactions: any[]): AddressClassification {
        // Calculate transaction statistics
        const stats = this.calculateTransactionStats(transactions);
        
        // Apply classification logic
        if (this.isExchangeAddress(stats)) {
            return {
                type: 'exchange',
                confidence: 0.9,
                reasoning: ['High transaction volume', 'Many unique counterparties', 'Regular transaction patterns'],
                riskLevel: 'low',
                keyIndicators: ['high_volume', 'many_counterparties', 'regular_patterns']
            };
        }
        
        if (this.isMixerAddress(stats)) {
            return {
                type: 'mixer',
                confidence: 0.85,
                reasoning: ['Privacy-focused patterns', 'Complex transaction flows', 'Multiple small transactions'],
                riskLevel: 'high',
                keyIndicators: ['privacy_patterns', 'complex_flows', 'small_transactions']
            };
        }
        
        if (this.isBridgeAddress(stats)) {
            return {
                type: 'bridge',
                confidence: 0.8,
                reasoning: ['Cross-chain contract interactions', 'Specific contract patterns', 'Bridge-like behavior'],
                riskLevel: 'medium',
                keyIndicators: ['cross_chain', 'contract_interactions', 'bridge_patterns']
            };
        }
        
        if (this.isDeFiAddress(stats)) {
            return {
                type: 'defi',
                confidence: 0.75,
                reasoning: ['Smart contract interactions', 'Yield farming patterns', 'DeFi protocol usage'],
                riskLevel: 'medium',
                keyIndicators: ['smart_contracts', 'yield_farming', 'defi_protocols']
            };
        }
        
        if (this.isRegularWallet(stats)) {
            return {
                type: 'wallet',
                confidence: 0.7,
                reasoning: ['Moderate activity', 'Personal use patterns', 'Typical wallet behavior'],
                riskLevel: 'low',
                keyIndicators: ['moderate_activity', 'personal_patterns', 'typical_behavior']
            };
        }
        
        return {
            type: 'other',
            confidence: 0.5,
            reasoning: ['Unusual patterns', 'Difficult to classify', 'Mixed characteristics'],
            riskLevel: 'medium',
            keyIndicators: ['unusual_patterns', 'difficult_classification', 'mixed_characteristics']
        };
    }
    
    private calculateTransactionStats(transactions: any[]) {
        if (transactions.length === 0) {
            return {
                count: 0,
                avgValue: 0,
                uniqueCounterparties: 0,
                frequency: 0,
                valueDistribution: {},
                timePatterns: {}
            };
        }
        
        // Calculate basic statistics
        const values = transactions
            .map(tx => tx.value || 0)
            .filter(v => v > 0);
        
        const avgValue = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
        
        const uniqueCounterparties = new Set(
            transactions.flatMap(tx => [tx.from, tx.to]).filter(addr => addr)
        ).size;
        
        // Calculate frequency (transactions per day)
        const timeRange = this.calculateTimeRange(transactions);
        const frequency = timeRange > 0 ? transactions.length / (timeRange / (24 * 60 * 60 * 1000)) : 0;
        
        // Value distribution analysis
        const valueDistribution = this.analyzeValueDistribution(values);
        
        // Time pattern analysis
        const timePatterns = this.analyzeTimePatterns(transactions);
        
        return {
            count: transactions.length,
            avgValue,
            uniqueCounterparties,
            frequency,
            valueDistribution,
            timePatterns
        };
    }
    
    private isExchangeAddress(stats: any): boolean {
        return (
            stats.count > 1000 && // High transaction count
            stats.uniqueCounterparties > 500 && // Many unique counterparties
            stats.frequency > 10 && // High frequency
            stats.avgValue > 0.1 // Reasonable average value
        );
    }
    
    private isMixerAddress(stats: any): boolean {
        return (
            stats.count > 100 && // Moderate to high count
            stats.uniqueCounterparties > 50 && // Many counterparties
            stats.valueDistribution.smallTransactions > 0.6 && // Many small transactions
            stats.timePatterns.rapidSuccession > 0.3 // Rapid succession patterns
        );
    }
    
    private isBridgeAddress(stats: any): boolean {
        return (
            stats.count > 50 && // Moderate count
            stats.uniqueCounterparties < 100 && // Limited counterparties
            stats.valueDistribution.largeTransactions > 0.4 && // Many large transactions
            stats.timePatterns.periodic > 0.5 // Periodic patterns
        );
    }
    
    private isDeFiAddress(stats: any): boolean {
        return (
            stats.count > 200 && // Moderate to high count
            stats.uniqueCounterparties > 100 && // Many counterparties
            stats.valueDistribution.mediumTransactions > 0.5 && // Medium-sized transactions
            stats.timePatterns.regular > 0.4 // Regular patterns
        );
    }
    
    private isRegularWallet(stats: any): boolean {
        return (
            stats.count < 100 && // Low to moderate count
            stats.uniqueCounterparties < 50 && // Few counterparties
            stats.frequency < 5 && // Low frequency
            stats.avgValue > 0.01 // Reasonable values
        );
    }
    
    private calculateTimeRange(transactions: any[]): number {
        const timestamps = transactions
            .map(tx => tx.timestamp || tx.timeStamp || tx.blockNumber)
            .filter(ts => ts)
            .map(ts => typeof ts === 'string' ? parseInt(ts) * 1000 : ts);
        
        if (timestamps.length < 2) return 0;
        
        const min = Math.min(...timestamps);
        const max = Math.max(...timestamps);
        return max - min;
    }
    
    private analyzeValueDistribution(values: number[]): any {
        if (values.length === 0) return {};
        
        const smallTransactions = values.filter(v => v < 0.01).length / values.length;
        const mediumTransactions = values.filter(v => v >= 0.01 && v < 1).length / values.length;
        const largeTransactions = values.filter(v => v >= 1).length / values.length;
        
        return {
            smallTransactions,
            mediumTransactions,
            largeTransactions
        };
    }
    
    private analyzeTimePatterns(transactions: any[]): any {
        if (transactions.length < 2) return {};
        
        const timestamps = transactions
            .map(tx => tx.timestamp || tx.timeStamp || tx.blockNumber)
            .filter(ts => ts)
            .map(ts => typeof ts === 'string' ? parseInt(ts) * 1000 : ts)
            .sort((a, b) => a - b);
        
        let rapidSuccession = 0;
        let periodic = 0;
        let regular = 0;
        
        // Check for rapid succession (transactions within 1 minute)
        for (let i = 1; i < timestamps.length; i++) {
            if (timestamps[i] - timestamps[i-1] < 60000) {
                rapidSuccession++;
            }
        }
        
        // Check for periodic patterns (transactions at regular intervals)
        const intervals = [];
        for (let i = 1; i < timestamps.length; i++) {
            intervals.push(timestamps[i] - timestamps[i-1]);
        }
        
        const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        const variance = intervals.reduce((sum, interval) => sum + Math.pow(interval - avgInterval, 2), 0) / intervals.length;
        
        if (variance < avgInterval * 0.1) { // Low variance indicates regularity
            regular = 1;
        }
        
        if (intervals.length > 10) {
            const periodicCount = intervals.filter(interval => 
                Math.abs(interval - avgInterval) < avgInterval * 0.2
            ).length;
            periodic = periodicCount / intervals.length;
        }
        
        return {
            rapidSuccession: rapidSuccession / (timestamps.length - 1),
            periodic,
            regular
        };
    }
} 