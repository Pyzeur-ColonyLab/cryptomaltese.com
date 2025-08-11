# API & Database Contracts

**Version:** v1.0.0  
**Status:** Draft  
**Date:** 2024-06-11

---

## 1. Database Contracts

### 1.1 Table Schemas (PostgreSQL)

#### incidents
```
id UUID PRIMARY KEY
wallet_address VARCHAR NOT NULL
chain VARCHAR NOT NULL
description TEXT NOT NULL
discovered_at TIMESTAMP NOT NULL
tx_hash VARCHAR
created_at TIMESTAMP NOT NULL DEFAULT NOW()
report_status VARCHAR NOT NULL CHECK (report_status IN ('pending', 'complete', 'error'))
```

#### api_cache
```
id UUID PRIMARY KEY
key VARCHAR NOT NULL UNIQUE
data JSONB NOT NULL
created_at TIMESTAMP NOT NULL DEFAULT NOW()
expires_at TIMESTAMP
```

#### reports
```
id UUID PRIMARY KEY
incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE
pdf_url VARCHAR NOT NULL
summary TEXT
created_at TIMESTAMP NOT NULL DEFAULT NOW()
```

### 1.2 TypeScript Interfaces

See `/db/models.ts` for full interfaces. Example:
```ts
export interface Incident {
  id: string;
  wallet_address: string;
  chain: string;
  description: string;
  discovered_at: string;
  tx_hash?: string;
  created_at: string;
  report_status: 'pending' | 'complete' | 'error';
}
```

---

## 2. API Contracts

### 2.1 Endpoints & Payloads

#### POST `/api/validate-address`
- **Request:**
```json
{
  "address": "0x...",
  "chain": "ethereum"
}
```
- **Response:**
```json
{
  "valid": true,
  "error": null
}
```

#### POST `/api/submit-incident`
- **Request:**
```json
{
  "wallet_address": "0x...",
  "chain": "ethereum",
  "description": "My wallet was hacked...",
  "discovered_at": "2024-06-10T12:00:00Z",
  "tx_hash": "0x..."
}
```
- **Response:**
```json
{
  "incident_id": "uuid-string"
}
```

#### GET `/api/incident/:id/data`
- **Response:**
```json
{
  "transactions": [ ... ],
  "portfolio": { ... },
  "suspicious_activity": [ ... ]
}
```

#### POST `/api/incident/:id/analyze`
- **Response:**
```json
{
  "summary": "...",
  "timeline": [ ... ],
  "attack_vectors": [ ... ],
  "total_loss_usd": 1234.56
}
```

#### GET `/api/incident/:id/report`
- **Response:**
```json
{
  "pdf_url": "/reports/uuid.pdf",
  "summary": "..."
}
```

#### GET/POST `/api/cache` (internal)
- **Request:**
```json
{
  "key": "address:chain"
}
```
- **Response:**
```json
{
  "data": { ... }
}
```

---

## 3. Usage Notes
- All timestamps are ISO 8601 strings.
- All UUIDs are RFC 4122 compliant.
- See `/services/types/api.ts` for full TypeScript types.
- All endpoints return `{ success: false, error: string }` on failure.

---

## 4. Change Log
| Version | Date       | Author | Description         |
|---------|------------|--------|---------------------|
| v1.0.0  | 2024-06-11 | Impl Agent | Initial draft     | 