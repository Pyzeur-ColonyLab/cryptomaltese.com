# Crypto-Sentinel API Documentation

## Overview

The Crypto-Sentinel API provides endpoints for incident management, fund flow analysis, and data retrieval. All endpoints return JSON responses and use standard HTTP status codes.

## Base URL

```
http://localhost:3000/api
```

## Authentication

Currently, the API does not require authentication. However, API keys for external services (Etherscan) must be configured in the environment variables.

## Endpoints

### Incident Management

#### Submit Incident
**POST** `/api/submit-incident`

Submit a new cryptocurrency incident for analysis.

**Request Body:**
```json
{
  "wallet_address": "0x1234567890abcdef...",
  "tx_hash": "0xabcdef1234567890...",
  "chain": "ethereum",
  "description": "Optional incident description"
}
```

**Response:**
```json
{
  "id": "uuid-string",
  "wallet_address": "0x1234567890abcdef...",
  "tx_hash": "0xabcdef1234567890...",
  "chain": "ethereum",
  "created_at": "2025-01-01T00:00:00.000Z"
}
```

**Status Codes:**
- `201`: Incident created successfully
- `400`: Invalid request data
- `500`: Server error

---

#### Get Incident Data
**GET** `/api/incident/[id]/data`

Retrieve incident data by ID.

**Response:**
```json
{
  "id": "uuid-string",
  "wallet_address": "0x1234567890abcdef...",
  "tx_hash": "0xabcdef1234567890...",
  "chain": "ethereum",
  "block_number": "12345678",
  "discovered_at": "2025-01-01T00:00:00.000Z"
}
```

**Status Codes:**
- `200`: Incident found
- `404`: Incident not found
- `500`: Server error

---

### Enhanced Fund Flow Analysis

#### Run Enhanced Mapping
**POST** `/api/incident/[id]/enhanced-mapping`

Run the enhanced fund flow tracking algorithm for an incident.

**Response:**
```json
{
  "id": "analysis-uuid",
  "incident_id": "incident-uuid",
  "analysis_data": {
    "enhanced_analysis": {
      "flow_analysis": {
        "total_depth_reached": 3,
        "total_addresses_analyzed": 15,
        "total_value_traced": "0.1659",
        "high_confidence_paths": 5,
        "cross_chain_exits": 2,
        "endpoints_detected": 3,
        "endpoint_types": ["exchange", "mixer", "no_outgoing"]
      },
      "risk_assessment": {
        "high_risk_addresses": [
          {
            "address": "0x1234567890abcdef...",
            "risk_score": 850,
            "patterns": ["rapid_turnover", "peel_chain"],
            "total_funds": "0.05"
          }
        ]
      },
      "forensic_evidence": {
        "chain_of_custody": [
          {
            "source": "0x1234567890abcdef...",
            "target": "0xabcdef1234567890...",
            "value": 0.05,
            "confidence_score": 0.95,
            "reasoning_flags": ["high_value", "rapid_movement"]
          }
        ],
        "confidence_scores": [0.95, 0.87, 0.72],
        "pattern_matches": [
          {
            "peel_chain": true,
            "peel_chain_strength": 0.8,
            "round_number_frequency": 0.3,
            "rapid_turnover": false,
            "coordinated_movements": false
          }
        ]
      },
      "endpoints": [
        {
          "address": "0x1234567890abcdef...",
          "type": "exchange",
          "confidence": 0.9,
          "reasoning": ["Known exchange address", "High transaction volume"],
          "incoming_value": 0.05,
          "incoming_transaction": "0xabcdef1234567890..."
        }
      ]
    },
    "detailedTransactions": [
      {
        "type": "eth",
        "hash": "0xabcdef1234567890...",
        "from": "0x1234567890abcdef...",
        "to": "0xabcdef1234567890...",
        "value": "0.1659",
        "blockNumber": "12345678",
        "description": "Original hack transaction"
      },
      {
        "type": "tracked",
        "hash": "flow_0",
        "from": "0x1234567890abcdef...",
        "to": "0xabcdef1234567890...",
        "value": 0.05,
        "depth": 1,
        "confidence": 0.95,
        "description": "Fund flow tracking - high_value"
      }
    ],
    "summary": "Enhanced fund flow analysis completed"
  },
  "created_at": "2025-01-01T00:00:00.000Z"
}
```

**Status Codes:**
- `200`: Analysis completed successfully
- `404`: Incident not found
- `500`: Analysis failed

---

### Analysis Management

#### Store Analysis
**POST** `/api/analysis`

Store analysis results for later retrieval.

**Request Body:**
```json
{
  "incident_id": "incident-uuid",
  "analysis_data": {
    // Complete analysis data object
  }
}
```

**Response:**
```json
{
  "id": "analysis-uuid",
  "incident_id": "incident-uuid",
  "created_at": "2025-01-01T00:00:00.000Z"
}
```

**Status Codes:**
- `201`: Analysis stored successfully
- `400`: Invalid request data
- `500`: Storage failed

---

#### Get Analysis
**GET** `/api/analysis?id=[analysis_id]`

Retrieve a specific analysis by ID.

**Response:**
```json
{
  "id": "analysis-uuid",
  "incident_id": "incident-uuid",
  "analysis_data": {
    // Complete analysis data object
  },
  "created_at": "2025-01-01T00:00:00.000Z"
}
```

**Status Codes:**
- `200`: Analysis found
- `404`: Analysis not found
- `500`: Server error

---

#### List Analyses
**GET** `/api/analysis?incident_id=[incident_id]&list=true`

List all analyses for a specific incident.

**Response:**
```json
[
  {
    "id": "analysis-uuid-1",
    "incident_id": "incident-uuid",
    "created_at": "2025-01-01T00:00:00.000Z"
  },
  {
    "id": "analysis-uuid-2",
    "incident_id": "incident-uuid",
    "created_at": "2025-01-02T00:00:00.000Z"
  }
]
```

**Status Codes:**
- `200`: Analyses found
- `404`: No analyses found
- `500`: Server error

---

### Utility Endpoints

#### Validate Address
**POST** `/api/validate-address`

Validate a cryptocurrency address format.

**Request Body:**
```json
{
  "address": "0x1234567890abcdef...",
  "chain": "ethereum"
}
```

**Response:**
```json
{
  "valid": true,
  "address": "0x1234567890abcdef...",
  "chain": "ethereum",
  "checksum": "0x1234567890abcdef..."
}
```

**Status Codes:**
- `200`: Address validated
- `400`: Invalid address
- `500`: Validation failed

---

#### Claude AI Analysis
**POST** `/api/claude`

Get AI-powered analysis using Claude.

**Request Body:**
```json
{
  "prompt": "Analyze this transaction pattern...",
  "data": {
    // Transaction data to analyze
  }
}
```

**Response:**
```json
{
  "analysis": "AI-generated analysis text...",
  "confidence": 0.85,
  "suggestions": [
    "Follow up on address 0x123...",
    "Check for similar patterns..."
  ]
}
```

**Status Codes:**
- `200`: Analysis completed
- `400`: Invalid request
- `500`: AI analysis failed

---

## Error Responses

All endpoints return consistent error responses:

```json
{
  "error": "Error message description",
  "code": "ERROR_CODE",
  "details": {
    // Additional error details if available
  }
}
```

## Rate Limiting

The API respects Etherscan's rate limit of 5 calls per second. When the limit is reached, requests are queued and processed as capacity becomes available.

## Data Types

### Address Format
All addresses should be in the standard Ethereum format:
- `0x` prefix
- 40 hexadecimal characters
- Valid checksum (for Ethereum addresses)

### UUID Format
All IDs use standard UUID v4 format:
- 32 hexadecimal characters
- 4 hyphens in standard positions
- Example: `123e4567-e89b-12d3-a456-426614174000`

### Value Format
All monetary values are returned as strings to preserve precision:
- ETH values: `"0.1659"`
- Wei values: `"165900000000000000"`

## Environment Variables

Required environment variables:

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/crypto_sentinel

# External APIs
ETHERSCAN_API_KEY=your_etherscan_api_key
CLAUDE_API_KEY=your_claude_api_key

# Optional
NODE_ENV=development
PORT=3000
```

## Testing

Test the API endpoints using curl or any HTTP client:

```bash
# Submit an incident
curl -X POST http://localhost:3000/api/submit-incident \
  -H "Content-Type: application/json" \
  -d '{
    "wallet_address": "0x1234567890abcdef...",
    "tx_hash": "0xabcdef1234567890...",
    "chain": "ethereum"
  }'

# Run analysis
curl -X POST http://localhost:3000/api/incident/[id]/enhanced-mapping

# Get analysis results
curl http://localhost:3000/api/analysis?id=[analysis_id]
```

## SDK Examples

### JavaScript/TypeScript

```typescript
class CryptoSentinelAPI {
  private baseUrl: string;

  constructor(baseUrl = 'http://localhost:3000/api') {
    this.baseUrl = baseUrl;
  }

  async submitIncident(data: {
    wallet_address: string;
    tx_hash: string;
    chain: string;
    description?: string;
  }) {
    const response = await fetch(`${this.baseUrl}/submit-incident`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return response.json();
  }

  async runAnalysis(incidentId: string) {
    const response = await fetch(`${this.baseUrl}/incident/${incidentId}/enhanced-mapping`, {
      method: 'POST'
    });
    return response.json();
  }

  async getAnalysis(analysisId: string) {
    const response = await fetch(`${this.baseUrl}/analysis?id=${analysisId}`);
    return response.json();
  }
}

// Usage
const api = new CryptoSentinelAPI();
const incident = await api.submitIncident({
  wallet_address: '0x1234567890abcdef...',
  tx_hash: '0xabcdef1234567890...',
  chain: 'ethereum'
});

const analysis = await api.runAnalysis(incident.id);
```

### Python

```python
import requests
import json

class CryptoSentinelAPI:
    def __init__(self, base_url="http://localhost:3000/api"):
        self.base_url = base_url

    def submit_incident(self, wallet_address, tx_hash, chain, description=None):
        data = {
            "wallet_address": wallet_address,
            "tx_hash": tx_hash,
            "chain": chain
        }
        if description:
            data["description"] = description
        
        response = requests.post(f"{self.base_url}/submit-incident", json=data)
        return response.json()

    def run_analysis(self, incident_id):
        response = requests.post(f"{self.base_url}/incident/{incident_id}/enhanced-mapping")
        return response.json()

    def get_analysis(self, analysis_id):
        response = requests.get(f"{self.base_url}/analysis?id={analysis_id}")
        return response.json()

# Usage
api = CryptoSentinelAPI()
incident = api.submit_incident(
    wallet_address="0x1234567890abcdef...",
    tx_hash="0xabcdef1234567890...",
    chain="ethereum"
)

analysis = api.run_analysis(incident["id"])
```

## Support

For API support and questions:
- Check the error responses for specific issues
- Review the rate limiting section for performance considerations
- Contact the development team for additional assistance 