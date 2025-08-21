-- Database Bootstrap SQL for Graph Mapping Service
-- This script creates all the required tables as specified in graph_mapping_spec.md

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create incidents table (if not exists)
CREATE TABLE IF NOT EXISTS incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    wallet_address VARCHAR(42) NOT NULL,
    transaction_hash VARCHAR(66),
    incident_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    total_loss_usd DECIMAL(15,2),
    total_loss_eth DECIMAL(20,8),
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create transaction_details table (if not exists)
CREATE TABLE IF NOT EXISTS transaction_details (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
    transaction_hash VARCHAR(66) NOT NULL,
    from_address VARCHAR(42) NOT NULL,
    to_address VARCHAR(42) NOT NULL,
    value VARCHAR(50) NOT NULL, -- Wei as string to handle large numbers
    block_number BIGINT,
    timestamp TIMESTAMP WITH TIME ZONE,
    gas_used BIGINT,
    gas_price BIGINT,
    transaction_fee VARCHAR(50),
    status VARCHAR(20) DEFAULT 'confirmed',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create graph_nodes table (from specification)
CREATE TABLE IF NOT EXISTS graph_nodes (
    incident_id UUID NOT NULL,
    address VARCHAR(42) NOT NULL,
    entity_type VARCHAR(50) DEFAULT 'Unknown',
    confidence_score DECIMAL(5,2) DEFAULT 0.00,
    balance_eth DECIMAL(20,8) DEFAULT 0.00000000,
    transaction_count INTEGER DEFAULT 0,
    risk_level VARCHAR(20),
    depth_from_hack INTEGER DEFAULT 0,
    discovery_timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    first_seen BIGINT, -- Block number
    endpoint_type VARCHAR(50) DEFAULT 'Unknown',
    termination_reason VARCHAR(100),
    manual_exploration_ready BOOLEAN DEFAULT FALSE,
    attributes JSONB DEFAULT '{}', -- Flexible additional data
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (incident_id, address),
    FOREIGN KEY (incident_id) REFERENCES incidents(id) ON DELETE CASCADE
);

-- Create graph_edges table (from specification) 
CREATE TABLE IF NOT EXISTS graph_edges (
    incident_id UUID NOT NULL,
    from_address VARCHAR(42) NOT NULL,
    to_address VARCHAR(42) NOT NULL,
    transaction_hash VARCHAR(66) NOT NULL,
    value_eth DECIMAL(20,8) DEFAULT 0.00000000,
    value_usd DECIMAL(15,2),
    priority_score INTEGER DEFAULT 0,
    block_number BIGINT,
    timestamp TIMESTAMP WITH TIME ZONE,
    gas_used BIGINT,
    gas_price BIGINT,
    filter_reason VARCHAR(100),
    attributes JSONB DEFAULT '{}', -- Flexible additional data
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (incident_id, from_address, to_address, transaction_hash),
    FOREIGN KEY (incident_id) REFERENCES incidents(id) ON DELETE CASCADE
);

-- Create incident_graphs table (from specification)
CREATE TABLE IF NOT EXISTS incident_graphs (
    incident_id UUID PRIMARY KEY,
    total_nodes INTEGER DEFAULT 0,
    total_edges INTEGER DEFAULT 0,
    max_depth INTEGER DEFAULT 0,
    total_value_traced DECIMAL(20,8) DEFAULT 0.00000000,
    processing_time_seconds INTEGER,
    api_calls_used INTEGER DEFAULT 0,
    endpoint_summary JSONB DEFAULT '{}', -- Count by entity type
    top_paths JSONB DEFAULT '[]', -- Ranked list of significant paths
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'running', 'completed', 'timeout', 'error'
    progress_percentage INTEGER DEFAULT 0,
    current_step VARCHAR(100),
    error_message TEXT,
    error_code VARCHAR(50),
    partial_results JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (incident_id) REFERENCES incidents(id) ON DELETE CASCADE
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_incidents_wallet_address ON incidents(wallet_address);
CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status);
CREATE INDEX IF NOT EXISTS idx_transaction_details_incident ON transaction_details(incident_id);
CREATE INDEX IF NOT EXISTS idx_transaction_details_hash ON transaction_details(transaction_hash);
CREATE INDEX IF NOT EXISTS idx_graph_nodes_entity_type ON graph_nodes(incident_id, entity_type);
CREATE INDEX IF NOT EXISTS idx_graph_nodes_depth ON graph_nodes(incident_id, depth_from_hack);
CREATE INDEX IF NOT EXISTS idx_graph_edges_value ON graph_edges(incident_id, value_eth DESC);
CREATE INDEX IF NOT EXISTS idx_graph_edges_priority ON graph_edges(incident_id, priority_score DESC);
CREATE INDEX IF NOT EXISTS idx_incident_graphs_status ON incident_graphs(status);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers
DROP TRIGGER IF EXISTS update_incidents_updated_at ON incidents;
CREATE TRIGGER update_incidents_updated_at
    BEFORE UPDATE ON incidents
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_incident_graphs_updated_at ON incident_graphs;
CREATE TRIGGER update_incident_graphs_updated_at
    BEFORE UPDATE ON incident_graphs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert sample data for testing (if no incidents exist)
INSERT INTO incidents (id, title, description, wallet_address, transaction_hash, total_loss_eth, status)
SELECT 
    '550e8400-e29b-41d4-a716-446655440000'::uuid,
    'Sample Incident for Testing',
    'A test incident for graph mapping service development',
    '0x1234567890123456789012345678901234567890',
    '0xabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdef',
    10.5,
    'pending'
WHERE NOT EXISTS (SELECT 1 FROM incidents);

-- Insert corresponding transaction details
INSERT INTO transaction_details (incident_id, transaction_hash, from_address, to_address, value, block_number)
SELECT 
    '550e8400-e29b-41d4-a716-446655440000'::uuid,
    '0xabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdef',
    '0x1234567890123456789012345678901234567890',
    '0x0987654321098765432109876543210987654321',
    '10500000000000000000', -- 10.5 ETH in Wei
    18500000
WHERE NOT EXISTS (
    SELECT 1 FROM transaction_details 
    WHERE incident_id = '550e8400-e29b-41d4-a716-446655440000'::uuid
);

-- Display success message
DO $$
BEGIN
    RAISE NOTICE 'Graph Mapping Service database schema created successfully!';
    RAISE NOTICE 'Tables created: incidents, transaction_details, graph_nodes, graph_edges, incident_graphs';
    RAISE NOTICE 'Sample test data inserted for development';
END $$;
