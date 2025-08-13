export interface AddressClassification {
    classification: 'exchange' | 'mixer' | 'bridge' | 'defi' | 'wallet' | 'other';
    confidence: number;
    reasoning: string;
    risk_level: 'low' | 'medium' | 'high' | 'critical';
    key_indicators: string[];
}

export class ClaudeAddressClassifier {
    constructor(private apiKey: string) {}

    async classifyAddress(address: string, transactions: any[]): Promise<AddressClassification> {
        const prompt = this.buildClassificationPrompt(address, transactions);
        
        try {
            const response = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': this.apiKey,
                    'anthropic-version': '2023-06-01'
                },
                body: JSON.stringify({
                    model: 'claude-3-sonnet-20240229',
                    max_tokens: 1000,
                    messages: [{
                        role: 'user',
                        content: prompt
                    }]
                })
            });

            if (!response.ok) {
                throw new Error(`Claude API error: ${response.status} ${response.statusText}`);
            }

            const result = await response.json();
            return this.parseClassificationResponse(result.content[0].text);
        } catch (error) {
            console.error('Claude API call failed:', error);
            // Return fallback classification
            return this.fallbackClassification(address, transactions);
        }
    }

    private buildClassificationPrompt(address: string, transactions: any[]): string {
        const stats = this.calculateTransactionStats(transactions);
        
        return `
Analyze this Ethereum address and classify its type based on transaction patterns:

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
  "reasoning": "Brief explanation of classification rationale",
  "risk_level": "low|medium|high|critical",
  "key_indicators": ["list", "of", "key", "indicators"]
}
`;
    }

    private parseClassificationResponse(responseText: string): AddressClassification {
        try {
            // Try to extract JSON from the response
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                return {
                    classification: parsed.classification || 'other',
                    confidence: parsed.confidence || 0.5,
                    reasoning: parsed.reasoning || 'AI analysis completed',
                    risk_level: parsed.risk_level || 'medium',
                    key_indicators: parsed.key_indicators || []
                };
            }
        } catch (error) {
            console.error('Failed to parse Claude response:', error);
        }
        
        // Fallback if parsing fails
        return {
            classification: 'other',
            confidence: 0.5,
            reasoning: 'AI analysis failed, using fallback classification',
            risk_level: 'medium',
            key_indicators: ['ai_analysis_failed']
        };
    }

    private fallbackClassification(address: string, transactions: any[]): AddressClassification {
        // Simple heuristic-based classification as fallback
        const stats = this.calculateTransactionStats(transactions);
        
        if (stats.count > 1000 && stats.uniqueCounterparties > 500) {
            return {
                classification: 'exchange',
                confidence: 0.7,
                reasoning: 'Fallback: High volume and many counterparties suggest exchange',
                risk_level: 'low',
                key_indicators: ['high_volume', 'many_counterparties']
            };
        }
        
        if (stats.count > 100 && stats.avgValue < 0.01) {
            return {
                classification: 'mixer',
                confidence: 0.6,
                reasoning: 'Fallback: Many small transactions suggest mixing service',
                risk_level: 'high',
                key_indicators: ['many_small_transactions']
            };
        }
        
        if (stats.count < 100) {
            return {
                classification: 'wallet',
                confidence: 0.6,
                reasoning: 'Fallback: Low transaction count suggests personal wallet',
                risk_level: 'low',
                key_indicators: ['low_transaction_count']
            };
        }
        
        return {
            classification: 'other',
            confidence: 0.5,
            reasoning: 'Fallback: Unable to determine classification',
            risk_level: 'medium',
            key_indicators: ['fallback_classification']
        };
    }

    private calculateTransactionStats(transactions: any[]): any {
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
            .map(tx => parseFloat(tx.value || '0'))
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
    
    private calculateTimeRange(transactions: any[]): number {
        const timestamps = transactions
            .map(tx => tx.timeStamp || tx.timestamp)
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
            .map(tx => tx.timeStamp || tx.timestamp)
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