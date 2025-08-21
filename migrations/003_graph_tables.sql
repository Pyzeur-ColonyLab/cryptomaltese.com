-- Graph Mapping Tables Migration
-- Creates tables for storing transaction flow graphs as specified in graph_mapping_spec.md

-- Graph Nodes Table
-- Stores individual addresses in the transaction graph
CREATE TABLE IF NOT EXISTS graph_nodes (
    incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
    address VARCHAR(42) NOT NULL,
    entity_type VARCHAR(50) DEFAULT 'Unknown' CHECK (
        entity_type IN (
            'CEX', 'DEX', 'Mixer', 'potential_endpoint', 
            'non_promising_endpoint', 'high_frequency_service',
            'consolidation_point', 'Unknown'
        )
    ),
    confidence_score DECIMAL(5,2) DEFAULT 0 CHECK (confidence_score >= 0 AND confidence_score <= 100),
    termination_reason VARCHAR(100),
    balance_eth DECIMAL(20,8) DEFAULT 0,
    transaction_count INTEGER DEFAULT 0,
    first_seen BIGINT, -- Block number when first encountered
    depth_from_hack INTEGER NOT NULL DEFAULT 0,
    endpoint_type VARCHAR(50) DEFAULT 'Unknown',
    consolidated_addresses TEXT[], -- Array of addresses merged into this node
    manual_exploration_ready BOOLEAN DEFAULT FALSE,
    discovery_timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    attributes JSONB DEFAULT '{}', -- Flexible additional data storage
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (incident_id, address)
);

-- Graph Edges Table  
-- Stores transactions between addresses in the graph
CREATE TABLE IF NOT EXISTS graph_edges (
    incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
    from_address VARCHAR(42) NOT NULL,
    to_address VARCHAR(42) NOT NULL,
    transaction_hash VARCHAR(66) NOT NULL,
    value_eth DECIMAL(20,8) NOT NULL DEFAULT 0,
    value_usd DECIMAL(15,2),
    priority_score INTEGER DEFAULT 0 CHECK (priority_score >= 0 AND priority_score <= 100),
    block_number BIGINT,
    timestamp TIMESTAMP WITH TIME ZONE,
    gas_used BIGINT,
    gas_price BIGINT,
    filter_reason VARCHAR(100), -- Why this transaction was selected (e.g., "high_value", "round_number")
    attributes JSONB DEFAULT '{}', -- Flexible additional data storage
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (incident_id, from_address, to_address, transaction_hash),
    
    -- Ensure from/to addresses exist in graph_nodes
    FOREIGN KEY (incident_id, from_address) REFERENCES graph_nodes(incident_id, address),
    FOREIGN KEY (incident_id, to_address) REFERENCES graph_nodes(incident_id, address)
);

-- Graph Metadata Table
-- Stores summary statistics and processing status for each incident's graph
CREATE TABLE IF NOT EXISTS incident_graphs (
    incident_id UUID PRIMARY KEY REFERENCES incidents(id) ON DELETE CASCADE,
    total_nodes INTEGER DEFAULT 0,
    total_edges INTEGER DEFAULT 0,
    max_depth INTEGER DEFAULT 0,
    total_value_traced DECIMAL(20,8) DEFAULT 0,
    processing_time_seconds INTEGER DEFAULT 0,
    api_calls_used INTEGER DEFAULT 0,
    endpoint_summary JSONB DEFAULT '{}', -- Count by entity type: {"CEX": 3, "DEX": 1, "Mixer": 0}
    top_paths JSONB DEFAULT '[]', -- Array of significant transaction paths
    status VARCHAR(20) DEFAULT 'pending' CHECK (
        status IN ('pending', 'running', 'completed', 'timeout', 'error')
    ),
    progress_percentage INTEGER DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
    current_step VARCHAR(100),
    error_message TEXT,
    error_code VARCHAR(50),
    partial_results JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Performance Indexes
-- Optimize queries for graph analysis and endpoint detection

-- Graph Nodes Indexes
CREATE INDEX IF NOT EXISTS idx_graph_nodes_incident_entity_type 
    ON graph_nodes(incident_id, entity_type);
    
CREATE INDEX IF NOT EXISTS idx_graph_nodes_incident_depth 
    ON graph_nodes(incident_id, depth_from_hack);
    
CREATE INDEX IF NOT EXISTS idx_graph_nodes_address 
    ON graph_nodes(address);
    
CREATE INDEX IF NOT EXISTS idx_graph_nodes_confidence 
    ON graph_nodes(incident_id, confidence_score DESC);

-- Graph Edges Indexes  
CREATE INDEX IF NOT EXISTS idx_graph_edges_incident_value 
    ON graph_edges(incident_id, value_eth DESC);
    
CREATE INDEX IF NOT EXISTS idx_graph_edges_from_address 
    ON graph_edges(incident_id, from_address);
    
CREATE INDEX IF NOT EXISTS idx_graph_edges_to_address 
    ON graph_edges(incident_id, to_address);
    
CREATE INDEX IF NOT EXISTS idx_graph_edges_transaction_hash 
    ON graph_edges(transaction_hash);
    
CREATE INDEX IF NOT EXISTS idx_graph_edges_block_number 
    ON graph_edges(incident_id, block_number);

-- Incident Graphs Indexes
CREATE INDEX IF NOT EXISTS idx_incident_graphs_status 
    ON incident_graphs(status, created_at);
    
CREATE INDEX IF NOT EXISTS idx_incident_graphs_updated 
    ON incident_graphs(updated_at DESC);

-- Update trigger for incident_graphs.updated_at
CREATE TRIGGER update_incident_graphs_updated_at 
    BEFORE UPDATE ON incident_graphs 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Comments for documentation
COMMENT ON TABLE graph_nodes IS 'Stores individual addresses (nodes) in transaction flow graphs';
COMMENT ON TABLE graph_edges IS 'Stores transactions (edges) between addresses in the graph';  
COMMENT ON TABLE incident_graphs IS 'Stores metadata and processing status for incident graphs';

COMMENT ON COLUMN graph_nodes.entity_type IS 'Classification of the address (CEX/DEX/Mixer/etc)';
COMMENT ON COLUMN graph_nodes.confidence_score IS 'Classification confidence percentage (0-100)';
COMMENT ON COLUMN graph_nodes.termination_reason IS 'Why graph exploration stopped at this node';
COMMENT ON COLUMN graph_nodes.consolidated_addresses IS 'Other addresses merged into this master node';

COMMENT ON COLUMN graph_edges.priority_score IS 'Transaction priority score from filtering pipeline (0-100)';
COMMENT ON COLUMN graph_edges.filter_reason IS 'Why this transaction was selected for inclusion';

COMMENT ON COLUMN incident_graphs.endpoint_summary IS 'JSON object with count by endpoint type';
COMMENT ON COLUMN incident_graphs.top_paths IS 'JSON array of most significant transaction paths';
COMMENT ON COLUMN incident_graphs.status IS 'Current processing status of the graph job';
