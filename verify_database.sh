#!/bin/bash

# Database Verification Script
# Check graph processing results in the database

set -e

# Configuration
DB_CONTAINER="cryptomaltese-db"
DB_USER="cryptomaltese_user"
DB_NAME="cryptomaltese"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"
}

success() {
    echo -e "${GREEN}✅ $1${NC}"
}

warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

error() {
    echo -e "${RED}❌ $1${NC}"
}

# Execute SQL query
execute_sql() {
    docker-compose exec -T database psql -U "$DB_USER" -d "$DB_NAME" -c "$1"
}

# Check database tables
check_tables() {
    log "Checking database tables..."
    
    echo "📋 Available tables:"
    execute_sql "\dt"
    
    echo ""
    echo "📊 Table sizes:"
    execute_sql "
    SELECT 
        schemaname,
        tablename,
        attname,
        n_distinct,
        correlation
    FROM pg_stats 
    WHERE schemaname = 'public' 
    AND tablename IN ('incidents', 'graph_nodes', 'graph_edges', 'incident_graphs')
    ORDER BY tablename, attname;
    "
}

# Check incidents
check_incidents() {
    log "Checking incidents..."
    
    echo "📈 Incident summary:"
    execute_sql "
    SELECT 
        COUNT(*) as total_incidents,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_incidents,
        MAX(created_at) as latest_incident
    FROM incidents;
    "
    
    echo ""
    echo "📝 Recent incidents:"
    execute_sql "
    SELECT 
        id,
        title,
        victim_address,
        hacker_address,
        amount_stolen_eth,
        status,
        created_at
    FROM incidents 
    ORDER BY created_at DESC 
    LIMIT 5;
    "
}

# Check graph processing results
check_graph_results() {
    log "Checking graph processing results..."
    
    echo "🕸️ Graph processing summary:"
    execute_sql "
    SELECT 
        COUNT(DISTINCT ig.incident_id) as incidents_with_graphs,
        COUNT(DISTINCT gn.id) as total_nodes,
        COUNT(DISTINCT ge.id) as total_edges,
        MAX(ig.created_at) as latest_graph_processing
    FROM incident_graphs ig
    LEFT JOIN graph_nodes gn ON ig.id = gn.incident_graph_id
    LEFT JOIN graph_edges ge ON ig.id = ge.incident_graph_id;
    "
    
    echo ""
    echo "🎯 Recent graph processing jobs:"
    execute_sql "
    SELECT 
        ig.incident_id,
        ig.job_id,
        ig.status,
        ig.total_nodes,
        ig.total_edges,
        ig.max_depth_reached,
        ig.total_value_traced_eth,
        ig.processing_duration_seconds,
        ig.created_at
    FROM incident_graphs ig
    ORDER BY ig.created_at DESC 
    LIMIT 5;
    "
}

# Check graph nodes details
check_nodes() {
    log "Checking graph nodes..."
    
    echo "🏠 Node types distribution:"
    execute_sql "
    SELECT 
        entity_type,
        COUNT(*) as count,
        AVG(confidence_score) as avg_confidence
    FROM graph_nodes 
    GROUP BY entity_type
    ORDER BY count DESC;
    "
    
    echo ""
    echo "🏁 Endpoint summary:"
    execute_sql "
    SELECT 
        termination_reason,
        COUNT(*) as count
    FROM graph_nodes 
    WHERE termination_reason IS NOT NULL
    GROUP BY termination_reason
    ORDER BY count DESC;
    "
}

# Check graph edges details
check_edges() {
    log "Checking graph edges..."
    
    echo "💰 Transaction value distribution:"
    execute_sql "
    SELECT 
        COUNT(*) as total_edges,
        MIN(value_eth) as min_value_eth,
        AVG(value_eth) as avg_value_eth,
        MAX(value_eth) as max_value_eth,
        SUM(value_eth) as total_value_eth
    FROM graph_edges;
    "
    
    echo ""
    echo "⭐ High priority transactions:"
    execute_sql "
    SELECT 
        ge.transaction_hash,
        ge.value_eth,
        ge.priority_score,
        ge.filter_reason,
        gn_from.address as from_address,
        gn_to.address as to_address
    FROM graph_edges ge
    JOIN graph_nodes gn_from ON ge.from_node_id = gn_from.id
    JOIN graph_nodes gn_to ON ge.to_node_id = gn_to.id
    WHERE ge.priority_score > 0.7
    ORDER BY ge.priority_score DESC
    LIMIT 10;
    "
}

# Show processing errors
check_errors() {
    log "Checking for processing errors..."
    
    echo "❌ Failed processing jobs:"
    execute_sql "
    SELECT 
        incident_id,
        job_id,
        error_message,
        created_at
    FROM incident_graphs 
    WHERE status = 'failed'
    ORDER BY created_at DESC
    LIMIT 5;
    "
}

# Performance metrics
check_performance() {
    log "Checking performance metrics..."
    
    echo "⚡ Processing performance:"
    execute_sql "
    SELECT 
        AVG(processing_duration_seconds) as avg_duration_seconds,
        MIN(processing_duration_seconds) as min_duration_seconds,
        MAX(processing_duration_seconds) as max_duration_seconds,
        AVG(total_nodes) as avg_nodes_per_graph,
        AVG(total_edges) as avg_edges_per_graph
    FROM incident_graphs 
    WHERE status = 'completed';
    "
    
    echo ""
    echo "📈 Processing efficiency:"
    execute_sql "
    SELECT 
        CASE 
            WHEN processing_duration_seconds < 30 THEN 'Fast (<30s)'
            WHEN processing_duration_seconds < 120 THEN 'Medium (30s-2m)'
            WHEN processing_duration_seconds < 300 THEN 'Slow (2m-5m)'
            ELSE 'Very Slow (>5m)'
        END as speed_category,
        COUNT(*) as count
    FROM incident_graphs 
    WHERE status = 'completed'
    GROUP BY speed_category
    ORDER BY 
        CASE speed_category
            WHEN 'Fast (<30s)' THEN 1
            WHEN 'Medium (30s-2m)' THEN 2
            WHEN 'Slow (2m-5m)' THEN 3
            ELSE 4
        END;
    "
}

# Main verification
main() {
    echo "🔍 Database Verification for Graph Service"
    echo "=========================================="
    
    # Check if database is accessible
    if ! docker-compose exec database pg_isready -U "$DB_USER" -d "$DB_NAME" &>/dev/null; then
        error "Database is not accessible"
        echo "Try: docker-compose up -d database"
        exit 1
    fi
    
    success "Database is accessible"
    
    # Run all checks
    echo ""
    check_tables
    echo ""
    check_incidents
    echo ""
    check_graph_results
    echo ""
    check_nodes
    echo ""
    check_edges
    echo ""
    check_errors
    echo ""
    check_performance
    
    echo ""
    success "Database verification complete! 🎉"
}

# Help function
show_help() {
    echo "Database Verification Script"
    echo ""
    echo "Usage: $0 [COMMAND]"
    echo ""
    echo "Commands:"
    echo "  help        Show this help message"
    echo "  tables      Check database tables only"
    echo "  incidents   Check incidents data only"
    echo "  graphs      Check graph results only"
    echo "  nodes       Check graph nodes only"
    echo "  edges       Check graph edges only"
    echo "  errors      Check processing errors only"
    echo "  performance Check performance metrics only"
    echo "  full        Run all checks (default)"
    echo ""
    echo "Examples:"
    echo "  $0              # Run all checks"
    echo "  $0 graphs       # Check graph results only"
    echo "  $0 performance  # Check performance only"
}

# Command line handling
case "${1:-full}" in
    "help"|"-h"|"--help")
        show_help
        ;;
    "tables")
        check_tables
        ;;
    "incidents")
        check_incidents
        ;;
    "graphs")
        check_graph_results
        ;;
    "nodes")
        check_nodes
        ;;
    "edges")
        check_edges
        ;;
    "errors")
        check_errors
        ;;
    "performance")
        check_performance
        ;;
    "full"|*)
        main
        ;;
esac
