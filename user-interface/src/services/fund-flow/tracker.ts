import { FundFlowAnalysis, TransactionPath, AnalysisConfig } from '../types/fund-flow';
import { PatternDetector } from './pattern-detector';
import { AddressClassifier } from './address-classifier';
import { PathAnalyzer } from './path-analyzer';

// Define EtherscanService interface locally
interface EtherscanService {
    getTransactions(address: string, timestamp: Date): Promise<any[]>;
    getOutgoingTransactions(address: string, minBlockNumber?: number): Promise<any[]>;
    getTransactionByHash(hash: string): Promise<any>;
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
        hackTransactionHash: string,
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
        
        // Find the specific hack transaction and get its destination
        const hackTransaction = await this.findHackTransaction(victimWallet, hackTransactionHash);
        if (!hackTransaction) {
            throw new Error(`Hack transaction ${hackTransactionHash} not found for wallet ${victimWallet}`);
        }
        
        console.log(`🔍 Found hack transaction: ${hackTransactionHash} -> ${hackTransaction.to}`);
        console.log(`💰 Transaction value: ${hackTransaction.value} ETH`);
        
        // Start tracking from the destination of the hack transaction (not the victim wallet)
        const startingAddress = hackTransaction.to;
        console.log(`🚀 Starting fund flow analysis from: ${startingAddress}`);
        console.log(`📊 This is the FIRST NODE (hack destination) - will be processed normally`);
        
        // Track through multiple depths starting from the hack destination
        const allPaths: TransactionPath[] = [];
        
        // Initialize block number tracking for the first node
        const initialBlockNumbers = new Map<string, number>();
        initialBlockNumbers.set(startingAddress, parseInt(hackTransaction.blockNumber, 16));
        
        console.log(`🔍 Starting with block number threshold: ${parseInt(hackTransaction.blockNumber, 16)}`);
        
        await this.trackAtDepth(analysisId, [startingAddress], 1, fullConfig.maxDepth, allPaths, fullConfig, initialBlockNumbers);
        
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
        config: AnalysisConfig,
        parentBlockNumbers: Map<string, number> = new Map()
    ): Promise<void> {
        if (currentDepth > maxDepth) return;
        
        const nextLevelAddresses: string[] = [];
        
        console.log(`🔍 Processing ${addresses.length} addresses at depth ${currentDepth}`);
        
        for (const address of addresses) {
            console.log(`  📍 Processing address: ${address} at depth ${currentDepth}`);
            if (currentDepth === 1) {
                console.log(`    🎯 FIRST NODE: This is the hack destination address`);
            }
            
            // Get the minimum block number threshold for this address
            const minBlockThreshold = parentBlockNumbers.get(address) || 0;
            console.log(`    📊 Block number threshold for ${address}: ${minBlockThreshold}`);
            
            // Get transactions with progressive block filtering
            const transactions = await this.etherscanService.getOutgoingTransactions(address, minBlockThreshold);
            console.log(`    📊 Found ${transactions.length} outgoing transactions for ${address} after block ${minBlockThreshold}`);
            
            // Check for high-activity nodes (>1000 tx) - but NOT for the starting address
            if (transactions.length > 1000 && currentDepth > 1) {
                console.log(`🔍 High activity node detected: ${address} with ${transactions.length} transactions - marking as potential endpoint`);
                
                // Mark this as a potential endpoint and stop branching for THIS address only
                const endpointPath: TransactionPath = {
                    analysisId,
                    pathId: this.generatePathId(),
                    depthLevel: currentDepth,
                    fromAddress: address,
                    toAddress: `ENDPOINT_${address}`, // Use a special endpoint identifier
                    transactionHash: 'ENDPOINT_MARKER',
                    valueAmount: 0,
                    timestamp: new Date(),
                    confidenceScore: 1.0,
                    patterns: { isPotentialEndpoint: true, transactionCount: transactions.length },
                    createdAt: new Date()
                };
                
                allPaths.push(endpointPath);
                
                console.log(`  🏁 Stopping branch for ${address}, continuing with other addresses...`);
                // Don't continue tracking THIS branch, but continue with other addresses
                continue;
            }
            
            // Select promising paths using adaptive branching
            const selectedPaths = await this.pathAnalyzer.selectPromisingPaths(transactions, config);
            console.log(`    🎯 Selected ${selectedPaths.length} promising paths from ${transactions.length} transactions`);
            
            for (const path of selectedPaths) {
                // Get the block number from the selected transaction
                const pathBlockNumber = parseInt(path.blockNumber || '0', 16);
                console.log(`    📍 Path to ${path.to}: block ${pathBlockNumber}`);
                
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
                
                // Store the block number for the next depth to ensure temporal progression
                parentBlockNumbers.set(path.to, pathBlockNumber);
            }
        }
        
        // Continue to next depth
        if (nextLevelAddresses.length > 0) {
            console.log(`  🔄 Continuing to depth ${currentDepth + 1} with ${nextLevelAddresses.length} addresses`);
            console.log(`  📊 Block number thresholds for next depth:`, Object.fromEntries(parentBlockNumbers));
            console.log(`  ⏰ Temporal progression: Each path will only consider transactions after its parent's block number`);
            await this.trackAtDepth(analysisId, nextLevelAddresses, currentDepth + 1, maxDepth, allPaths, config, parentBlockNumbers);
        } else {
            console.log(`  🏁 No more addresses to process at depth ${currentDepth}`);
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

    private async findHackTransaction(victimWallet: string, hackTransactionHash: string): Promise<any> {
        try {
            // Get the specific transaction directly by hash
            const hackTransaction = await this.etherscanService.getTransactionByHash(hackTransactionHash);
            
            if (!hackTransaction) {
                console.log(`❌ Hack transaction ${hackTransactionHash} not found`);
                return null;
            }
            
            console.log(`✅ Found hack transaction:`, {
                hash: hackTransaction.hash,
                from: hackTransaction.from,
                to: hackTransaction.to,
                value: hackTransaction.value,
                timestamp: hackTransaction.timeStamp
            });
            
            return hackTransaction;
        } catch (error) {
            console.error(`❌ Error finding hack transaction:`, error);
            return null;
        }
    }
} 