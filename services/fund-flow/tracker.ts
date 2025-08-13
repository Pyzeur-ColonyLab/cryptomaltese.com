import { FundFlowAnalysis, TransactionPath, AnalysisConfig } from '../types/fund-flow';
import { PatternDetector } from './pattern-detector';
import { AddressClassifier } from './address-classifier';
import { PathAnalyzer } from './path-analyzer';

// Define EtherscanService interface locally
interface EtherscanService {
    getTransactions(address: string, timestamp: Date): Promise<any[]>;
    getOutgoingTransactions(address: string): Promise<any[]>;
}

export class FundFlowTracker {
    constructor(
        private etherscanService: EtherscanService,
        private patternDetector: PatternDetector,
        private addressClassifier: AddressClassifier,
        private pathAnalyzer: PathAnalyzer
    ) {}

    async analyzeIncident(
        incidentId: string,
        victimWallet: string,
        lossAmount: string,
        hackTimestamp: Date,
        config: Partial<AnalysisConfig> = {}
    ): Promise<FundFlowAnalysis> {
        
        // Merge with default config
        const fullConfig: AnalysisConfig = {
            maxDepth: 6,
            highVolumeThreshold: 1000,
            timeoutMinutes: 30,
            confidenceThreshold: 0.7,
            enableAIClassification: true,
            patternDetectionEnabled: true,
            ...config
        };
        
        // Create analysis record
        const analysisId = await this.createAnalysisRecord(incidentId, victimWallet, lossAmount, hackTimestamp);
        
        // Start tracking from victim wallet
        const initialTransactions = await this.etherscanService.getTransactions(
            victimWallet, 
            hackTimestamp
        );
        
        // Track through multiple depths
        const allPaths: TransactionPath[] = [];
        await this.trackAtDepth(analysisId, [victimWallet], 1, fullConfig.maxDepth, allPaths, fullConfig);
        
        // Detect patterns across all paths
        const patterns = await this.patternDetector.analyzeAllPaths(allPaths);
        
        // Perform advanced pattern analysis
        const advancedAnalysis = await this.patternDetector.performAdvancedAnalysis(allPaths);
        
        // Identify endpoints
        const endpoints = await this.identifyEndpoints(analysisId, allPaths);
        
        // Generate final analysis with enhanced pattern data
        return this.generateAnalysisResult(analysisId, allPaths, patterns, endpoints, advancedAnalysis);
    }

    private async trackAtDepth(
        analysisId: number,
        addresses: string[],
        currentDepth: number,
        maxDepth: number,
        allPaths: TransactionPath[],
        config: AnalysisConfig
    ): Promise<void> {
        if (currentDepth > maxDepth) return;
        
        const nextLevelAddresses: string[] = [];
        
        for (const address of addresses) {
            const transactions = await this.etherscanService.getOutgoingTransactions(address);
            
            // Check for high-volume address classification
            if (transactions.length > config.highVolumeThreshold) {
                const classification = await this.addressClassifier.classifyAddress(address, transactions);
                await this.cacheClassification(address, classification);
                
                // Adjust tracking strategy based on classification
                if (classification.type === 'exchange' || classification.type === 'mixer') {
                    // Mark as endpoint, don't continue tracking
                    continue;
                }
            }
            
            // Select promising paths using adaptive branching
            const selectedPaths = await this.pathAnalyzer.selectPromisingPaths(transactions, config);
            
            for (const path of selectedPaths) {
                allPaths.push({
                    analysisId,
                    pathId: this.generatePathId(),
                    depthLevel: currentDepth,
                    fromAddress: address,
                    toAddress: path.to,
                    transactionHash: path.hash,
                    valueAmount: path.value,
                    timestamp: path.timestamp,
                    confidenceScore: path.confidence,
                    patterns: path.detectedPatterns,
                    createdAt: new Date()
                });
                
                nextLevelAddresses.push(path.to);
            }
        }
        
        // Continue to next depth
        if (nextLevelAddresses.length > 0) {
            await this.trackAtDepth(analysisId, nextLevelAddresses, currentDepth + 1, maxDepth, allPaths, config);
        }
    }

    private async createAnalysisRecord(
        incidentId: string,
        victimWallet: string,
        lossAmount: string,
        hackTimestamp: Date
    ): Promise<number> {
        // This would typically interact with the database
        // For now, return a mock ID
        return Math.floor(Math.random() * 1000000);
    }

    private generatePathId(): string {
        return `path_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    private async cacheClassification(address: string, classification: any): Promise<void> {
        // Implementation for caching address classifications
        console.log(`Caching classification for ${address}:`, classification);
    }

    private async identifyEndpoints(analysisId: number, allPaths: TransactionPath[]): Promise<any[]> {
        // Implementation for identifying endpoints
        return [];
    }

    private async generateAnalysisResult(
        analysisId: number,
        allPaths: TransactionPath[],
        patterns: any,
        endpoints: any[],
        advancedAnalysis?: any
    ): Promise<FundFlowAnalysis> {
        // Implementation for generating final analysis result
        return {
            id: analysisId,
            incidentId: '',
            status: 'completed',
            progress: 100,
            paths: allPaths,
            patterns: patterns,
            endpoints: endpoints,
            confidenceScore: 0.85,
            createdAt: new Date(),
            completedAt: new Date()
        };
    }
} 