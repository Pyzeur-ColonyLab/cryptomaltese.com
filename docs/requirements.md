# Web3 Hack Evidence Aggregator – MVP Requirements

**Version:** v1.0.0  
**Status:** Draft (Pending Approval)  
**Date:** 2024-06-10  
**Prepared by:** Requirements & Specification Agent

---

## 1. Functional Requirements

### 1.1 User Input Interface
- Wallet address input (Ethereum, Polygon, BSC, Arbitrum) with validation
- Multi-line incident description
- Date/time picker for hack discovery
- Optional transaction hash input
- Simple, mobile-responsive UI

### 1.2 Data Aggregation System
- Integrate with Etherscan, Polygonscan, BSCScan, Arbiscan APIs
- Fetch portfolio data from Debank API
- Analyze outgoing transactions and detect suspicious activity
- Implement caching to avoid redundant API calls

### 1.3 AI Analysis Engine
- Integrate with Claude API for incident analysis
- Generate suspicious transaction timeline
- Identify attack vectors (approvals, phishing, direct transfers)
- Calculate total losses in USD
- Create law enforcement-suitable summary

### 1.4 Report Generation
- Generate clean, professional PDF reports
- Enable mobile-responsive report viewing

---

## 2. Non-Functional Requirements
- Privacy-first: minimal data retention, no unnecessary PII
- Rate limiting and API cost management
- Legal disclaimers and compliance (GDPR, etc.)
- Robust error handling for API failures
- Responsive and accessible design (WCAG 2.1 AA)
- Sub-2s response time for most actions

---

## 3. Business Rules & Constraints
- Only public wallet addresses are accepted
- No storage of private keys or sensitive user data
- Data retention period: X days or on user request
- All API usage must respect rate limits and terms
- All reports must include legal disclaimers

---

## 4. Acceptance Criteria
- User can generate a law enforcement-ready PDF report from wallet address and incident description
- All API integrations function reliably with error handling
- System is mobile responsive and privacy-first
- All documentation and code are version controlled and peer-reviewed

---

## 5. Priority Levels
- Must have: Core input, data aggregation, AI analysis, PDF report
- Should have: Mobile optimization, caching, error handling
- Could have: User accounts, multi-language support

---

## 6. Change Log
| Version | Date       | Author | Description         |
|---------|------------|--------|---------------------|
| v1.0.0  | 2024-06-10 | R&S Agent | Initial draft     | 

---

## 7. Development Sequence Summary Table

| Step | Area                        | Rationale                        |
|------|-----------------------------|----------------------------------|
| 1    | Database & API Contracts    | Foundation for all development   |
| 2    | User Input Interface        | Early feedback, test integration|
| 3    | API Integration Layer       | Core data aggregation            |
| 4    | AI Analysis Engine          | Key differentiator               |
| 5    | PDF Report Generation       | Main user deliverable            |
| 6    | End-to-End Flow & Errors    | Robust, user-friendly experience |
| 7    | Performance & Security      | Reliability, compliance          |
| 8    | Testing & Validation        | Quality assurance                |
| 9    | Documentation & Deployment  | Handoff and production           | 