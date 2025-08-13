export interface AnalysisConfig {
    maxDepth: number;
    highVolumeThreshold: number;
    timeoutMinutes: number;
    confidenceThreshold: number;
    enableAIClassification: boolean;
    patternDetectionEnabled: boolean;
    maxPaths?: number;
}

export interface FundFlowAnalysis {
    id: number;
    incidentId: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    progress: number;
    paths: TransactionPath[];
    patterns: DetectedPattern[];
    endpoints: AnalysisEndpoint[];
    confidenceScore: number;
    createdAt: Date;
    completedAt?: Date;
}

export interface TransactionPath {
    analysisId: number;
    pathId: string;
    depthLevel: number;
    fromAddress: string;
    toAddress: string;
    transactionHash: string;
    valueAmount?: number;
    timestamp?: Date;
    confidenceScore?: number;
    patterns?: any;
    createdAt: Date;
}

export interface DetectedPattern {
    id: number;
    analysisId: number;
    patternType: 'peel_chain' | 'rapid_movement' | 'round_numbers' | 'coordinated';
    affectedAddresses: string[];
    confidence?: number;
    details?: any;
    createdAt: Date;
}

export interface AnalysisEndpoint {
    id: number;
    analysisId: number;
    address: string;
    classification?: string;
    totalAmount?: number;
    transactionCount?: number;
    confidence?: number;
    riskLevel?: 'low' | 'medium' | 'high' | 'critical';
    createdAt: Date;
}

export interface RiskAssessment {
    address: string;
    risk_score: number;
    risk_level: 'LOW' | 'MEDIUM' | 'HIGH';
    contributing_factors: Array<{
        factor: string;
        score: number;
        details: string;
    }>;
    last_updated: string;
}

export interface PatternDetection {
    peel_chain: boolean;
    peel_chain_strength: number;
    round_number_frequency: number;
    rapid_turnover: boolean;
    coordinated_movements: boolean;
    cluster_id?: string;
    cluster_confidence?: number;
}

export interface TransactionSelection {
    transaction: any;
    confidence_score: number;
    reasoning_flags: string[];
    percentage_of_total: number;
}

export interface EnhancedFlowAnalysis {
    flow_analysis: {
        total_depth_reached: number;
        total_addresses_analyzed: number;
        total_value_traced: string;
        high_confidence_paths: number;
        cross_chain_exits: number;
        endpoints_detected: number;
        endpoint_types: string[];
    };
    risk_assessment: {
        high_risk_addresses: Array<{
            address: string;
            risk_score: number;
            patterns: string[];
            total_funds: string;
        }>;
    };
    forensic_evidence: {
        chain_of_custody: any[];
        confidence_scores: any[];
        pattern_matches: any[];
        cross_references: any[];
    };
    endpoints: Array<{
        address: string;
        type: string;
        confidence: number;
        reasoning: string[];
        incoming_value: number;
        incoming_transaction: string;
    }>;
}

export interface AddressClassification {
    type: 'exchange' | 'mixer' | 'bridge' | 'defi' | 'wallet' | 'other';
    confidence: number;
    reasoning: string[];
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    keyIndicators: string[];
}

export interface PatternDetectionResult {
    patternType: string;
    confidence: number;
    affectedAddresses: string[];
    details: any;
}

export interface PromisingPath {
    to: string;
    hash: string;
    value: number;
    timestamp: Date;
    confidence: number;
    detectedPatterns: any;
}

export interface EndpointResult {
    address: string;
    type: string;
    confidence: number;
    reasoning: string[];
    incomingValue: number;
    incomingTransaction: string;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
} 