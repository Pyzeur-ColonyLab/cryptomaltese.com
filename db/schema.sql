-- incidents table
CREATE TABLE incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_address VARCHAR NOT NULL,
    chain VARCHAR NOT NULL,
    description TEXT NOT NULL,
    discovered_at TIMESTAMP NOT NULL,
    tx_hash VARCHAR,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    report_status VARCHAR NOT NULL CHECK (report_status IN ('pending', 'complete', 'error'))
);

-- api_cache table
CREATE TABLE api_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key VARCHAR NOT NULL UNIQUE,
    data JSONB NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP
);

-- reports table
CREATE TABLE reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
    pdf_url VARCHAR NOT NULL,
    summary TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS incident_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
    data JSONB NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- analysis table for storing enhanced fund flow analysis results
CREATE TABLE IF NOT EXISTS analysis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
    analysis_data JSONB NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Enhanced fund flow analysis for microservice integration
CREATE TABLE IF NOT EXISTS fund_flow_analysis (
    id SERIAL PRIMARY KEY,
    incident_id INTEGER REFERENCES incidents(id),
    victim_wallet VARCHAR(42) NOT NULL,
    total_loss_amount DECIMAL(36,18),
    hack_timestamp TIMESTAMP,
    hack_block_number BIGINT NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    algorithm_type VARCHAR(30) DEFAULT 'python_microservice',
    max_depth INTEGER DEFAULT 6,
    total_paths_explored INTEGER DEFAULT 0,
    endpoints_found INTEGER DEFAULT 0,
    confidence_score DECIMAL(3,2),
    created_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP
);

-- Transaction paths for microservice results
CREATE TABLE IF NOT EXISTS transaction_paths (
    id SERIAL PRIMARY KEY,
    analysis_id INTEGER REFERENCES fund_flow_analysis(id),
    path_identifier VARCHAR(50) NOT NULL,
    depth_level INTEGER NOT NULL,
    from_address VARCHAR(42) NOT NULL,
    to_address VARCHAR(42) NOT NULL,
    transaction_hash VARCHAR(66) NOT NULL,
    value_amount DECIMAL(36,18),
    timestamp TIMESTAMP,
    block_number BIGINT,
    confidence_score DECIMAL(3,2),
    patterns JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Address classification for microservice results
CREATE TABLE IF NOT EXISTS address_analysis (
    id SERIAL PRIMARY KEY,
    address VARCHAR(42) UNIQUE NOT NULL,
    classification VARCHAR(20),
    risk_score DECIMAL(3,2),
    transaction_count BIGINT,
    total_volume DECIMAL(36,18),
    first_seen_block BIGINT,
    last_seen_block BIGINT,
    analysis_confidence DECIMAL(3,2),
    ai_classification_used BOOLEAN DEFAULT FALSE,
    ai_classification_data JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Pattern detection for microservice results
CREATE TABLE IF NOT EXISTS detected_patterns (
    id SERIAL PRIMARY KEY,
    analysis_id INTEGER REFERENCES fund_flow_analysis(id),
    path_id INTEGER REFERENCES transaction_paths(id),
    pattern_type VARCHAR(30) NOT NULL,
    pattern_strength DECIMAL(3,2),
    affected_transactions TEXT[],
    block_numbers BIGINT[],
    pattern_details JSONB,
    detected_at TIMESTAMP DEFAULT NOW()
);

-- Analysis progress tracking for microservice
CREATE TABLE IF NOT EXISTS analysis_progress (
    id SERIAL PRIMARY KEY,
    analysis_id INTEGER REFERENCES fund_flow_analysis(id),
    status VARCHAR(20) DEFAULT 'pending', -- pending, running, completed, failed
    progress_data JSONB, -- Progress updates from Python service
    results_data JSONB, -- Final results from Python service
    python_service_id VARCHAR(100), -- ID from Python microservice
    started_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP,
    error_message TEXT
);

-- Microservice communication log
CREATE TABLE IF NOT EXISTS microservice_log (
    id SERIAL PRIMARY KEY,
    analysis_id INTEGER REFERENCES fund_flow_analysis(id),
    service_name VARCHAR(50) NOT NULL, -- 'python-algorithm'
    action VARCHAR(50) NOT NULL, -- 'start', 'progress', 'complete', 'error'
    data JSONB,
    timestamp TIMESTAMP DEFAULT NOW()
);

-- Analysis endpoints (final destinations)
CREATE TABLE IF NOT EXISTS analysis_endpoints (
    id SERIAL PRIMARY KEY,
    analysis_id INTEGER REFERENCES fund_flow_analysis(id) ON DELETE CASCADE,
    address VARCHAR(42) NOT NULL,
    classification VARCHAR(20),
    total_amount DECIMAL(36,18),
    transaction_count INTEGER,
    confidence DECIMAL(3,2),
    risk_level VARCHAR(10), -- low, medium, high, critical
    created_at TIMESTAMP DEFAULT NOW()
); 