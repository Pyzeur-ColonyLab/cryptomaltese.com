export interface EndpointResult {
    address: string;
    type: string;
    confidence: number;
    reasoning: string[];
    incomingValue: number;
    incomingTransaction: string;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

export class EndpointDetector {
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
    
    async detectEndpoints(
        analysisId: number,
        paths: any[],
        config: any = {}
    ): Promise<EndpointResult[]> {
        const endpoints = new Map<string, EndpointResult>();
        
        // Group transactions by destination address
        const destinationGroups = this.groupByDestination(paths);
        
        // Analyze each destination
        for (const [address, transactions] of Array.from(destinationGroups.entries())) {
            const endpoint = await this.analyzeDestination(address, transactions, config);
            if (endpoint) {
                endpoints.set(address, endpoint);
            }
        }
        
        // Sort by risk level and confidence
        return Array.from(endpoints.values()).sort((a, b) => {
            const riskOrder = { 'critical': 4, 'high': 3, 'medium': 2, 'low': 1 };
            const riskDiff = riskOrder[b.riskLevel] - riskOrder[a.riskLevel];
            if (riskDiff !== 0) return riskDiff;
            return b.confidence - a.confidence;
        });
    }
    
    private groupByDestination(paths: any[]): Map<string, any[]> {
        const groups = new Map<string, any[]>();
        
        for (const path of paths) {
            const dest = path.toAddress || path.to;
            if (!groups.has(dest)) {
                groups.set(dest, []);
            }
            groups.get(dest)!.push(path);
        }
        
        return groups;
    }
    
    private async analyzeDestination(
        address: string, 
        transactions: any[], 
        config: any
    ): Promise<EndpointResult | null> {
        if (transactions.length === 0) return null;
        
        // Check classification cache first
        if (this.classificationCache) {
            try {
                const cached = await this.classificationCache.getClassification(address);
                if (cached && cached.confidence > 0.7) {
                    console.log(`✅ Cache hit for endpoint ${address}: ${cached.classification} (confidence: ${cached.confidence})`);
                    
                    // Calculate incoming value from transactions
                    const incomingValue = transactions.reduce((sum, tx) => {
                        return sum + (tx.valueAmount || parseFloat(tx.value) || 0);
                    }, 0);
                    
                    // Get the main incoming transaction
                    const mainTransaction = transactions.reduce((max, tx) => {
                        const value = tx.valueAmount || parseFloat(tx.value) || 0;
                        return value > max.value ? { ...tx, value } : max;
                    }, { value: 0, hash: '', timestamp: null });
                    
                    return {
                        address,
                        type: cached.classification,
                        confidence: cached.confidence,
                        reasoning: [cached.reasoning],
                        incomingValue,
                        incomingTransaction: mainTransaction.hash,
                        riskLevel: cached.riskLevel as any
                    };
                }
            } catch (error) {
                console.log('Cache lookup failed for endpoint:', error);
            }
        }
        
        // Try Claude AI analysis
        try {
            const aiAnalysis = await this.analyzeWithClaude(address, transactions);
            if (aiAnalysis && aiAnalysis.confidence > 0.8) {
                console.log(`✅ Claude analyzed endpoint ${address} as ${aiAnalysis.type} (confidence: ${aiAnalysis.confidence})`);
                
                // Cache the result
                if (this.classificationCache) {
                    try {
                        await this.classificationCache.setClassification(
                            address,
                            aiAnalysis.type,
                            aiAnalysis.confidence,
                            aiAnalysis.reasoning.join('; '),
                            aiAnalysis.riskLevel,
                            ['AI endpoint analysis'],
                            transactions.length
                        );
                    } catch (error) {
                        console.log('Failed to cache endpoint classification:', error);
                    }
                }
                
                return aiAnalysis;
            }
        } catch (error: any) {
            console.log(`⚠️ Claude endpoint analysis failed for ${address}, using heuristics:`, error.message);
        }
        
        // Fallback to heuristic analysis
        // Calculate incoming value
        const incomingValue = transactions.reduce((sum, tx) => {
            return sum + (tx.valueAmount || parseFloat(tx.value) || 0);
        }, 0);
        
        // Get the main incoming transaction
        const mainTransaction = transactions.reduce((max, tx) => {
            const value = tx.valueAmount || parseFloat(tx.value) || 0;
            return value > max.value ? { ...tx, value } : max;
        }, { value: 0, hash: '', timestamp: null });
        
        // Analyze address characteristics
        const characteristics = await this.analyzeAddressCharacteristics(address, transactions);
        
        // Determine endpoint type
        const endpointType = this.determineEndpointType(characteristics, transactions);
        
        // Calculate confidence
        const confidence = this.calculateConfidence(characteristics, transactions);
        
        // Determine risk level
        const riskLevel = this.determineRiskLevel(endpointType, characteristics, incomingValue);
        
        // Generate reasoning
        const reasoning = this.generateReasoning(endpointType, characteristics, transactions);
        
        // Cache heuristic result
        if (this.classificationCache) {
            try {
                await this.classificationCache.setClassification(
                    address,
                    endpointType,
                    confidence,
                    reasoning.join('; '),
                    riskLevel,
                    ['Heuristic analysis'],
                    transactions.length
                );
            } catch (error) {
                console.log('Failed to cache heuristic endpoint classification:', error);
            }
            }
        
        return {
            address,
            type: endpointType,
            confidence,
            reasoning,
            incomingValue,
            incomingTransaction: mainTransaction.hash,
            riskLevel
        };
    }

    private async analyzeWithClaude(address: string, transactions: any[]): Promise<EndpointResult | null> {
        try {
            const { analyzeIncidentWithClaude } = await import('../claude');
            
            const prompt = this.buildEndpointPrompt(address, transactions);
            
            const result = await analyzeIncidentWithClaude(prompt);
            
            if (result.success && result.content) {
                return this.parseEndpointResponse(result.content, address, transactions);
            }
        } catch (error: any) {
            console.log(`Claude endpoint analysis failed:`, error.message);
        }
        
        throw new Error('Claude endpoint analysis failed');
    }

    private buildEndpointPrompt(address: string, transactions: any[]): string {
        const totalValue = transactions.reduce((sum, tx) => sum + (tx.valueAmount || parseFloat(tx.value) || 0), 0);
        const uniqueCounterparties = new Set(transactions.flatMap(tx => [tx.from, tx.to])).size;
        
        return `Analyze this Ethereum address as a potential fund flow endpoint:

Address: ${address}
Total Incoming Value: ${totalValue} ETH
Transaction Count: ${transactions.length}
Unique Counterparties: ${uniqueCounterparties}

Transaction Sample (first 20):
${JSON.stringify(transactions.slice(0, 20), null, 2)}

Classify this endpoint as one of:
- exchange: Centralized exchange (high volume, many counterparties, regular patterns)
- mixer: Mixing/tumbling service (privacy-focused, complex patterns)
- bridge: Cross-chain bridge contract (specific contract interactions)
- defi: DeFi protocol (smart contract interactions, yield farming, etc.)
- wallet: Regular user wallet (moderate activity, personal use patterns)
- no_outgoing: Address with no outgoing transactions (likely final destination)
- other: Doesn't fit standard categories

Respond in JSON format:
{
  "classification": "exchange|mixer|bridge|defi|wallet|no_outgoing|other",
  "confidence": 0.85,
  "reasoning": ["Brief explanation of classification rationale"],
  "risk_level": "low|medium|high|critical",
  "key_indicators": ["list", "of", "key", "indicators"]
}`;
    }

    private parseEndpointResponse(response: string, address: string, transactions: any[]): EndpointResult {
        try {
            // Extract JSON from response
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('No JSON found in response');
            }
            
            const parsed = JSON.parse(jsonMatch[0]);
            const incomingValue = transactions.reduce((sum, tx) => sum + (tx.valueAmount || parseFloat(tx.value) || 0), 0);
            
            return {
                address,
                type: parsed.classification || 'other',
                confidence: parsed.confidence || 0.5,
                reasoning: Array.isArray(parsed.reasoning) ? parsed.reasoning : [parsed.reasoning || 'AI analysis'],
                incomingValue,
                incomingTransaction: transactions[0]?.hash || 'unknown',
                riskLevel: parsed.risk_level || 'medium'
            };
        } catch (error: any) {
            console.log('Failed to parse Claude endpoint response:', error.message);
            throw new Error('Invalid Claude endpoint response format');
        }
    }
    
    private async analyzeAddressCharacteristics(address: string, transactions: any[]): Promise<any> {
        const characteristics: any = {};
        
        // Transaction count
        characteristics.transactionCount = transactions.length;
        
        // Value analysis
        const values = transactions.map(tx => tx.valueAmount || parseFloat(tx.value) || 0);
        characteristics.totalValue = values.reduce((sum, v) => sum + v, 0);
        characteristics.avgValue = characteristics.totalValue / values.length;
        characteristics.maxValue = Math.max(...values);
        characteristics.minValue = Math.min(...values);
        
        // Time analysis
        const timestamps = transactions
            .map(tx => tx.timestamp || tx.timeStamp)
            .filter(ts => ts)
            .map(ts => typeof ts === 'string' ? parseInt(ts) * 1000 : ts);
        
        if (timestamps.length > 1) {
            characteristics.timeSpan = Math.max(...timestamps) - Math.min(...timestamps);
            characteristics.transactionFrequency = timestamps.length / (characteristics.timeSpan / (24 * 60 * 60 * 1000));
        }
        
        // Address pattern analysis
        characteristics.isContract = await this.isContractAddress(address);
        characteristics.hasCode = await this.hasContractCode(address);
        
        // Known address patterns
        characteristics.isKnownExchange = this.isKnownExchange(address);
        characteristics.isKnownMixer = this.isKnownMixer(address);
        characteristics.isKnownBridge = this.isKnownBridge(address);
        
        return characteristics;
    }
    
    private determineEndpointType(characteristics: any, transactions: any[]): string {
        // Check for known patterns first
        if (characteristics.isKnownExchange) return 'exchange';
        if (characteristics.isKnownMixer) return 'mixer';
        if (characteristics.isKnownBridge) return 'bridge';
        
        // Analyze based on characteristics
        if (characteristics.transactionCount > 1000 && characteristics.transactionFrequency > 10) {
            return 'exchange';
        }
        
        if (characteristics.transactionCount > 100 && characteristics.avgValue < 0.01) {
            return 'mixer';
        }
        
        if (characteristics.isContract && characteristics.hasCode) {
            return 'defi';
        }
        
        if (characteristics.transactionCount < 10 && characteristics.totalValue < 1) {
            return 'wallet';
        }
        
        return 'other';
    }
    
    private calculateConfidence(characteristics: any, transactions: any[]): number {
        let confidence = 0.5; // Base confidence
        
        // Known address confidence
        if (characteristics.isKnownExchange || characteristics.isKnownMixer || characteristics.isKnownBridge) {
            confidence += 0.3;
        }
        
        // Transaction pattern confidence
        if (characteristics.transactionCount > 100) {
            confidence += 0.2;
        }
        
        if (characteristics.transactionFrequency > 5) {
            confidence += 0.1;
        }
        
        // Contract confidence
        if (characteristics.isContract) {
            confidence += 0.1;
        }
        
        // Normalize to 0-1 range
        return Math.min(confidence, 1.0);
    }
    
    private determineRiskLevel(endpointType: string, characteristics: any, incomingValue: number): 'low' | 'medium' | 'high' | 'critical' {
        // Base risk based on endpoint type
        const typeRisk: { [key: string]: number } = {
            'exchange': 1,    // Low risk
            'wallet': 2,      // Medium risk
            'defi': 2,        // Medium risk
            'bridge': 3,      // High risk
            'mixer': 4,       // Critical risk
            'other': 3        // High risk
        };
        
        let riskScore = typeRisk[endpointType] || 3;
        
        // Adjust based on value
        if (incomingValue > 100) {
            riskScore += 1;
        } else if (incomingValue > 10) {
            riskScore += 0.5;
        }
        
        // Adjust based on transaction patterns
        if (characteristics.transactionCount > 1000) {
            riskScore -= 0.5; // High volume suggests legitimate operation
        }
        
        // Map risk score to level
        if (riskScore >= 4) return 'critical';
        if (riskScore >= 3) return 'high';
        if (riskScore >= 2) return 'medium';
        return 'low';
    }
    
    private generateReasoning(endpointType: string, characteristics: any, transactions: any[]): string[] {
        const reasoning: string[] = [];
        
        // Type-based reasoning
        switch (endpointType) {
            case 'exchange':
                reasoning.push('High transaction volume typical of exchanges');
                reasoning.push('Regular transaction patterns');
                break;
            case 'mixer':
                reasoning.push('Privacy-focused transaction patterns');
                reasoning.push('Multiple small transactions');
                break;
            case 'bridge':
                reasoning.push('Cross-chain bridge contract');
                reasoning.push('Specific contract interactions');
                break;
            case 'defi':
                reasoning.push('Smart contract with code');
                reasoning.push('DeFi protocol characteristics');
                break;
            case 'wallet':
                reasoning.push('Low transaction count');
                reasoning.push('Personal wallet patterns');
                break;
            default:
                reasoning.push('Unusual transaction patterns');
                reasoning.push('Difficult to classify');
        }
        
        // Characteristic-based reasoning
        if (characteristics.transactionCount > 100) {
            reasoning.push(`High activity: ${characteristics.transactionCount} transactions`);
        }
        
        if (characteristics.totalValue > 10) {
            reasoning.push(`Significant value: ${characteristics.totalValue.toFixed(4)} ETH`);
        }
        
        if (characteristics.isContract) {
            reasoning.push('Contract address with executable code');
        }
        
        return reasoning;
    }
    
    // Helper methods for address analysis
    
    private async isContractAddress(address: string): Promise<boolean> {
        // This would typically check if the address has contract code
        // For now, return false as placeholder
        return false;
    }
    
    private async hasContractCode(address: string): Promise<boolean> {
        // This would typically check if the address has contract code
        // For now, return false as placeholder
        return false;
    }
    
    private isKnownExchange(address: string): boolean {
        const knownExchanges = [
            '0x3f5CE5FBFe3E9af3971dD833D26bA9b5C936f0bE', // Binance hot wallet
            '0x21a31Ee1afC51d94C2eFcCAa2092aD1028285549', // Binance hot wallet
            '0xdfd5293D8e347dFe59E90eFd55b2956a1343963d', // Binance hot wallet
            '0x56Eddb7aa87536c09CCc2793473599fD21A8b17F', // Binance hot wallet
            '0x9696f59E4d72E237BE84fFD425DCaD154Bf96976', // Binance hot wallet
            '0x4E5B2e1D63A4f2D66e8C3652474E3c79D6f3eE6',  // Binance hot wallet
            '0x3BfC20f0B9aFc74E01b378eE48411C5d8fC3Cc1',  // Binance hot wallet
            '0xBE0eB53F46cd790Cd13851d5EFf43D12404d33E8', // Binance hot wallet
            '0xF977814e90dA44bFA03b6295A0616a897441aceC', // Binance hot wallet
            '0x5a52E96BAcdaBb82fd05763E25335261B270Efcb', // Binance hot wallet
            '0xeb2d81f2b2d80f8e7f6d0f1d9e8c6d0f1d9e8c6', // Placeholder
            '0x1234567890123456789012345678901234567890'  // Placeholder
        ];
        
        return knownExchanges.includes(address.toLowerCase());
    }
    
    private isKnownMixer(address: string): boolean {
        const knownMixers = [
            '0x722122dF12D4e14e13Ac3b6895a86e84145b6967', // Tornado Cash
            '0xDD4c48C0B24039969fC16D1cdF626eaB821d3384', // Tornado Cash
            '0xd47e3DD5491EE122B4E07A6D1637F039DE0d4E5',  // Tornado Cash
            '0x722122dF12D4e14e13Ac3b6895a86e84145b6967', // Tornado Cash
            '0x722122dF12D4e14e13Ac3b6895a86e84145b6967', // Tornado Cash
            '0x722122dF12D4e14e13Ac3b6895a86e84145b6967', // Tornado Cash
            '0x722122dF12D4e14e13Ac3b6895a86e84145b6967', // Tornado Cash
            '0x722122dF12D4e14e13Ac3b6895a86e84145b6967', // Tornado Cash
            '0x722122dF12D4e14e13Ac3b6895a86e84145b6967', // Tornado Cash
            '0x722122dF12D4e14e13Ac3b6895a86e84145b6967', // Tornado Cash
            '0xeb2d81f2b2d80f8e7f6d0f1d9e8c6d0f1d9e8c6', // Placeholder
            '0x1234567890123456789012345678901234567890'  // Placeholder
        ];
        
        return knownMixers.includes(address.toLowerCase());
    }
    
    private isKnownBridge(address: string): boolean {
        const knownBridges = [
            '0x3154Cf16ccdb4C6d922629664174b904d98F2Dd5', // Multichain bridge
            '0x6Bf694a291DF3FeC1f7e69701E3ab6c592435Ae7', // Multichain bridge
            '0x533e3c0e6b48027073b8e9f0c9d033b2b1e6c4d3', // Multichain bridge
            '0x4c2f150fc90fed3d8281114c2349f190cdc542b2', // Multichain bridge
            '0x5c7b7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f', // Placeholder
            '0x6d8e8e8e8e8e8e8e8e8e8e8e8e8e8e8e8e8e8e8e', // Placeholder
            '0x7f9f9f9f9f9f9f9f9f9f9f9f9f9f9f9f9f9f9f9f', // Placeholder
            '0x8a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a', // Placeholder
            '0x9b1b1b1b1b1b1b1b1b1b1b1b1b1b1b1b1b1b1b1b', // Placeholder
            '0xac2c2c2c2c2c2c2c2c2c2c2c2c2c2c2c2c2c2c2c', // Placeholder
            '0xeb2d81f2b2d80f8e7f6d0f1d9e8c6d0f1d9e8c6', // Placeholder
            '0x1234567890123456789012345678901234567890'  // Placeholder
        ];
        
        return knownBridges.includes(address.toLowerCase());
    }
} 