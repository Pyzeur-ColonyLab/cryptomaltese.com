#!/bin/bash

# Graph Service Server Testing Script
# Run this on your server to test the Python graph service

set -e

# Configuration
GRAPH_SERVICE_URL="http://localhost:8000"
NODE_API_URL="http://localhost:3000"
TEST_INCIDENT_ID="123e4567-e89b-12d3-a456-426614174000"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
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

# Check if required tools are available
check_dependencies() {
    log "Checking dependencies..."
    
    if ! command -v curl &> /dev/null; then
        error "curl is required but not installed"
        exit 1
    fi
    
    if ! command -v jq &> /dev/null; then
        warning "jq not found - JSON output will be raw"
        JQ_CMD="cat"
    else
        JQ_CMD="jq"
    fi
    
    success "Dependencies check complete"
}

# Test health endpoint
test_health() {
    log "Testing health endpoint..."
    
    local response=$(curl -s -w "%{http_code}" "$GRAPH_SERVICE_URL/health")
    local http_code="${response: -3}"
    local body="${response%???}"
    
    if [ "$http_code" = "200" ]; then
        success "Health check passed"
        echo "$body" | $JQ_CMD
        return 0
    else
        error "Health check failed (HTTP $http_code)"
        echo "$body"
        return 1
    fi
}

# Test stats endpoint
test_stats() {
    log "Testing stats endpoint..."
    
    local response=$(curl -s -w "%{http_code}" "$GRAPH_SERVICE_URL/stats")
    local http_code="${response: -3}"
    local body="${response%???}"
    
    if [ "$http_code" = "200" ]; then
        success "Stats retrieved successfully"
        echo "$body" | $JQ_CMD
    else
        error "Stats failed (HTTP $http_code)"
        echo "$body"
    fi
}

# Create test incident in database
create_test_incident() {
    log "Creating test incident in database..."
    
    # Create incident directly in PostgreSQL
    docker-compose exec -T database psql -U cryptomaltese_user -d cryptomaltese << EOF
INSERT INTO incidents (
    id, 
    title, 
    description, 
    hack_transaction_hash, 
    victim_address, 
    hacker_address, 
    amount_stolen_eth, 
    block_number, 
    status, 
    created_at, 
    updated_at
) VALUES (
    '$TEST_INCIDENT_ID',
    'Test Incident - Server Testing',
    'Test incident for server-side graph service testing',
    '0x2b023d65485c4bb68d781960c2196588d03b871dc9eb1b1a6cd9f2b7e37d0b5',
    '0x2FAF487A4414Fe77e2327F0bf4AE2a264a776AD2',
    '0x59ABf3837Fa962d6853b4Cc0a19513AA031fd32b',
    10.5,
    15853820,
    'active',
    NOW(),
    NOW()
) ON CONFLICT (id) DO UPDATE SET
    updated_at = NOW(),
    status = 'active';
EOF
    
    if [ $? -eq 0 ]; then
        success "Test incident created/updated: $TEST_INCIDENT_ID"
    else
        error "Failed to create test incident"
        exit 1
    fi
}

# Test incident processing
test_process_incident() {
    log "Testing incident processing..."
    
    local response=$(curl -s -w "%{http_code}" \
        -X POST "$GRAPH_SERVICE_URL/process_incident/$TEST_INCIDENT_ID" \
        -H "Content-Type: application/json" \
        -d '{
            "options": {
                "max_depth": 3,
                "min_value_eth": 0.01,
                "priority_threshold": 0.3
            }
        }')
    
    local http_code="${response: -3}"
    local body="${response%???}"
    
    if [ "$http_code" = "202" ] || [ "$http_code" = "409" ]; then
        success "Processing request accepted"
        echo "$body" | $JQ_CMD
        
        # Extract job ID for monitoring
        if command -v jq &> /dev/null; then
            JOB_ID=$(echo "$body" | jq -r '.job_id // empty')
            if [ -n "$JOB_ID" ]; then
                export JOB_ID
                success "Job ID: $JOB_ID"
            fi
        fi
        
        return 0
    else
        error "Processing failed (HTTP $http_code)"
        echo "$body"
        return 1
    fi
}

# Monitor job status
monitor_job() {
    if [ -z "$JOB_ID" ]; then
        warning "No job ID available for monitoring"
        return
    fi
    
    log "Monitoring job: $JOB_ID"
    
    local max_polls=30
    local poll_count=0
    
    while [ $poll_count -lt $max_polls ]; do
        local response=$(curl -s -w "%{http_code}" "$GRAPH_SERVICE_URL/jobs/$JOB_ID")
        local http_code="${response: -3}"
        local body="${response%???}"
        
        if [ "$http_code" = "200" ]; then
            if command -v jq &> /dev/null; then
                local status=$(echo "$body" | jq -r '.status // "unknown"')
                local nodes=$(echo "$body" | jq -r '.progress.nodes_processed // 0')
                local edges=$(echo "$body" | jq -r '.progress.edges_created // 0')
                
                echo "   Poll $((poll_count + 1)): Status=$status | Nodes=$nodes | Edges=$edges"
                
                if [ "$status" = "completed" ]; then
                    success "Job completed successfully!"
                    echo "$body" | $JQ_CMD
                    return 0
                elif [ "$status" = "failed" ]; then
                    error "Job failed"
                    echo "$body" | $JQ_CMD
                    return 1
                fi
            else
                echo "   Poll $((poll_count + 1)): $body"
            fi
        else
            error "Status check failed (HTTP $http_code)"
            echo "$body"
            return 1
        fi
        
        poll_count=$((poll_count + 1))
        sleep 3
    done
    
    warning "Monitoring timeout reached"
}

# Test integration via Node.js API
test_integration() {
    log "Testing integration via Node.js API..."
    
    # Start processing via Node.js proxy
    local response=$(curl -s -w "%{http_code}" \
        -X POST "$NODE_API_URL/api/incidents/$TEST_INCIDENT_ID/graph" \
        -H "Content-Type: application/json" \
        -d '{
            "max_depth": 2,
            "min_value_eth": 0.05
        }')
    
    local http_code="${response: -3}"
    local body="${response%???}"
    
    if [ "$http_code" = "202" ]; then
        success "Integration processing started"
        echo "$body" | $JQ_CMD
        
        # Monitor via Node.js
        log "Monitoring via Node.js API..."
        for i in {1..10}; do
            local status_response=$(curl -s "$NODE_API_URL/api/incidents/$TEST_INCIDENT_ID/graph")
            echo "   Integration poll $i: $status_response" | $JQ_CMD
            
            if command -v jq &> /dev/null; then
                local status=$(echo "$status_response" | jq -r '.status // "unknown"')
                if [ "$status" = "completed" ] || [ "$status" = "failed" ]; then
                    break
                fi
            fi
            
            sleep 3
        done
    else
        warning "Integration test failed or Node.js API not available (HTTP $http_code)"
        echo "$body"
    fi
}

# Check service logs
check_logs() {
    log "Recent graph service logs:"
    docker-compose logs --tail=20 graphservice
}

# Resource monitoring
check_resources() {
    log "Checking resource usage..."
    
    if command -v docker &> /dev/null; then
        echo "Docker container stats:"
        docker stats --no-stream cryptomaltese-graph 2>/dev/null || echo "Graph service container not found"
    fi
    
    echo ""
    echo "System resources:"
    echo "Memory: $(free -h 2>/dev/null | grep Mem || echo 'N/A')"
    echo "CPU Load: $(uptime)"
    echo "Disk: $(df -h . | tail -1)"
}

# Main test execution
main() {
    echo "🚀 Graph Service Server Testing"
    echo "=============================="
    
    # Check dependencies
    check_dependencies
    
    # Test 1: Health check
    echo ""
    if ! test_health; then
        error "Health check failed - service may not be running"
        echo ""
        echo "Try starting the service:"
        echo "  docker-compose --profile graph up -d graphservice"
        exit 1
    fi
    
    # Test 2: Stats
    echo ""
    test_stats
    
    # Test 3: Create test data
    echo ""
    create_test_incident
    
    # Test 4: Process incident
    echo ""
    if test_process_incident; then
        # Test 5: Monitor job
        echo ""
        monitor_job
    fi
    
    # Test 6: Integration (if Node.js is available)
    echo ""
    test_integration
    
    # Show logs and resources
    echo ""
    echo "=============================="
    check_logs
    echo ""
    check_resources
    
    echo ""
    success "Testing complete! 🎉"
    echo ""
    echo "Next steps:"
    echo "1. Check the logs above for any errors"
    echo "2. Verify graph data was created in database"
    echo "3. Monitor resource usage for your workload"
}

# Help function
show_help() {
    echo "Graph Service Testing Script"
    echo ""
    echo "Usage: $0 [COMMAND]"
    echo ""
    echo "Commands:"
    echo "  help        Show this help message"
    echo "  health      Test health check only"
    echo "  stats       Test stats endpoint only"
    echo "  process     Test incident processing only"
    echo "  logs        Show recent logs"
    echo "  resources   Check resource usage"
    echo "  full        Run all tests (default)"
    echo ""
    echo "Examples:"
    echo "  $0              # Run all tests"
    echo "  $0 health       # Quick health check"
    echo "  $0 process      # Test processing only"
}

# Command line handling
case "${1:-full}" in
    "help"|"-h"|"--help")
        show_help
        ;;
    "health")
        check_dependencies
        test_health
        ;;
    "stats")
        check_dependencies
        test_stats
        ;;
    "process")
        check_dependencies
        create_test_incident
        test_process_incident
        if [ -n "$JOB_ID" ]; then
            monitor_job
        fi
        ;;
    "logs")
        check_logs
        ;;
    "resources")
        check_resources
        ;;
    "full"|*)
        main
        ;;
esac
