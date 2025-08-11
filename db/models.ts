// incidents table interface
export interface Incident {
  /** Unique incident ID (UUID) */
  id: string;
  /** User's wallet address */
  wallet_address: string;
  /** Blockchain network (Ethereum, Polygon, etc.) */
  chain: string;
  /** User's incident description */
  description: string;
  /** When hack was discovered */
  discovered_at: string; // ISO timestamp
  /** (Optional) Known malicious transaction hash */
  tx_hash?: string;
  /** Submission time */
  created_at: string; // ISO timestamp
  /** Report status: 'pending' | 'complete' | 'error' */
  report_status: 'pending' | 'complete' | 'error';
}

// api_cache table interface
export interface ApiCache {
  /** Unique cache entry ID (UUID) */
  id: string;
  /** Unique cache key (e.g., address+chain) */
  key: string;
  /** Cached API response */
  data: any;
  /** Creation timestamp */
  created_at: string; // ISO timestamp
  /** Expiry timestamp */
  expires_at?: string; // ISO timestamp
}

// reports table interface
export interface Report {
  /** Unique report ID (UUID) */
  id: string;
  /** Linked incident ID (UUID) */
  incident_id: string;
  /** Storage location of PDF */
  pdf_url: string;
  /** AI-generated summary */
  summary?: string;
  /** Creation timestamp */
  created_at: string; // ISO timestamp
} 