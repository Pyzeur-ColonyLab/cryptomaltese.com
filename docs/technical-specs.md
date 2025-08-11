# Web3 Hack Evidence Aggregator – Technical Specifications

**Version:** v1.0.0  
**Status:** Draft (Pending Approval)  
**Date:** 2024-06-10  
**Prepared by:** Requirements & Specification Agent

---

## 1. System Architecture Overview

### 1.1 High-Level Diagram

```mermaid
flowchart TD
    UI[User Interface (Next.js)]
    API[API Routes (Next.js)]
    DB[(PostgreSQL)]
    Blockchain[Blockchain APIs (Etherscan, etc.)]
    Debank[Debank API]
    Claude[Claude API]
    PDF[PDF Generator]
    UI --> API
    API --> DB
    API --> Blockchain
    API --> Debank
    API --> Claude
    API --> PDF
    PDF --> UI
```

### 1.2 Technology Stack
- Frontend: Next.js (TypeScript)
- Backend: Next.js API routes (TypeScript)
- Database: PostgreSQL (hosted)
- AI: Claude API (Anthropic)
- PDF: pdf-lib, puppeteer, or react-pdf
- Deployment: Vercel

---

## 2. API Endpoint Designs

### 2.1 `/api/validate-address`
- POST: `{ address: string, chain: string }` → `{ valid: boolean, error?: string }`

### 2.2 `/api/submit-incident`
- POST: `{ wallet_address, chain, description, discovered_at, tx_hash? }` → `{ incident_id }`

### 2.3 `/api/incident/:id/data`
- GET: `{ transactions, portfolio, suspicious_activity }`

### 2.4 `/api/incident/:id/analyze`
- POST: `{}` → `{ summary, timeline, attack_vectors, total_loss_usd }`

### 2.5 `/api/incident/:id/report`
- GET: `{ pdf_url, summary }`

### 2.6 `/api/cache`
- GET/POST: Internal, for caching API responses

---

## 3. Database Schema

### 3.1 Tables

#### 3.1.1 `incidents`
| Field             | Type         | Description                        |
|-------------------|--------------|------------------------------------|
| id                | UUID (PK)    | Incident ID                        |
| wallet_address    | VARCHAR      | User's wallet address              |
| chain             | VARCHAR      | Chain name (Ethereum, etc.)        |
| description       | TEXT         | User's incident description        |
| discovered_at     | TIMESTAMP    | When hack was discovered           |
| tx_hash           | VARCHAR      | (Optional) Known malicious tx      |
| created_at        | TIMESTAMP    | Submission time                    |
| report_status     | VARCHAR      | [pending, complete, error]         |

#### 3.1.2 `api_cache`
| Field             | Type         | Description                        |
|-------------------|--------------|------------------------------------|
| id                | UUID (PK)    | Cache entry ID                     |
| key               | VARCHAR      | Unique cache key (e.g., address+chain) |
| data              | JSONB        | Cached API response                |
| created_at        | TIMESTAMP    |                                   |
| expires_at        | TIMESTAMP    |                                   |

#### 3.1.3 `reports`
| Field             | Type         | Description                        |
|-------------------|--------------|------------------------------------|
| id                | UUID (PK)    | Report ID                          |
| incident_id       | UUID (FK)    | Linked incident                    |
| pdf_url           | VARCHAR      | Storage location of PDF            |
| summary           | TEXT         | AI-generated summary               |
| created_at        | TIMESTAMP    |                                   |

---

## 4. Integration Requirements
- Etherscan, Polygonscan, BSCScan, Arbiscan APIs for transaction data
- Debank API for portfolio data
- Claude API for AI analysis
- PDF generation library/service
- PostgreSQL for caching and storage

---

## 5. Security & Compliance
- Minimal data retention, no private keys
- GDPR-compliant data handling is optional for MVP
- API rate limiting and monitoring
- Legal disclaimers in all reports

---

## 6. Change Log
| Version | Date       | Author | Description         |
|---------|------------|--------|---------------------|
| v1.0.0  | 2024-06-10 | R&S Agent | Initial draft     | 