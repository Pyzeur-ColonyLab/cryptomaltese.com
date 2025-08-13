# Enhanced Fund Flow Tracking Algorithm - CryptoMaltese Integration

## Overview
This specification adapts the advanced fund flow tracking algorithm to integrate with your existing CryptoMaltese platform, leveraging your current Next.js frontend, Node.js backend, PostgreSQL database, and Etherscan integration.

## Current Architecture Integration

### Existing Components to Leverage
- **Frontend**: Next.js 15 + React 19 + TypeScript (`user-interface/`)
- **Backend**: Node.js services (`services/`)
- **Database**: PostgreSQL with existing schema (`db/schema.sql`)
- **APIs**: Etherscan integration (`services/etherscan.ts`)
- **Visualization**: Nivo Sankey diagrams (already implemented)
- **Reports**: PDF generation with PDF-lib

### New Components to Add
- Enhanced fund flow analysis engine
- AI-powered address classification service
- Pattern detection modules
- Multi-depth tracking system

## Database Schema Extensions

### New Tables Needed
```sql
-- Add to your existing schema.sql

-- Enhanced analysis tracking
CREATE TABLE fund_flow_analysis (
    id SERIAL PRIMARY KEY,
    incident_id INTEGER REFERENCES incidents(id),
    victim_wallet VARCHAR(42) NOT NULL,
    total_loss_amount DECIMAL(36,18),
    hack_timestamp TIMESTAMP,
    max_depth INTEGER DEFAULT 6,
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP,
    confidence_score DECIMAL(3,2)
);

-- Transaction paths tracking
CREATE TABLE transaction_paths (
    id SERIAL PRIMARY KEY,
    analysis_id INTEGER REFERENCES fund_flow_analysis(id),
    path_id VARCHAR(36) NOT NULL,
    depth_level INTEGER NOT NULL,
    from_address VARCHAR(42) NOT NULL,
    to_address VARCHAR(42) NOT NULL,
    transaction_hash VARCHAR(66) NOT NULL,
    value_amount DECIMAL(36,18),
    timestamp TIMESTAMP,
    confidence_score DECIMAL(3,2),
    patterns JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Address classification cache
CREATE TABLE address_classifications (
    id SERIAL PRIMARY KEY,
    address VARCHAR(42) UNIQUE NOT NULL,
    classification VARCHAR(20) NOT NULL, -- mixer, exchange, bridge, wallet, defi, other
    confidence DECIMAL(3,2),
    transaction_count INTEGER,
    analysis_data JSONB,
    ai_analysis_used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Pattern detection results
CREATE TABLE detected_patterns (
    id SERIAL PRIMARY KEY,
    analysis_id INTEGER REFERENCES fund_flow_analysis(id),
    pattern_type VARCHAR(30) NOT NULL, -- peel_chain, rapid_movement, round_numbers, coordinated
    affected_addresses TEXT[],
    confidence DECIMAL(3,2),
    details JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Analysis endpoints (final destinations)
CREATE TABLE analysis_endpoints (
    id SERIAL PRIMARY KEY,
    analysis_id INTEGER REFERENCES fund_flow_analysis(id),
    address VARCHAR(42) NOT NULL,
    classification VARCHAR(20),
    total_amount DECIMAL(36,18),
    transaction_count INTEGER,
    confidence DECIMAL(3,2),
    risk_level VARCHAR(10), -- low, medium, high, critical
    created_at TIMESTAMP DEFAULT NOW()
);
```

## Service Layer Architecture

### Enhanced Services Directory Structure
```
services/
├── etherscan.ts                 # Existing - Etherscan API
├── bitcoin.ts                   # Existing - Bitcoin API  
├── fund-flow/                   # New - Core fund flow engine
│   ├── tracker.ts              # Main tracking orchestrator
│   ├── pattern-detector.ts     # Pattern recognition engine
│   ├── address-classifier.ts   # AI-powered address classification
│   ├── path-analyzer.ts        # Transaction path analysis
│   └── endpoint-detector.ts    # Final destination identification
├── ai/                         # New - AI services
│   ├── claude-client.ts        # Claude API integration
│   └── classification-cache.ts # Caching layer for classifications
└── types/                      # Enhanced types
    ├── fund-flow.ts            # Fund flow specific types
    └── analysis.ts             # Analysis result types
```

### Core Service Implementation

#### `services/fund-flow/tracker.ts`
```typescript
import { FundFlowAnalysis, TransactionPath, AnalysisConfig } from '../types/fund-flow';
import { PatternDetector } from './pattern-detector';
import { AddressClassifier } from './address-classifier';
import { PathAnalyzer } from './path-analyzer';
import { EtherscanService } from '../etherscan';

export class FundFlowTracker {
    constructor(
        private etherscanService: EtherscanService,
        private patternDetector: PatternDetector,
        private addressClassifier: AddressClassifier,
        private pathAnalyzer: PathAnalyzer
    ) {}

    async analyzeIncident(
        incidentId: number,
        victimWallet: string,
        lossAmount: string,
        hackTimestamp: Date,
        config: AnalysisConfig = { maxDepth: 6, highVolumeThreshold: 1000 }
    ): Promise<FundFlowAnalysis> {
        
        // Create analysis record
        const analysisId = await this.createAnalysisRecord(incidentId, victimWallet, lossAmount, hackTimestamp);
        
        // Start tracking from victim wallet
        const initialTransactions = await this.etherscanService.getTransactions(
            victimWallet, 
            hackTimestamp
        );
        
        // Track through multiple depths
        const allPaths: TransactionPath[] = [];
        await this.trackAtDepth(analysisId, [victimWallet], 1, config.maxDepth, allPaths, config);
        
        // Detect patterns across all paths
        const patterns = await this.patternDetector.analyzeAllPaths(allPaths);
        
        // Identify endpoints
        const endpoints = await this.identifyEndpoints(analysisId, allPaths);
        
        // Generate final analysis
        return this.generateAnalysisResult(analysisId, allPaths, patterns, endpoints);
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
                    patterns: path.detectedPatterns
                });
                
                nextLevelAddresses.push(path.to);
            }
        }
        
        // Continue to next depth
        if (nextLevelAddresses.length > 0) {
            await this.trackAtDepth(analysisId, nextLevelAddresses, currentDepth + 1, maxDepth, allPaths, config);
        }
    }
}
```

#### `services/ai/claude-client.ts`
```typescript
export class ClaudeAddressClassifier {
    constructor(private apiKey: string) {}

    async classifyAddress(address: string, transactions: any[]): Promise<AddressClassification> {
        const prompt = this.buildClassificationPrompt(address, transactions);
        
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

        const result = await response.json();
        return this.parseClassificationResponse(result.content[0].text);
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
}
```

## Frontend Integration

### New Components for Enhanced Analysis

#### `user-interface/src/app/analysis/EnhancedAnalysis.tsx`
```typescript
'use client';
import { useState, useEffect } from 'react';
import { FundFlowAnalysis } from '@/types/fund-flow';

export default function EnhancedAnalysis({ incidentId }: { incidentId: number }) {
    const [analysis, setAnalysis] = useState<FundFlowAnalysis | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [progress, setProgress] = useState(0);

    const startEnhancedAnalysis = async () => {
        setIsAnalyzing(true);
        setProgress(0);
        
        try {
            // Start analysis
            const response = await fetch('/api/fund-flow/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ incidentId })
            });
            
            const { analysisId } = await response.json();
            
            // Poll for progress
            const pollProgress = setInterval(async () => {
                const progressResponse = await fetch(`/api/fund-flow/progress/${analysisId}`);
                const progressData = await progressResponse.json();
                
                setProgress(progressData.progress);
                
                if (progressData.status === 'completed') {
                    clearInterval(pollProgress);
                    setAnalysis(progressData.analysis);
                    setIsAnalyzing(false);
                }
            }, 2000);
            
        } catch (error) {
            console.error('Analysis failed:', error);
            setIsAnalyzing(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="bg-white p-6 rounded-lg shadow">
                <h2 className="text-xl font-semibold mb-4">Enhanced Fund Flow Analysis</h2>
                
                {!isAnalyzing && !analysis && (
                    <button
                        onClick={startEnhancedAnalysis}
                        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                    >
                        Start Enhanced Analysis
                    </button>
                )}
                
                {isAnalyzing && (
                    <div className="space-y-4">
                        <div className="flex items-center space-x-2">
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                            <span>Analyzing fund flows...</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                            <div 
                                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                style={{ width: `${progress}%` }}
                            ></div>
                        </div>
                        <div className="text-sm text-gray-600">{progress}% complete</div>
                    </div>
                )}
                
                {analysis && (
                    <AnalysisResults analysis={analysis} />
                )}
            </div>
        </div>
    );
}
```

### API Endpoints

#### `user-interface/src/app/api/fund-flow/analyze/route.ts`
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { FundFlowTracker } from '@/services/fund-flow/tracker';
import { getIncidentById } from '@/db/queries';

export async function POST(req: NextRequest) {
    try {
        const { incidentId } = await req.json();
        
        // Get incident details
        const incident = await getIncidentById(incidentId);
        if (!incident) {
            return NextResponse.json({ error: 'Incident not found' }, { status: 404 });
        }
        
        // Initialize tracker
        const tracker = new FundFlowTracker(/* dependencies */);
        
        // Start async analysis
        const analysisPromise = tracker.analyzeIncident(
            incidentId,
            incident.victim_wallet,
            incident.loss_amount,
            incident.hack_timestamp
        );
        
        // Don't await - return immediately with analysis ID
        const analysisId = await tracker.createAnalysisRecord(/* params */);
        
        // Process in background
        analysisPromise.catch(error => {
            console.error('Analysis failed:', error);
            // Update analysis status to failed
        });
        
        return NextResponse.json({ analysisId });
    } catch (error) {
        return NextResponse.json({ error: 'Analysis failed' }, { status: 500 });
    }
}
```

## Configuration Integration

### Environment Variables (add to `.env.local`)
```env
# Existing variables...
ETHERSCAN_API_KEY=your_key

# New variables for enhanced analysis
CLAUDE_API_KEY=your_claude_api_key
FUND_FLOW_MAX_DEPTH=6
HIGH_VOLUME_THRESHOLD=1000
ANALYSIS_TIMEOUT_MINUTES=30
PATTERN_CONFIDENCE_THRESHOLD=0.7
```

### Enhanced Configuration Types
```typescript
// services/types/fund-flow.ts
export interface AnalysisConfig {
    maxDepth: number;
    highVolumeThreshold: number;
    timeoutMinutes: number;
    confidenceThreshold: number;
    enableAIClassification: boolean;
    patternDetectionEnabled: boolean;
}

export interface FundFlowAnalysis {
    id: number;
    incidentId: number;
    status: 'pending' | 'running' | 'completed' | 'failed';
    progress: number;
    paths: TransactionPath[];
    patterns: DetectedPattern[];
    endpoints: AnalysisEndpoint[];
    confidenceScore: number;
    createdAt: Date;
    completedAt?: Date;
}
```

## Migration Plan

### Phase 1: Core Integration
1. Add new database tables to existing schema
2. Implement basic fund flow tracker service
3. Create API endpoints for analysis management
4. Add enhanced analysis UI component

### Phase 2: Pattern Detection
1. Implement pattern detection algorithms
2. Add pattern visualization to existing Sankey diagrams
3. Enhance report generation with pattern analysis

### Phase 3: AI Classification
1. Integrate Claude API client
2. Implement address classification caching
3. Add AI-enhanced endpoint detection
4. Create classification confidence indicators in UI

### Phase 4: Optimization
1. Performance optimization for large datasets
2. Implement proper error handling and retry logic
3. Add comprehensive logging and monitoring
4. Create automated testing suite

## Benefits Integration

### Enhanced Existing Features
- **Sankey Diagrams**: Color-code nodes by risk level and classification
- **PDF Reports**: Include pattern analysis and AI classification insights
- **Incident Forms**: Add configuration options for analysis depth and methods
- **Database**: Leverage existing PostgreSQL for enhanced analytics

### New Capabilities
- **Real-time Progress**: Track analysis progress in existing UI
- **Pattern Recognition**: Detect sophisticated laundering techniques
- **AI Classification**: Automatically identify exchange/mixer endpoints
- **Risk Scoring**: Provide confidence levels for investigative priorities

This integration plan leverages your existing solid foundation while adding sophisticated fund flow analysis capabilities that will significantly enhance the investigative value of your platform.