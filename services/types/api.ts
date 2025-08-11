// Validate Address
export interface ValidateAddressRequest {
  /** Wallet address to validate */
  address: string;
  /** Blockchain network (Ethereum, Polygon, etc.) */
  chain: string;
}
export interface ValidateAddressResponse {
  /** Is the address valid for the given chain? */
  valid: boolean;
  /** Error message if invalid */
  error?: string;
}

// Submit Incident
export interface SubmitIncidentRequest {
  wallet_address: string;
  chain: string;
  description: string;
  discovered_at: string; // ISO timestamp
  tx_hash?: string;
}
export interface SubmitIncidentResponse {
  incident_id: string;
}

// Incident Data
export interface IncidentDataResponse {
  transactions: any[];
  portfolio: any;
  suspicious_activity: any[];
}

// Incident Analysis
export interface IncidentAnalysisResponse {
  summary: string;
  timeline: any[];
  attack_vectors: string[];
  total_loss_usd: number;
}

// Report
export interface ReportResponse {
  pdf_url: string;
  summary: string;
}

// Cache (internal)
export interface CacheRequest {
  key: string;
}
export interface CacheResponse {
  data: any;
} 