# Transaction Graph Mapping Algorithm Specification

## Overview
A Python service that constructs transaction flow graphs from incident reports by recursively tracing cryptocurrency movements through blockchain addresses.

## Input
- **Incident ID**: UUID from existing `incidents` table

## Core Algorithm Logic

### 1. Initialization
- Retrieve incident data and associated transaction details from database
- Extract victim wallet address and hack transaction hash
- Initialize NetworkX directed graph
- Create Node 0: victim wallet address
- Create Node 1: hacker wallet address (from hack transaction `to_address`)
- Add edge: victim → hacker (labeled with hack transaction hash)

### 2. Recursive Transaction Traversal

**For each unprocessed node in the graph:**

1. **Query Etherscan API**
   - Endpoint: `https://api.etherscan.io/api?module=account&action=txlist`
   - Parameters:
     - `address`: current node address
     - `startblock`: block number of transaction that led to this node
     - `endblock`: 99999999
     - `page`: 1
     - `offset`: 50 (increased to apply filters effectively)
     - `sort`: asc

2. **Transaction Filtering Pipeline**

   **Primary Filters (Applied First):**
   - **Minimum Value**: Only process transactions >0.05 ETH or >0.1% of total stolen amount
   - **Percentage Threshold**: Dynamic based on hack size:
     - >0.1% for hacks >100 ETH
     - >0.5% for hacks 10-100 ETH  
     - >1% for hacks <10 ETH
   - **Time-Based Priority**: 
     - High priority: <6 hours after receiving funds
     - Medium priority: 6-72 hours 
     - Low priority: 3-30 days (only if >1 ETH)
     - No time limit for transactions >10 ETH
   - **Outgoing Only**: Filter where `from` = current node address

   **Secondary Filters (Applied to Remaining):**
   - **High-Frequency Detection**: If destination has >100 transactions/day:
     - Mark as endpoint with type "high_frequency_service" (confidence: 60%)
     - Skip further exploration but keep in graph
   - **Round Number Priority**: Prioritize transactions with "clean" amounts (<3 decimals)
   - **Address Reuse Management**: If destination seen 3+ times in graph:
     - Mark as endpoint with type "consolidation_point" (confidence: 70%)
     - Increase priority score (potential important hub)
     - Continue exploration with higher scrutiny

   **Tertiary Filters (Fine-tuning):**
   - **Gas Priority**: Rank by above-average gas price (>120% of block average)
     - *Logic*: Higher gas = urgency = likely manual intervention
   - **Value-to-Gas Ratio**: Prioritize highest `value_wei / (gas_used * gas_price)`
     - *Logic*: Efficient high-value transfers vs spam/dust transactions  
   - **Immediate Movement**: Bonus priority for movements within 10 blocks
     - *Logic*: Quick movements suggest pre-planned laundering operations

3. **Process Filtered Transactions**
   - Apply filtering pipeline to all outgoing transactions
   - Sort remaining transactions by priority score
   - Process top 5 highest-priority transactions only
   - For each valid transaction:
     - Create new node for `to_address` (if not exists)
     - Add edge with transaction details and priority score
     - Mark new node for processing

4. **Branch Termination Conditions**
   - **High Transaction Volume**: If node has >200 total outgoing transactions:
     - Mark as endpoint with type "potential_endpoint" (confidence: 80%)
     - Reason: "high_transaction_volume" 
     - Store full node data for manual exploration
   - **No Valid Transactions**: If no transactions pass primary filters:
     - Mark as endpoint with type "non_promising_endpoint" (confidence: 90%)
     - Reason: "no_significant_transactions"
   - **High Confidence Classification**: If endpoint classification confidence >70%:
     - Mark as endpoint with detected type (CEX/DEX/Mixer/etc.)
     - Reason: "high_confidence_classification"
   - **Low Value Flow**: If cumulative outgoing value <5% of original stolen amount:
     - Mark as endpoint with type "non_promising_endpoint" (confidence: 85%)
     - Reason: "insufficient_value_flow"
   - **Maximum Depth**: If maximum depth of 8 hops reached:
     - Mark as endpoint with type "non_promising_endpoint" (confidence: 75%)
     - Reason: "max_depth_reached"

   **Note**: All terminated nodes retain full attributes for potential manual continuation

### 3. Graph Optimization

**Post-Processing Steps:**

1. **Dead End Removal**
   - Remove nodes with zero outgoing edges (unless marked as endpoints)
   - Preserve nodes that represent actual fund destinations

2. **Entity Consolidation**
   - **Detection Methods**:
     - Same entity name from endpoint classification APIs
     - Address clustering (common ownership patterns)
     - Known address lists (multiple addresses belonging to same exchange)
   - **Consolidation Process**:
     - Create master node with primary address
     - Merge transaction volumes from all consolidated addresses
     - Update edge connections to point to master node
     - Store original addresses in `consolidated_addresses` attribute
   - **Example**: Binance1, Binance2, Binance3 → Single "Binance" node

3. **Flow Analysis**
   - Calculate flow percentages: `(path_value / total_stolen_amount) * 100`
   - Identify critical paths: >10% of stolen funds
   - Mark path importance: "critical", "significant", "minor"

4. **Path Ranking**
   - **Primary Score**: Transaction value (50% weight)
   - **Recency Score**: Time proximity to hack (30% weight)  
   - **Endpoint Score**: Endpoint type importance (20% weight)
   - **Final Ranking**: Weighted combination of all scores

## Data Structures

### Node Attributes
- `address`: Ethereum address
- `entity_type`: Classification (CEX/DEX/Mixer/potential_endpoint/non_promising_endpoint/Unknown)
- `confidence_score`: Endpoint classification confidence (0-100)
- `termination_reason`: Why exploration stopped ("high_confidence_classification", "max_depth_reached", etc.)
- `balance_eth`: Current ETH balance
- `transaction_count`: Total number of transactions
- `first_seen`: Block number when first encountered
- `endpoint_type`: Specific classification (CEX/DEX/Mixer/Unknown)
- `consolidated_addresses`: List of addresses merged into this node (if applicable)
- `manual_exploration_ready`: Boolean flag indicating if user can continue exploration

### Edge Attributes
- `transaction_hash`: Etherscan transaction hash
- `value`: Transaction value in Wei
- `value_usd`: Transaction value in USD at time of transaction
- `block_number`: Block number of transaction
- `timestamp`: Transaction timestamp
- `gas_used`: Gas consumed
- `gas_price`: Gas price used
- `priority_score`: Calculated priority based on filtering criteria (0-100)
- `filter_reason`: Why transaction was selected (e.g., "high_value", "round_number")

## Output
- **NetworkX Graph Object**: Complete transaction flow graph
- **Graph Statistics**: Total nodes, edges, max depth, total value traced
- **Top Paths**: Ranked list of significant transaction paths
- **Endpoint Summary**: Count by endpoint type (CEX: 5, DEX: 2, etc.)

## Implementation Architecture

### Phase 1: Single Service Approach (Recommended Start)

**Service Architecture:**
```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Web API       │───▶│  Graph Service   │───▶│   Database      │
│   (Trigger)     │    │  (Single Python  │    │   (Dedicated)   │
│                 │    │   Instance)      │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

**Core Service Components:**
```python
class GraphMappingService:
    def __init__(self):
        self.db_pool = create_connection_pool()
        self.etherscan_client = EtherscanClient(cache_ttl=600)
        self.endpoint_classifier = EndpointClassifier()
    
    async def process_incident(self, incident_id):
        # 1. Initialize graph from incident data
        # 2. Recursive traversal with filtering pipeline
        # 3. Endpoint detection and classification
        # 4. Graph optimization and consolidation
        # 5. Database storage (nodes, edges, metadata)
        # 6. Return processing summary
```

**Technical Specifications:**
- **Language**: Python 3.9+
- **Framework**: FastAPI for REST endpoints
- **Graph Library**: NetworkX for graph operations
- **Database**: PostgreSQL with asyncpg driver
- **Caching**: In-memory LRU cache for Etherscan responses
- **Concurrency**: Async/await for I/O operations
- **Queue**: Simple in-memory queue for multiple incidents

**Infrastructure Requirements:**
- **Instance**: 2-4 CPU cores, 8GB RAM
- **Storage**: 50GB SSD for application and logs
- **Network**: Stable internet for Etherscan API calls
- **Database**: Dedicated PostgreSQL instance (separate)

**Service Features:**
- Async Etherscan API calls with retry logic
- Local response caching (10-minute TTL)
- Database connection pooling (10-20 connections)
- Simple job queue for handling multiple incidents
- Comprehensive logging and error handling
- Processing timeout management (30 seconds)

**Scaling Triggers for Future Phases:**
- Processing >50 incidents/day
- Individual incidents taking >2 minutes  
- API rate limits becoming bottleneck
- Need for real-time processing

## Performance Constraints
- Maximum 500 nodes per graph
- Maximum 25 API calls per incident (reduced due to filtering efficiency)
- Process maximum 5 transactions per node (highest priority only)
- 30-second timeout per incident processing
- Cache Etherscan responses for 10 minutes
- Cache USD price data for 1 hour

## Error Handling
- Continue processing on individual API failures
- Skip malformed transaction data
- Log all errors with incident context
- Return partial graph if timeout reached

## Storage

### Database Schema

**Graph Nodes Table:**
```sql
CREATE TABLE graph_nodes (
    incident_id UUID,
    address VARCHAR(42),
    entity_type VARCHAR(50),
    confidence_score DECIMAL(5,2),
    balance_eth DECIMAL(20,8),
    transaction_count INTEGER,
    risk_level VARCHAR(20),
    depth_from_hack INTEGER,
    discovery_timestamp TIMESTAMP,
    attributes JSONB,  -- flexible additional data
    created_at TIMESTAMP,
    PRIMARY KEY (incident_id, address)
);
```

**Graph Edges Table:**
```sql
CREATE TABLE graph_edges (
    incident_id UUID,
    from_address VARCHAR(42),
    to_address VARCHAR(42),
    transaction_hash VARCHAR(66),
    value_eth DECIMAL(20,8),
    value_usd DECIMAL(15,2),
    priority_score INTEGER,
    block_number BIGINT,
    timestamp TIMESTAMP,
    gas_used BIGINT,
    gas_price BIGINT,
    filter_reason VARCHAR(100),
    attributes JSONB,  -- flexible additional data
    created_at TIMESTAMP,
    PRIMARY KEY (incident_id, from_address, to_address, transaction_hash)
);
```

**Graph Metadata Table:**
```sql
CREATE TABLE incident_graphs (
    incident_id UUID PRIMARY KEY,
    total_nodes INTEGER,
    total_edges INTEGER,
    max_depth INTEGER,
    total_value_traced DECIMAL(20,8),
    processing_time_seconds INTEGER,
    endpoint_summary JSONB,  -- count by entity type
    status VARCHAR(20),  -- 'completed', 'timeout', 'error'
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);
```

### Storage Process
1. **During Graph Construction**: Insert nodes and edges as they are discovered
2. **Graph Completion**: Update metadata table with final statistics
3. **Graph Reconstruction**: Load NetworkX graph from database tables when needed

### Indexing Strategy
- Index on `(incident_id, entity_type)` for endpoint queries
- Index on `(incident_id, value_eth DESC)` for high-value path analysis
- Index on `(incident_id, depth_from_hack)` for depth-based queries