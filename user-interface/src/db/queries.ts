import pool from '@/db/client';
import { Incident, FundFlowAnalysis, TransactionPath, DetectedPattern, AnalysisEndpoint } from '@/db/models';

export async function getIncidentById(id: string): Promise<Incident | null> {
    try {
        const result = await pool.query(
            'SELECT * FROM incidents WHERE id = $1',
            [id]
        );
        
        if (result.rows.length === 0) {
            return null;
        }
        
        return result.rows[0] as Incident;
    } catch (error) {
        console.error('Failed to get incident by ID:', error);
        throw error;
    }
}

export async function createFundFlowAnalysis(
    incidentId: string,
    victimWallet: string,
    totalLossAmount: string,
    hackTimestamp: Date,
    maxDepth: number = 6
): Promise<number> {
    try {
        const result = await pool.query(
            `INSERT INTO fund_flow_analysis 
            (incident_id, victim_wallet, total_loss_amount, hack_timestamp, max_depth, status)
            VALUES ($1, $2, $3, $4, $5, 'pending')
            RETURNING id`,
            [incidentId, victimWallet, totalLossAmount, hackTimestamp, maxDepth]
        );
        
        return result.rows[0].id;
    } catch (error) {
        console.error('Failed to create fund flow analysis:', error);
        throw error;
    }
}

export async function updateFundFlowAnalysisStatus(
    analysisId: number,
    status: 'pending' | 'running' | 'completed' | 'failed',
    progress?: number,
    confidenceScore?: number
): Promise<void> {
    try {
        if (status === 'completed') {
            await pool.query(
                `UPDATE fund_flow_analysis 
                SET status = $1, 
                    progress = $2, 
                    confidence_score = $3,
                    completed_at = NOW()
                WHERE id = $4`,
                [status, progress || 100, confidenceScore || 0, analysisId]
            );
        } else {
            await pool.query(
                `UPDATE fund_flow_analysis 
                SET status = $1, 
                    progress = $2
                WHERE id = $3`,
                [status, progress || 0, analysisId]
            );
        }
    } catch (error) {
        console.error('Failed to update fund flow analysis status:', error);
        throw error;
    }
}

export async function getFundFlowAnalysis(analysisId: number): Promise<FundFlowAnalysis | null> {
    try {
        const result = await pool.query(
            'SELECT * FROM fund_flow_analysis WHERE id = $1',
            [analysisId]
        );
        
        if (result.rows.length === 0) {
            return null;
        }
        
        return result.rows[0] as FundFlowAnalysis;
    } catch (error) {
        console.error('Failed to get fund flow analysis:', error);
        throw error;
    }
}

export async function getFundFlowAnalysisByIncident(incidentId: string): Promise<FundFlowAnalysis[]> {
    try {
        const result = await pool.query(
            'SELECT * FROM fund_flow_analysis WHERE incident_id = $1 ORDER BY created_at DESC',
            [incidentId]
        );
        
        return result.rows as FundFlowAnalysis[];
    } catch (error) {
        console.error('Failed to get fund flow analysis by incident:', error);
        throw error;
    }
}

export async function createTransactionPath(
    analysisId: number,
    pathId: string,
    depthLevel: number,
    fromAddress: string,
    toAddress: string,
    transactionHash: string,
    valueAmount?: number,
    timestamp?: Date,
    confidenceScore?: number,
    patterns?: any
): Promise<number> {
    try {
        const result = await pool.query(
            `INSERT INTO transaction_paths 
            (analysis_id, path_id, depth_level, from_address, to_address, transaction_hash, value_amount, timestamp, confidence_score, patterns)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING id`,
            [analysisId, pathId, depthLevel, fromAddress, toAddress, transactionHash, valueAmount, timestamp, confidenceScore, patterns]
        );
        
        return result.rows[0].id;
    } catch (error) {
        console.error('Failed to create transaction path:', error);
        throw error;
    }
}

export async function createDetectedPattern(
    analysisId: number,
    patternType: string,
    affectedAddresses: string[],
    confidence?: number,
    details?: any
): Promise<number> {
    try {
        const result = await pool.query(
            `INSERT INTO detected_patterns 
            (analysis_id, pattern_type, affected_addresses, confidence, details)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id`,
            [analysisId, patternType, affectedAddresses, confidence, details]
        );
        
        return result.rows[0].id;
    } catch (error) {
        console.error('Failed to create detected pattern:', error);
        throw error;
    }
}

export async function createAnalysisEndpoint(
    analysisId: number,
    address: string,
    classification?: string,
    totalAmount?: number,
    transactionCount?: number,
    confidence?: number,
    riskLevel?: string
): Promise<number> {
    try {
        const result = await pool.query(
            `INSERT INTO analysis_endpoints 
            (analysis_id, address, classification, total_amount, transaction_count, confidence, risk_level)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id`,
            [analysisId, address, classification, totalAmount, transactionCount, confidence, riskLevel]
        );
        
        return result.rows[0].id;
    } catch (error) {
        console.error('Failed to create analysis endpoint:', error);
        throw error;
    }
}

export async function getTransactionPaths(analysisId: number | string): Promise<TransactionPath[]> {
    try {
        // If analysisId is a string (UUID), try to get from the old analysis table first
        if (typeof analysisId === 'string') {
            console.log(`Looking for legacy analysis with UUID: ${analysisId}`);
            // Try to get from the old analysis table
            const oldAnalysisResult = await pool.query(
                'SELECT analysis_data FROM analysis WHERE id = $1',
                [analysisId]
            );
            
            console.log(`Found ${oldAnalysisResult.rows.length} legacy analysis records`);
            
            if (oldAnalysisResult.rows.length > 0) {
                const analysisData = oldAnalysisResult.rows[0].analysis_data;
                console.log('Analysis data keys:', Object.keys(analysisData || {}));
                
                // Extract transaction paths from the old analysis data
                if (analysisData && analysisData.detailedTransactions) {
                    console.log(`Found ${analysisData.detailedTransactions.length} detailed transactions`);
                    console.log('First transaction sample:', analysisData.detailedTransactions[0]);
                    
                    // Convert old format to new TransactionPath format
                    const paths: TransactionPath[] = analysisData.detailedTransactions
                        .filter((tx: any) => tx.type === 'tracked' || tx.type === 'eth') // Only include actual transactions
                        .map((tx: any, index: number) => ({
                            analysisId: 0, // Will be set when we create a new fund flow analysis
                            pathId: `legacy_${index}`,
                            depthLevel: tx.depth || 1,
                            fromAddress: tx.from || tx.from_address || '',
                            toAddress: tx.to || tx.to_address || '',
                            transactionHash: tx.hash || tx.transaction_hash || '',
                            valueAmount: parseFloat(tx.value) || 0,
                            timestamp: tx.timestamp ? new Date(tx.timestamp) : new Date(),
                            confidenceScore: tx.confidence || 0.8,
                            patterns: null,
                            createdAt: new Date()
                        }));
                    
                    console.log(`Extracted ${paths.length} transaction paths from legacy analysis`);
                    return paths;
                } else {
                    console.log('No detailedTransactions found in analysis data');
                }
            }
        }
        
        // Try to get from the new transaction_paths table (only for numeric IDs)
        if (typeof analysisId === 'number') {
            const result = await pool.query(
                'SELECT * FROM transaction_paths WHERE analysis_id = $1 ORDER BY depth_level, created_at',
                [analysisId]
            );
            return result.rows as TransactionPath[];
        }
        
        return [];
    } catch (error) {
        console.error('Failed to get transaction paths:', error);
        throw error;
    }
}

export async function getDetectedPatterns(analysisId: number): Promise<DetectedPattern[]> {
    try {
        const result = await pool.query(
            'SELECT * FROM detected_patterns WHERE analysis_id = $1 ORDER BY confidence DESC, created_at',
            [analysisId]
        );
        
        return result.rows as DetectedPattern[];
    } catch (error) {
        console.error('Failed to get detected patterns:', error);
        throw error;
    }
}

export async function getAnalysisEndpoints(analysisId: number): Promise<AnalysisEndpoint[]> {
    try {
        const result = await pool.query(
            'SELECT * FROM analysis_endpoints WHERE analysis_id = $1 ORDER BY risk_level DESC, confidence DESC',
            [analysisId]
        );
        
        return result.rows as AnalysisEndpoint[];
    } catch (error) {
        console.error('Failed to get analysis endpoints:', error);
        throw error;
    }
}

export async function getAddressClassification(address: string): Promise<any | null> {
    try {
        const result = await pool.query(
            'SELECT * FROM address_classifications WHERE address = $1',
            [address]
        );
        
        if (result.rows.length === 0) {
            return null;
        }
        
        return result.rows[0];
    } catch (error) {
        console.error('Failed to get address classification:', error);
        throw error;
    }
}

export async function createAddressClassification(
    address: string,
    classification: string,
    confidence: number,
    transactionCount: number,
    analysisData?: any,
    aiAnalysisUsed: boolean = false
): Promise<number> {
    try {
        const result = await pool.query(
            `INSERT INTO address_classifications 
            (address, classification, confidence, transaction_count, analysis_data, ai_analysis_used)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (address) 
            DO UPDATE SET 
                classification = EXCLUDED.classification,
                confidence = EXCLUDED.confidence,
                transaction_count = EXCLUDED.transaction_count,
                analysis_data = EXCLUDED.analysis_data,
                ai_analysis_used = EXCLUDED.ai_analysis_used,
                updated_at = NOW()
            RETURNING id`,
            [address, classification, confidence, transactionCount, analysisData, aiAnalysisUsed]
        );
        
        return result.rows[0].id;
    } catch (error) {
        console.error('Failed to create address classification:', error);
        throw error;
    }
} 