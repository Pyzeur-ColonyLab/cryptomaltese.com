# Enhanced Fund Flow Tracking Specification - Promise-Guided Algorithm with Block Number Progressive Filtering

## Algorithm Logic Description

### Core Algorithm: Promise-Guided Beam Search with Mandatory Block Number Progressive Filtering

The fund flow tracking algorithm combines intelligent graph exploration with strict temporal consistency enforcement. Every transaction query in every path must respect the **Block Number Progressive Filtering Logic** as a fundamental constraint, ensuring that fund flow analysis maintains chronological ordering and prevents temporal paradoxes.

#### 1. Block Number Progressive Filtering Logic (Core Constraint)

**Temporal Ordering Principle:**
```

## Configuration and Environment

### File: `user-interface/.env.local` (add to existing)
```env
# Existing environment variables...

# Block-Aware Promise Algorithm Configuration
PROMISE_BEAM_WIDTH=15
PROMISE_MAX_DEPTH=6
PROMISE_THRESHOLD=0.30
PROMISE_EXPLORATION_BUDGET=5000

# Block Filtering Configuration
BLOCK_FILTER_ENABLED=true
MIN_REASONABLE_BLOCK_GAP=1
MAX_REASONABLE_BLOCK_GAP=1000
SUSPICIOUS_BLOCK_GAP_THRESHOLD=500
BLOCK_FILTER_PERFORMANCE_TRACKING=true

# AI Classification
CLAUDE_API_KEY=your_claude_api_key
AI_CLASSIFICATION_THRESHOLD=1000
AI_CLASSIFICATION_ENABLED=true

# Algorithm Performance
MAX_ANALYSIS_TIME_MINUTES=45
TEMPORAL_VALIDATION_ENABLED=true
PATTERN_DETECTION_ENABLED=true
BLOCK_PROGRESSION_VALIDATION=true
```

### File: `services/types/block-aware-fund-flow.ts` (new file)
**Enhanced type definitions:**

```typescript
export interface BlockAwareTransactionPath {
    pathIdentifier: string;
    depth: number;
    transactions: Transaction[];
    blockProgression: number[]; // Sequence of block numbers
    currentAddress: string;
    blockCursor: number; // Current minimum block for next query
    accumulatedValue: string;
    promiseScore: number;
    temporalWeight: number;
    blockConsistencyBonus: number;
    isTemporallyValid: boolean;
    filterEfficiency: number;
    createdAt: Date;
}

export interface BlockFilterResult {
    transactions: Transaction[];
    totalQueried: number;
    totalFiltered: number;
    filterEfficiency: number;
    blockThreshold: number;
    temporalViolations: number;
}

export interface BlockValidationResult {
    isValid: boolean;
    violations: BlockViolation[];
    totalTransactions: number;
    averageBlockProgression: number;
    suspiciousGaps: number;
}

export interface BlockViolation {
    index: number;
    currentBlock: number;
    previousBlock: number;
    violation: 'non-monotonic-progression' | 'suspicious-large-gap' | 'temporal-inconsistency';
    severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface BlockFilterMetrics {
    analysisId: number;
    depthLevel: number;
    totalAddressesQueried: number;
    totalTransactionsPreFilter: number;
    totalTransactionsPostFilter: number;
    filterEfficiency: number;
    averageBlockProgression: number;
    temporalViolationsPrevented: number;
    performanceImprovementMs: number;
}

export interface BlockAwarePromiseScore {
    totalScore: number;
    valueWeight: number;
    patternWeight: number;
    destinationWeight: number;
    temporalWeight: number;
    blockConsistencyBonus: number;
    blockProgressionScore: number;
    velocityConsistencyScore: number;
    temporalValidityConfirmed: boolean;
}
```

## Database Queries and Functions

### File: `db/block-aware-queries.sql` (new file)
**Specialized queries for block-aware analysis:**

```sql
-- Get block-filtered transactions for a path
CREATE OR REPLACE FUNCTION get_block_filtered_transactions(
    p_address VARCHAR(42),
    p_min_block_number BIGINT,
    p_analysis_id INTEGER,
    p_path_identifier VARCHAR(50)
) RETURNS TABLE (
    transaction_hash VARCHAR(66),
    block_number BIGINT,
    from_address VARCHAR(42),
    to_address VARCHAR(42),
    value DECIMAL(36,18),
    timestamp TIMESTAMP,
    gas_used BIGINT
) AS $
BEGIN
    -- Record the query attempt
    INSERT INTO path_block_tracking (
        analysis_id, path_identifier, address, minimum_block_threshold
    ) VALUES (
        p_analysis_id, p_path_identifier, p_address, p_min_block_number
    );
    
    -- Return filtered transactions
    RETURN QUERY
    SELECT t.hash, t.block_number, t.from_addr, t.to_addr, t.value, t.timestamp, t.gas_used
    FROM transactions t
    WHERE t.from_addr = p_address 
    AND t.block_number > p_min_block_number
    ORDER BY t.block_number ASC;
END;
$ LANGUAGE plpgsql;

-- Validate block progression for a path
CREATE OR REPLACE FUNCTION validate_path_block_progression(
    p_block_sequence BIGINT[]
) RETURNS TABLE (
    is_valid BOOLEAN,
    violation_count INTEGER,
    average_gap DECIMAL(10,2),
    suspicious_gaps INTEGER
) AS $
DECLARE
    i INTEGER;
    violations INTEGER := 0;
    total_gap BIGINT := 0;
    suspicious INTEGER := 0;
    current_gap BIGINT;
BEGIN
    -- Check monotonic progression
    FOR i IN 2..array_length(p_block_sequence, 1) LOOP
        IF p_block_sequence[i] <= p_block_sequence[i-1] THEN
            violations := violations + 1;
        END IF;
        
        current_gap := p_block_sequence[i] - p_block_sequence[i-1];
        total_gap := total_gap + current_gap;
        
        -- Check for suspicious gaps
        IF current_gap > 500 THEN
            suspicious := suspicious + 1;
        END IF;
    END LOOP;
    
    RETURN QUERY SELECT 
        violations = 0,
        violations,
        CASE 
            WHEN array_length(p_block_sequence, 1) > 1 
            THEN total_gap::DECIMAL / (array_length(p_block_sequence, 1) - 1)
            ELSE 0.0
        END,
        suspicious;
END;
$ LANGUAGE plpgsql;

-- Get block filter performance metrics
CREATE OR REPLACE FUNCTION get_block_filter_performance(
    p_analysis_id INTEGER
) RETURNS TABLE (
    depth_level INTEGER,
    filter_efficiency DECIMAL(5,2),
    transactions_filtered INTEGER,
    performance_gain_ms INTEGER
) AS $
BEGIN
    RETURN QUERY
    SELECT 
        bfm.depth_level,
        bfm.filter_efficiency,
        (bfm.total_transactions_pre_filter - bfm.total_transactions_post_filter) as filtered,
        bfm.performance_improvement_ms
    FROM block_filter_metrics bfm
    WHERE bfm.analysis_id = p_analysis_id
    ORDER BY bfm.depth_level;
END;
$ LANGUAGE plpgsql;
```

## Implementation Plan

### Phase 1: Block Filter Foundation (Week 1)
1. **Database Schema**: Add all block-aware tables to `db/schema.sql`
2. **Block Filter Service**: Implement `block-filter.ts` with temporal validation
3. **Basic Queries**: Create block-filtered transaction queries
4. **Unit Tests**: Test block progression validation logic

### Phase 2: Core Algorithm Integration (Week 2)
1. **Block-Aware Tracker**: Implement `block-aware-promise-tracker.ts`
2. **Enhanced Promise Calculator**: Add temporal weight calculation with block factors
3. **Path Validation**: Implement comprehensive block progression validation
4. **API Endpoints**: Create block-aware analysis endpoints

### Phase 3: Promise Scoring Enhancement (Week 3)
1. **Multi-Factor Scoring**: Integrate block consistency into promise scores
2. **Pattern Detection**: Enhance pattern detection with block interval analysis
3. **Performance Metrics**: Add block filter performance tracking
4. **Testing**: Validate algorithm with real blockchain data

### Phase 4: AI Integration & Optimization (Week 4)
1. **Claude API**: Integrate AI classification with block-aware analysis
2. **Caching Layer**: Implement intelligent caching for block-filtered results
3. **Performance Optimization**: Optimize database queries and API calls
4. **Error Handling**: Robust error handling for block inconsistencies

### Phase 5: Frontend & Visualization (Week 5)
1. **Block-Aware UI**: Implement enhanced analysis interface
2. **Progress Visualization**: Real-time block filter performance display
3. **Enhanced Sankey**: Add block progression visualization to diagrams
4. **Report Generation**: Update PDF reports with block-aware insights

## Success Metrics

### Block Filter Performance
- **Filter Efficiency**: >60% of irrelevant transactions filtered out
- **Temporal Accuracy**: 100% chronologically valid paths
- **Performance Gain**: >40% reduction in analysis time
- **Violation Prevention**: Zero temporal paradoxes in final results

### Algorithm Effectiveness
- **Endpoint Discovery**: >85% of significant endpoints found
- **Promise Accuracy**: >75% correlation between promise scores and manual validation
- **Block Consistency**: 100% monotonic block progression in all paths
- **Resource Efficiency**: <4000 API calls per analysis (vs 5000+ without filtering)

### User Experience
- **Real-time Metrics**: Live block filter performance display
- **Visual Clarity**: Clear representation of block progression in visualizations  
- **Analysis Speed**: Complete analysis within 25 minutes (vs 30+ without filtering)
- **Report Quality**: Enhanced reports with temporal analysis insights

## Key Benefits of Block Number Progressive Filtering

### 1. **Eliminates Temporal Paradoxes**
- Prevents impossible fund flows where money appears to move backward in time
- Ensures logical causality in all transaction sequences
- Provides forensically sound evidence chains

### 2. **Dramatically Improves Performance**
- Reduces irrelevant transaction processing by 60-80%
- Decreases API calls and computational overhead
- Enables deeper analysis within same time budget

### 3. **Enhances Analysis Accuracy**
- Focuses on transactions that could logically be part of laundering sequence
- Eliminates noise from pre-incident legitimate activity
- Improves signal-to-noise ratio for pattern detection

### 4. **Provides Investigative Confidence**
- Every discovered path is temporally valid and defensible
- Block progression provides additional evidence of intentional movement
- Enables correlation with other blockchain events and external evidence

This comprehensive specification integrates Block Number Progressive Filtering as a fundamental constraint throughout the entire fund flow analysis pipeline, ensuring temporal consistency while maximizing the effectiveness of the promise-guided exploration strategy.
FUNDAMENTAL RULE: For any transaction path sequence [T1, T2, T3, ..., Tn]:
ENFORCE: T1.block_number < T2.block_number < T3.block_number < ... < Tn.block_number

IMPLEMENTATION CONSTRAINT:
WHEN querying transactions at Node N+1:
    minimum_block_threshold = transaction[N].block_number + 1
    ONLY consider transactions WHERE block_number >= minimum_block_threshold
```

**Path-Specific Block Cursors:**
```
EACH path maintains independent block progression:
- Path A: victim[block=100] → addr1[block=105] → query_addr2[min_block=106]
- Path B: victim[block=100] → addr3[block=103] → query_addr4[min_block=104]
- Path C: victim[block=100] → addr5[block=108] → query_addr6[min_block=109]

PREVENTS temporal cross-contamination between different exploration paths
```

**Block Filter Integration with Promise Scoring:**
```
ALGORITHM FLOW:
1. Calculate promise scores for candidate transactions
2. FILTER candidates by block_number > current_path_minimum_block
3. RE-RANK filtered candidates by promise score
4. SELECT top candidates for beam search continuation
5. UPDATE path-specific block cursor for next iteration
```

#### 2. Promise-Guided Exploration with Block Filtering

**Enhanced Beam Search Logic:**
```
ALGORITHM: Block-Aware Promise Beam Search

INITIALIZATION:
    SET victim_wallet as source with hack_block_number
    SET active_paths = [initial_path(victim_wallet, hack_block_number)]
    SET beam_width, max_depth, promise_threshold

MAIN EXPLORATION LOOP:
    FOR depth = 1 to max_depth:
        expanded_candidates = []
        
        FOR each active_path in active_paths:
            current_address = active_path.current_address
            current_block_cursor = active_path.block_cursor
            
            // BLOCK-FILTERED TRANSACTION QUERY
            filtered_transactions = getTransactionsAfterBlock(
                address=current_address,
                min_block=current_block_cursor + 1
            )
            
            // PROMISE SCORE CALCULATION
            FOR each transaction in filtered_transactions:
                new_path = active_path.extend(transaction)
                promise_score = calculatePromiseScore(new_path)
                expanded_candidates.append({
                    path: new_path,
                    promise: promise_score,
                    new_block_cursor: transaction.block_number
                })
        
        // BEAM SELECTION WITH BLOCK CONSISTENCY
        valid_candidates = expanded_candidates.filter(c => 
            c.new_block_cursor > c.path.previous_block_cursor AND
            c.promise >= promise_threshold
        )
        
        sorted_candidates = valid_candidates.sort_by_promise_desc()
        active_paths = select_top_N(sorted_candidates, beam_width)
        
        // UPDATE BLOCK CURSORS
        FOR each selected_path in active_paths:
            selected_path.block_cursor = selected_path.last_transaction.block_number
```

#### 3. Enhanced Promise Scoring with Temporal Factors

**Block-Aware Promise Calculation:**
```
PROMISE_SCORE(transaction_path) = 
    (VALUE_WEIGHT × 0.25) +
    (PATTERN_WEIGHT × 0.25) + 
    (DESTINATION_WEIGHT × 0.25) +
    (TEMPORAL_WEIGHT × 0.25)

WHERE TEMPORAL_WEIGHT includes:
    - Block progression consistency bonus
    - Time proximity to hack timestamp
    - Transaction velocity analysis
    - Block gap analysis (too fast/slow patterns)
```

**Enhanced Temporal Weight Logic:**
```
TEMPORAL_WEIGHT = (
    block_progression_bonus × 0.4 +
    time_proximity_score × 0.3 +
    velocity_consistency × 0.2 +
    block_gap_analysis × 0.1
)

WHERE:
block_progression_bonus = 1.0 if block_number > previous_block else 0.0
time_proximity_score = 1.0 - (block_time - hack_time) / max_analysis_window
velocity_consistency = consistency_of_block_intervals_in_path
block_gap_analysis = analysis_of_suspicious_timing_patterns
```

#### 4. Graph Theory Foundation with Block Constraints

**Enhanced Graph Representation:**
```
DIRECTED ACYCLIC GRAPH (DAG) with temporal ordering:
- NODES = (address, block_number) pairs
- EDGES = transactions with mandatory block_number progression
- EDGE VALIDITY = edge(A→B) valid IFF B.block_number > A.block_number
- PATH VALIDITY = ALL edges in path must maintain block progression
```

**Temporal Path Validation:**
```
FUNCTION is_valid_path(transaction_sequence):
    FOR i in range(1, len(transaction_sequence)):
        IF transaction_sequence[i].block_number <= transaction_sequence[i-1].block_number:
            RETURN FALSE
    RETURN TRUE

CONSTRAINT: ONLY explore paths that pass temporal validation
```

## Database Schema Modifications

### File: `db/schema.sql`
**Add new tables with block tracking:**

```sql
-- Enhanced fund flow analysis with block-aware tracking
CREATE TABLE fund_flow_analysis (
    id SERIAL PRIMARY KEY,
    incident_id INTEGER REFERENCES incidents(id),
    victim_wallet VARCHAR(42) NOT NULL,
    total_loss_amount DECIMAL(36,18),
    hack_timestamp TIMESTAMP,
    hack_block_number BIGINT NOT NULL, -- Required for block filtering
    status VARCHAR(20) DEFAULT 'pending',
    algorithm_type VARCHAR(30) DEFAULT 'promise_guided_block_filtered',
    beam_width INTEGER DEFAULT 10,
    max_depth INTEGER DEFAULT 6,
    promise_threshold DECIMAL(3,2) DEFAULT 0.30,
    block_filter_enabled BOOLEAN DEFAULT TRUE,
    total_paths_explored INTEGER DEFAULT 0,
    block_filtered_paths INTEGER DEFAULT 0, -- Paths filtered by block logic
    endpoints_found INTEGER DEFAULT 0,
    confidence_score DECIMAL(3,2),
    created_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP
);

-- Block-aware transaction paths
CREATE TABLE promise_paths (
    id SERIAL PRIMARY KEY,
    analysis_id INTEGER REFERENCES fund_flow_analysis(id),
    path_identifier VARCHAR(50) NOT NULL,
    depth_level INTEGER NOT NULL,
    transaction_sequence JSONB NOT NULL, -- [{"hash":"0x...", "block":12345}, ...]
    block_progression BIGINT[] NOT NULL, -- [100, 105, 108, 112] - block sequence
    current_address VARCHAR(42) NOT NULL,
    current_block_cursor BIGINT NOT NULL, -- Current minimum block for next query
    accumulated_value DECIMAL(36,18),
    promise_score DECIMAL(5,4),
    value_weight DECIMAL(3,2),
    pattern_weight DECIMAL(3,2),
    destination_weight DECIMAL(3,2),
    temporal_weight DECIMAL(3,2), -- Enhanced with block progression
    block_consistency_bonus DECIMAL(3,2), -- Bonus for good block progression
    is_active BOOLEAN DEFAULT TRUE,
    is_endpoint BOOLEAN DEFAULT FALSE,
    endpoint_reason VARCHAR(50),
    temporal_validity_confirmed BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Block progression tracking per path
CREATE TABLE path_block_tracking (
    id SERIAL PRIMARY KEY,
    analysis_id INTEGER REFERENCES fund_flow_analysis(id),
    path_identifier VARCHAR(50) NOT NULL,
    depth_level INTEGER NOT NULL,
    address VARCHAR(42) NOT NULL,
    minimum_block_threshold BIGINT NOT NULL, -- Minimum block for queries at this address
    actual_transaction_block BIGINT, -- Actual block of selected transaction
    transactions_available_count INTEGER, -- Total transactions available
    transactions_after_filter_count INTEGER, -- Transactions after block filter
    block_filter_efficiency DECIMAL(3,2), -- Percentage of transactions filtered out
    created_at TIMESTAMP DEFAULT NOW()
);

-- Address classification with block-aware analysis
CREATE TABLE address_analysis (
    id SERIAL PRIMARY KEY,
    address VARCHAR(42) UNIQUE NOT NULL,
    classification VARCHAR(20),
    risk_score DECIMAL(3,2),
    transaction_count BIGINT,
    total_volume DECIMAL(36,18),
    first_seen_block BIGINT, -- Block number of first transaction
    last_seen_block BIGINT, -- Block number of latest transaction
    block_activity_span BIGINT, -- last_seen_block - first_seen_block
    analysis_confidence DECIMAL(3,2),
    ai_classification_used BOOLEAN DEFAULT FALSE,
    ai_classification_data JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Temporal pattern detection
CREATE TABLE detected_patterns (
    id SERIAL PRIMARY KEY,
    analysis_id INTEGER REFERENCES fund_flow_analysis(id),
    path_id INTEGER REFERENCES promise_paths(id),
    pattern_type VARCHAR(30) NOT NULL,
    pattern_strength DECIMAL(3,2),
    affected_transactions TEXT[],
    block_numbers BIGINT[], -- Block numbers involved in pattern
    block_interval_analysis JSONB, -- Analysis of time between blocks
    temporal_consistency_score DECIMAL(3,2), -- How consistent timing is
    pattern_details JSONB,
    detected_at TIMESTAMP DEFAULT NOW()
);

-- Block filtering performance metrics
CREATE TABLE block_filter_metrics (
    id SERIAL PRIMARY KEY,
    analysis_id INTEGER REFERENCES fund_flow_analysis(id),
    depth_level INTEGER NOT NULL,
    total_addresses_queried INTEGER,
    total_transactions_pre_filter INTEGER,
    total_transactions_post_filter INTEGER,
    filter_efficiency DECIMAL(5,2), -- Percentage filtered out
    average_block_progression DECIMAL(10,2), -- Average blocks between steps
    temporal_violations_prevented INTEGER, -- Invalid paths prevented
    performance_improvement_ms INTEGER, -- Time saved by filtering
    created_at TIMESTAMP DEFAULT NOW()
);
```

## Core Algorithm Implementation

### File: `services/fund-flow/block-aware-promise-tracker.ts` (new file)
**Main algorithm with integrated block filtering:**

```typescript
export class BlockAwarePromiseTracker {
    private beamWidth: number;
    private maxDepth: number;
    private promiseThreshold: number;
    private blockFilterEnabled: boolean;

    async analyzeWithBlockFilteredPromiseGuided(
        analysisId: number,
        victimWallet: string,
        lossAmount: string,
        hackTimestamp: Date,
        hackBlockNumber: number
    ): Promise<AnalysisResult> {
        
        // INITIALIZATION WITH BLOCK CURSOR
        const initialPath = this.createInitialPath(victimWallet, hackBlockNumber);
        const activePaths = [initialPath];
        const discoveredEndpoints = [];
        
        // MAIN BLOCK-AWARE EXPLORATION LOOP
        for (let currentDepth = 1; currentDepth <= this.maxDepth; currentDepth++) {
            
            if (activePaths.length === 0) break;
            
            const expandedCandidates = [];
            const blockFilterMetrics = this.initializeDepthMetrics(currentDepth);
            
            // EXPAND ALL ACTIVE PATHS WITH BLOCK FILTERING
            for (const activePath of activePaths) {
                const expansions = await this.expandPathWithBlockFilter(
                    activePath, 
                    currentDepth, 
                    analysisId,
                    blockFilterMetrics
                );
                expandedCandidates.push(...expansions);
            }
            
            // PROMISE SCORING FOR BLOCK-VALID CANDIDATES
            const scoredCandidates = await this.scoreBlockValidCandidates(
                expandedCandidates,
                analysisId
            );
            
            // BEAM SELECTION WITH BLOCK CONSISTENCY
            const selectedPaths = await this.selectPromisingBlockValidPaths(
                scoredCandidates,
                currentDepth
            );
            
            // UPDATE ACTIVE PATHS AND DETECT ENDPOINTS
            activePaths.length = 0;
            for (const selectedPath of selectedPaths) {
                if (await this.isEndpoint(selectedPath.path.currentAddress)) {
                    discoveredEndpoints.push(selectedPath.path);
                    await this.recordBlockAwareEndpoint(analysisId, selectedPath);
                } else {
                    activePaths.push(selectedPath.path);
                    await this.recordBlockAwarePath(analysisId, selectedPath);
                }
            }
            
            // RECORD BLOCK FILTER PERFORMANCE
            await this.recordBlockFilterMetrics(analysisId, currentDepth, blockFilterMetrics);
        }
        
        return this.generateBlockAwareAnalysis(analysisId, discoveredEndpoints);
    }

    private async expandPathWithBlockFilter(
        activePath: TransactionPath,
        depth: number,
        analysisId: number,
        metrics: BlockFilterMetrics
    ): Promise<PathExpansion[]> {
        
        const currentAddress = activePath.currentAddress;
        const currentBlockCursor = activePath.blockCursor;
        
        // QUERY TRANSACTIONS WITH MANDATORY BLOCK FILTER
        const allTransactions = await this.etherscanService.getTransactions(
            currentAddress,
            currentBlockCursor + 1, // STRICTLY GREATER than current block
            'latest'
        );
        
        metrics.totalTransactionsPreFilter += allTransactions.length;
        
        // ADDITIONAL BLOCK CONSISTENCY VALIDATION
        const blockValidTransactions = allTransactions.filter(tx => {
            const isBlockValid = tx.blockNumber > currentBlockCursor;
            const isTemporallyConsistent = this.validateTemporalConsistency(
                activePath,
                tx
            );
            return isBlockValid && isTemporallyConsistent;
        });
        
        metrics.totalTransactionsPostFilter += blockValidTransactions.length;
        
        // CREATE PATH EXPANSIONS WITH UPDATED BLOCK CURSORS
        const expansions = blockValidTransactions.map(tx => ({
            originalPath: activePath,
            transaction: tx,
            newPath: this.createExtendedPath(activePath, tx),
            newBlockCursor: tx.blockNumber,
            blockProgression: activePath.blockProgression.concat([tx.blockNumber])
        }));
        
        // RECORD BLOCK TRACKING
        await this.recordBlockTracking(
            analysisId,
            activePath.pathIdentifier,
            depth,
            currentAddress,
            currentBlockCursor,
            allTransactions.length,
            blockValidTransactions.length
        );
        
        return expansions;
    }

    private validateTemporalConsistency(
        path: TransactionPath,
        newTransaction: Transaction
    ): boolean {
        // ENSURE MONOTONIC BLOCK PROGRESSION
        const lastBlock = path.blockProgression[path.blockProgression.length - 1];
        if (newTransaction.blockNumber <= lastBlock) return false;
        
        // VALIDATE REASONABLE BLOCK GAPS
        const blockGap = newTransaction.blockNumber - lastBlock;
        if (blockGap > this.maxReasonableBlockGap) return false;
        
        // VALIDATE TIMESTAMP CONSISTENCY
        const lastTimestamp = path.lastTransaction?.timestamp;
        if (lastTimestamp && newTransaction.timestamp < lastTimestamp) return false;
        
        return true;
    }
}
```

### File: `services/fund-flow/block-filter.ts` (new file)
**Dedicated block filtering service:**

```typescript
export class BlockFilterService {
    
    async getBlockFilteredTransactions(
        address: string,
        minimumBlockNumber: number,
        analysisId: number,
        pathIdentifier: string,
        depth: number
    ): Promise<BlockFilterResult> {
        
        // QUERY ALL TRANSACTIONS FROM ADDRESS
        const allTransactions = await this.etherscanService.getTransactions(
            address,
            minimumBlockNumber + 1,
            'latest'
        );
        
        // APPLY STRICT BLOCK FILTERING
        const blockFilteredTransactions = allTransactions.filter(tx => 
            tx.blockNumber > minimumBlockNumber
        );
        
        // CALCULATE FILTER EFFICIENCY
        const filterEfficiency = allTransactions.length > 0 
            ? ((allTransactions.length - blockFilteredTransactions.length) / allTransactions.length) * 100
            : 0;
        
        // RECORD BLOCK FILTER PERFORMANCE
        await this.recordBlockFilterPerformance({
            analysisId,
            pathIdentifier,
            depth,
            address,
            minimumBlockNumber,
            totalTransactions: allTransactions.length,
            filteredTransactions: blockFilteredTransactions.length,
            filterEfficiency
        });
        
        return {
            transactions: blockFilteredTransactions,
            totalQueried: allTransactions.length,
            totalFiltered: blockFilteredTransactions.length,
            filterEfficiency,
            blockThreshold: minimumBlockNumber
        };
    }
    
    async validateBlockProgression(
        transactionSequence: Transaction[]
    ): Promise<BlockValidationResult> {
        
        const violations = [];
        let isValid = true;
        
        for (let i = 1; i < transactionSequence.length; i++) {
            const current = transactionSequence[i];
            const previous = transactionSequence[i - 1];
            
            if (current.blockNumber <= previous.blockNumber) {
                violations.push({
                    index: i,
                    currentBlock: current.blockNumber,
                    previousBlock: previous.blockNumber,
                    violation: 'non-monotonic-progression'
                });
                isValid = false;
            }
            
            // CHECK FOR SUSPICIOUS GAPS
            const blockGap = current.blockNumber - previous.blockNumber;
            if (blockGap > this.suspiciousBlockGapThreshold) {
                violations.push({
                    index: i,
                    blockGap,
                    violation: 'suspicious-large-gap'
                });
            }
        }
        
        return {
            isValid,
            violations,
            totalTransactions: transactionSequence.length,
            averageBlockProgression: this.calculateAverageBlockProgression(transactionSequence)
        };
    }
}
```

### File: `services/fund-flow/enhanced-promise-calculator.ts` (new file)
**Promise calculation with block awareness:**

```typescript
export class EnhancedPromiseCalculator {
    
    async calculateBlockAwarePromiseScore(path: TransactionPath): Promise<PromiseScore> {
        const valueWeight = this.calculateValueWeight(path);
        const patternWeight = await this.calculatePatternWeight(path);
        const destinationWeight = await this.calculateDestinationWeight(path);
        const temporalWeight = this.calculateEnhancedTemporalWeight(path);
        
        // EQUAL WEIGHTING INCLUDING ENHANCED TEMPORAL
        const promiseScore = 
            (valueWeight * 0.25) +
            (patternWeight * 0.25) +
            (destinationWeight * 0.25) +
            (temporalWeight * 0.25);
        
        return {
            totalScore: Math.min(1.0, Math.max(0.0, promiseScore)),
            valueWeight,
            patternWeight,
            destinationWeight,
            temporalWeight,
            blockConsistencyBonus: this.calculateBlockConsistencyBonus(path)
        };
    }
    
    private calculateEnhancedTemporalWeight(path: TransactionPath): number {
        const blockProgressionBonus = this.calculateBlockProgressionBonus(path);
        const timeProximityScore = this.calculateTimeProximityScore(path);
        const velocityConsistency = this.calculateVelocityConsistency(path);
        const blockGapAnalysis = this.calculateBlockGapAnalysis(path);
        
        return (
            (blockProgressionBonus * 0.4) +
            (timeProximityScore * 0.3) +
            (velocityConsistency * 0.2) +
            (blockGapAnalysis * 0.1)
        );
    }
    
    private calculateBlockProgressionBonus(path: TransactionPath): number {
        // VERIFY ALL TRANSACTIONS HAVE PROPER BLOCK PROGRESSION
        const blockSequence = path.blockProgression;
        
        let progressionScore = 1.0;
        for (let i = 1; i < blockSequence.length; i++) {
            if (blockSequence[i] <= blockSequence[i - 1]) {
                progressionScore = 0.0; // Invalid progression
                break;
            }
            
            // BONUS FOR CONSISTENT REASONABLE GAPS
            const gap = blockSequence[i] - blockSequence[i - 1];
            if (gap >= this.minReasonableGap && gap <= this.maxReasonableGap) {
                progressionScore += 0.1;
            }
        }
        
        return Math.min(1.0, progressionScore);
    }
    
    private calculateVelocityConsistency(path: TransactionPath): number {
        // ANALYZE CONSISTENCY OF BLOCK INTERVALS
        const blockIntervals = [];
        const blocks = path.blockProgression;
        
        for (let i = 1; i < blocks.length; i++) {
            blockIntervals.push(blocks[i] - blocks[i - 1]);
        }
        
        if (blockIntervals.length < 2) return 0.5; // Neutral for short paths
        
        // CALCULATE COEFFICIENT OF VARIATION
        const mean = blockIntervals.reduce((a, b) => a + b, 0) / blockIntervals.length;
        const variance = blockIntervals.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / blockIntervals.length;
        const stdDev = Math.sqrt(variance);
        const coefficientOfVariation = mean > 0 ? stdDev / mean : 1.0;
        
        // LOWER VARIATION = HIGHER CONSISTENCY = HIGHER SCORE
        return Math.max(0.0, 1.0 - coefficientOfVariation);
    }
    
    private calculateBlockGapAnalysis(path: TransactionPath): number {
        // DETECT SUSPICIOUS TIMING PATTERNS
        const blocks = path.blockProgression;
        let suspiciousPatternScore = 0.0;
        
        for (let i = 1; i < blocks.length; i++) {
            const gap = blocks[i] - blocks[i - 1];
            
            // VERY RAPID TRANSACTIONS (potential automation)
            if (gap === 1) suspiciousPatternScore += 0.3;
            
            // SUSPICIOUSLY LARGE GAPS (potential delays/coordination)
            else if (gap > 100) suspiciousPatternScore += 0.2;
            
            // ROUND NUMBER BLOCK GAPS (potential coordination)
            else if (gap % 10 === 0 || gap % 100 === 0) suspiciousPatternScore += 0.1;
        }
        
        return Math.min(1.0, suspiciousPatternScore);
    }
}
```

## Frontend Integration

### File: `user-interface/src/app/analysis/BlockAwarePromiseAnalysis.tsx` (new file)
**Enhanced interface with block filtering visualization:**

```typescript
'use client';
import { useState, useEffect } from 'react';

export default function BlockAwarePromiseAnalysis({ incidentId }: { incidentId: number }) {
    const [analysis, setAnalysis] = useState(null);
    const [isRunning, setIsRunning] = useState(false);
    const [progress, setProgress] = useState({
        depth: 0,
        pathsExplored: 0,
        endpointsFound: 0,
        blockFilterEfficiency: 0,
        temporalViolationsPrevented: 0
    });
    
    const startBlockAwareAnalysis = async () => {
        setIsRunning(true);
        
        const config = {
            beamWidth: 15,
            maxDepth: 6,
            promiseThreshold: 0.30,
            blockFilterEnabled: true,
            enableAIClassification: true,
            maxReasonableBlockGap: 1000,
            minReasonableBlockGap: 1
        };
        
        try {
            const response = await fetch('/api/fund-flow/block-aware-analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ incidentId, config })
            });
            
            const { analysisId } = await response.json();
            
            // POLL FOR PROGRESS WITH BLOCK METRICS
            const progressInterval = setInterval(async () => {
                const progressResponse = await fetch(`/api/fund-flow/block-aware-progress/${analysisId}`);
                const progressData = await progressResponse.json();
                
                setProgress(progressData.progress);
                
                if (progressData.status === 'completed') {
                    clearInterval(progressInterval);
                    setAnalysis(progressData.analysis);
                    setIsRunning(false);
                }
            }, 3000);
            
        } catch (error) {
            console.error('Block-aware analysis failed:', error);
            setIsRunning(false);
        }
    };

    return (
        <div className="block-aware-analysis-container">
            <div className="analysis-controls">
                <h2>Block-Filtered Promise-Guided Analysis</h2>
                
                {!isRunning && !analysis && (
                    <button onClick={startBlockAwareAnalysis} className="start-analysis-btn">
                        Start Block-Aware Analysis
                    </button>
                )}
                
                {isRunning && (
                    <div className="progress-display">
                        <div className="progress-stats">
                            <div>Depth: {progress.depth}/6</div>
                            <div>Paths Explored: {progress.pathsExplored}</div>
                            <div>Endpoints Found: {progress.endpointsFound}</div>
                            <div>Block Filter Efficiency: {progress.blockFilterEfficiency.toFixed(1)}%</div>
                            <div>Temporal Violations Prevented: {progress.temporalViolationsPrevented}</div>
                        </div>
                        <div className="block-progress-visualization">
                            <BlockProgressChart progress={progress} />
                        </div>
                    </div>
                )}
                
                {analysis && (
                    <BlockAwareAnalysisResults analysis={analysis} />
                )}
            </div>
        </div>
    );
}

function BlockProgressChart({ progress }) {
    return (
        <div className="block-metrics-chart">
            <div className="metric-card">
                <h4>Block Filter Performance</h4>
                <div className="efficiency-bar">
                    <div 
                        className="efficiency-fill"
                        style={{ 
                            width: `${progress.blockFilterEfficiency}%`,
                            backgroundColor: progress.blockFilterEfficiency > 50 ? '#22c55e' : '#f59e0b'
                        }}
                    />
                </div>
                <span>{progress.blockFilterEfficiency.toFixed(1)}% filtered</span>
            </div>
            
            <div className="metric-card">
                <h4>Temporal Consistency</h4>
                <div className="violations-prevented">
                    <span className="large-number">{progress.temporalViolationsPrevented}</span>
                    <span className="metric-label">violations prevented</span>
                </div>
            </div>
        </div>
    );
}
```

### File: `user-interface/src/app/api/fund-flow/block-aware-analyze/route.ts` (new file)
**API endpoint with block filtering:**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { BlockAwarePromiseTracker } from '@/services/fund-flow/block-aware-promise-tracker';

export async function POST(req: NextRequest) {
    try {
        const { incidentId, config } = await req.json();
        
        // VALIDATE BLOCK FILTERING CONFIGURATION
        if (!config.blockFilterEnabled) {
            return NextResponse.json(
                { error: 'Block filtering is required for this analysis type' }, 
                { status: 400 }
            );
        }
        
        // GET INCIDENT WITH REQUIRED BLOCK NUMBER
        const incident = await getIncidentWithBlockNumber(incidentId);
        if (!incident || !incident.hack_block_number) {
            return NextResponse.json(
                { error: 'Incident must have hack block number for block-aware analysis' }, 
                { status: 400 }
            );
        }
        
        // CREATE BLOCK-AWARE ANALYSIS RECORD
        const analysisId = await createBlockAwareAnalysisRecord(incidentId, config);
        
        // INITIALIZE BLOCK-AWARE TRACKER
        const tracker = new BlockAwarePromiseTracker(config);
        
        // START ASYNC BLOCK-FILTERED ANALYSIS
        const analysisPromise = tracker.analyzeWithBlockFilteredPromiseGuided(
            analysisId,
            incident.victim_wallet,
            incident.loss_amount,
            incident.hack_timestamp,
            incident.hack_block_number
        );
        
        // HANDLE COMPLETION WITH BLOCK METRICS
        analysisPromise
            .then(result => updateBlockAwareAnalysisComplete(analysisId, result))
            .catch(error => updateBlockAwareAnalysisError(analysisId, error));
        
        return NextResponse.json({ 
            analysisId, 
            status: 'started',
            blockFilterEnabled: true,
            hackBlockNumber: incident.hack_block_number
        });
        
    } catch (error) {
        return NextResponse.json({ 
            error: 'Failed to start block-aware analysis' 
        }, { status: 500 });
    }
}
```

## Enhanced Visualization

### File: `user-interface/src/app/mapping/BlockAwareVisualization.tsx` (new file)
**Visualization with block progression:**

```typescript
import { ResponsiveSankey } from '@nivo/sankey';

export default function BlockAwareVisualization({ analysisData }) {
    const sankeyData = transformBlockAwareDataToSankey(analysisData);
    
    return (
        <div className="block-aware-sankey-container">
            <div className="visualization-controls">
                <h3>Block-Filtered Fund Flow Analysis</h3>
                <div className="block-metrics-summary">
                    <div>Total Paths: {analysisData.totalPaths}</div>
                    <div>Block-Valid Paths: {analysisData.blockValidPaths}</div>
                    <div>Filter Efficiency: {analysisData.averageFilterEfficiency.toFixed(1)}%</div>
                </div>
            </div>
            
            <ResponsiveSankey
                data={sankeyData}
                margin={{ top: 40, right: 180, bottom: 40, left: 50 }}
                nodeOpacity={1}
                nodeThickness={18}
                nodeInnerPadding={3}
                nodeSpacing={24}
                nodeBorderWidth={0}
                linkOpacity={0.6}
                linkHoverOthersOpacity={0.1}
                enableLinkGradient={true}
                // COLOR NODES BY BLOCK PROGRESSION VALIDITY
                colors={(node) => getBlockProgressionColor(node)}
                // ENHANCED TOOLTIP WITH BLOCK INFO
                nodeTooltip={(node) => (
                    <div className="block-aware-tooltip">
                        <strong>{node.id}</strong>
                        <div>Promise Score: {node.promiseScore?.toFixed(3)}</div>
                        <div>Block Number: {node.blockNumber}</div>
                        <div>Block Progression: Valid ✓</div>
                        <div>Classification: {node.classification}</div>
                        <div>Temporal Weight: {node.temporalWeight?.toFixed(3)}</div>
                        <div>Filter Efficiency: {node.filterEfficiency?.toFixed(1)}%</div>
                    </div>
                )}
                linkTooltip={(link) => (
                    <div className="block-link-tooltip">
                        <div>From Block: {link.source.blockNumber}</div>
                        <div>To Block: {link.target.blockNumber}</div>
                        <div>Block Gap: {link.target.blockNumber - link.source.blockNumber}</div>
                        <div>Value: {link.value} ETH</div>
                        <div>Transaction: {link.transactionHash?.substring(0, 10)}...</div>
                    </div>
                )}
            />
            
            <div className="block-progression-timeline">
                <BlockProgressionTimeline paths={analysisData.paths} />
            </div>
        </div>
    );
}

function getBlockProgressionColor(node): string {
    // Color coding based on block progression validity and promise score
    if (!node.blockProgressionValid) return '#ff0000'; // Invalid - red
    if (node.promiseScore >= 0.8) return '#ff4444'; // High promise - bright red
    if (node.promiseScore >= 0.6) return '#ff8800'; // Medium-high - orange  
    if (node.promiseScore >= 0.4) return '#ffcc00'; // Medium - yellow
    if (node.promiseScore >= 0.2) return '#88cc00'; // Low-medium - light green
    return '#44aa44'; // Low promise - green
}

function BlockProgressionTimeline({ paths }) {
    return (
        <div className="timeline-container">
            <h4>Block Progression Timeline</h4>
            {paths.slice(0, 5).map((path, index) => (
                <div key={index} className="path-timeline">
                    <div className="path-header">
                        Path {index + 1} (Promise: {path.promiseScore.toFixed(3)})
                    </div>
                    <div className="block-sequence">
                        {path.blockProgression.map((block, blockIndex) => (
                            <div key={blockIndex} className="block-step">
                                <div className="block-number">{block}</div>
                                {blockIndex < path.blockProgression.length - 1 && (
                                    <div className="block-arrow">
                                        +{path.blockProgression[blockIndex + 1] - block}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}
```

# Implementation Phases Breakdown - Block-Aware Promise-Guided Fund Flow Algorithm
## Phase 1: Block Filter Foundation 
Goal: Establish core block filtering infrastructure
Database Setup

File: db/schema.sql

Add path_block_tracking table
Add block_filter_metrics table
Add block number fields to existing tables
Create block progression validation functions


File: db/migrate_promise_algorithm.sql

Migration script for new tables
Data migration for existing incidents (add block numbers)
Index creation for block number queries



Core Block Filter Service

File: services/fund-flow/block-filter.ts

Implement getBlockFilteredTransactions()
Implement validateBlockProgression()
Implement updateBlockTracking()
Add temporal consistency validation



Basic Queries and Functions

File: db/block-aware-queries.sql

Create get_block_filtered_transactions() function
Create validate_path_block_progression() function
Add performance tracking queries



Testing

File: tests/block-filter.test.ts

Unit tests for block progression validation
Test temporal consistency enforcement
Test filter efficiency calculations



Deliverable: Working block filter service that can filter transactions by block number with performance tracking.

## Phase 2: Core Algorithm Integration 
Goal: Integrate block filtering into main algorithm
Block-Aware Promise Tracker

File: services/fund-flow/block-aware-promise-tracker.ts

Implement main analyzeWithBlockFilteredPromiseGuided() method
Integrate expandPathWithBlockFilter() method
Add path-specific block cursor management
Implement adaptive beam width with block considerations



Enhanced Promise Calculator

File: services/fund-flow/enhanced-promise-calculator.ts

Implement calculateBlockAwarePromiseScore()
Add calculateEnhancedTemporalWeight() with block factors
Implement calculateBlockProgressionBonus()
Add calculateVelocityConsistency() analysis



API Endpoints

File: user-interface/src/app/api/fund-flow/block-aware-analyze/route.ts

Create block-aware analysis endpoint
Add validation for required block numbers
Implement async analysis with block tracking


File: user-interface/src/app/api/fund-flow/block-aware-progress/[id]/route.ts

Progress tracking with block filter metrics
Real-time performance indicators



Type Definitions

File: services/types/block-aware-fund-flow.ts

Define BlockAwareTransactionPath interface
Define BlockFilterResult interface
Define BlockValidationResult interface
Define BlockFilterMetrics interface



Deliverable: Complete algorithm that enforces block progression with promise-guided exploration.

## Phase 3: Pattern Detection & Metrics 
Goal: Enhanced pattern detection with block-aware analysis
Pattern Detection Enhancement

File: services/fund-flow/block-aware-pattern-detector.ts

Implement block interval pattern analysis
Add velocity consistency detection
Implement suspicious timing pattern detection
Add coordinated movement analysis with block correlation



Performance Metrics & Monitoring

File: services/monitoring/block-filter-analytics.ts

Track filter efficiency across different scenarios
Monitor temporal violation prevention
Analyze performance improvements
Generate block filter optimization suggestions



Database Enhancements

File: db/schema.sql (updates)

Add detected_patterns table with block analysis
Add block_filter_metrics performance tracking
Add indexes for block number queries optimization



Testing & Validation

File: tests/pattern-detection.test.ts

Test block-aware pattern detection
Validate temporal consistency in patterns
Test performance improvements measurement



Deliverable: Sophisticated pattern detection that leverages block timing information for enhanced accuracy.

## Phase 4: AI Integration & Optimization 
Goal: AI classification with block-aware optimization
Claude API Integration

File: services/ai/claude-classifier.ts

Implement high-volume address classification (>1000 tx)
Add block activity span analysis to prompts
Include temporal patterns in classification data
Implement classification result caching



Classification Enhancement

File: services/ai/block-aware-classification.ts

Integrate block activity patterns into AI analysis
Add temporal behavior analysis to classification
Implement block-based risk scoring
Add classification confidence based on block patterns



Performance Optimization

File: services/optimization/block-query-optimizer.ts

Implement intelligent block range optimization
Add query batching for sequential blocks
Implement parallel processing for independent paths
Add memory management for large block datasets



Caching Layer

File: services/cache/block-aware-cache.ts

Cache block-filtered transaction results
Cache AI classifications with block context
Implement cache invalidation strategies
Add cache performance metrics



Deliverable: AI-enhanced analysis with optimized performance and intelligent caching.

## Phase 5: Frontend & Visualization 
Goal: Complete user interface with block-aware visualizations
Block-Aware Analysis Interface

File: user-interface/src/app/analysis/BlockAwarePromiseAnalysis.tsx

Implement analysis configuration interface
Add real-time progress with block metrics
Display filter efficiency and temporal violations prevented
Add block progression validation status



Enhanced Visualization

File: user-interface/src/app/mapping/BlockAwareVisualization.tsx

Implement block-progression Sankey diagrams
Add block timeline visualization
Color-code nodes by block progression validity
Add interactive block progression explorer



Progress & Metrics Display

File: user-interface/src/components/BlockFilterMetrics.tsx

Real-time block filter performance display
Filter efficiency visualization
Temporal violations prevented counter
Performance improvement indicators



Report Generation

File: services/reports/block-aware-report-generator.ts

Enhanced PDF reports with block analysis
Include block progression diagrams
Add temporal consistency validation summary
Include filter performance metrics



Styling & UX

File: user-interface/src/styles/block-aware-analysis.css

Styling for block progression visualizations
Color schemes for temporal validity indicators
Responsive design for metrics displays
Animation for real-time updates



Deliverable: Complete user interface with advanced block-aware visualizations and reporting.