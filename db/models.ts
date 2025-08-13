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

// Enhanced fund flow analysis interfaces
export interface FundFlowAnalysis {
  /** Unique analysis ID */
  id: number;
  /** Linked incident ID (UUID) */
  incident_id: string;
  /** Victim wallet address */
  victim_wallet: string;
  /** Total loss amount */
  total_loss_amount?: number;
  /** Hack timestamp */
  hack_timestamp?: Date;
  /** Maximum depth for analysis */
  max_depth: number;
  /** Analysis status */
  status: 'pending' | 'running' | 'completed' | 'failed';
  /** Creation timestamp */
  created_at: Date;
  /** Completion timestamp */
  completed_at?: Date;
  /** Overall confidence score */
  confidence_score?: number;
}

export interface TransactionPath {
  /** Unique path ID */
  id: number;
  /** Linked analysis ID */
  analysis_id: number;
  /** Unique path identifier */
  path_id: string;
  /** Depth level in the analysis */
  depth_level: number;
  /** Source address */
  from_address: string;
  /** Destination address */
  to_address: string;
  /** Transaction hash */
  transaction_hash: string;
  /** Transaction value amount */
  value_amount?: number;
  /** Transaction timestamp */
  timestamp?: Date;
  /** Confidence score for this path */
  confidence_score?: number;
  /** Detected patterns */
  patterns?: any;
  /** Creation timestamp */
  created_at: Date;
}

export interface AddressClassification {
  /** Unique classification ID */
  id: number;
  /** Ethereum address */
  address: string;
  /** Address classification type */
  classification: 'mixer' | 'exchange' | 'bridge' | 'wallet' | 'defi' | 'other';
  /** Classification confidence */
  confidence?: number;
  /** Transaction count for this address */
  transaction_count?: number;
  /** Analysis data */
  analysis_data?: any;
  /** Whether AI analysis was used */
  ai_analysis_used: boolean;
  /** Creation timestamp */
  created_at: Date;
  /** Last update timestamp */
  updated_at: Date;
}

export interface DetectedPattern {
  /** Unique pattern ID */
  id: number;
  /** Linked analysis ID */
  analysis_id: number;
  /** Pattern type */
  pattern_type: 'peel_chain' | 'rapid_movement' | 'round_numbers' | 'coordinated';
  /** Affected addresses */
  affected_addresses: string[];
  /** Pattern confidence */
  confidence?: number;
  /** Pattern details */
  details?: any;
  /** Creation timestamp */
  created_at: Date;
}

export interface AnalysisEndpoint {
  /** Unique endpoint ID */
  id: number;
  /** Linked analysis ID */
  analysis_id: number;
  /** Endpoint address */
  address: string;
  /** Endpoint classification */
  classification?: string;
  /** Total amount received */
  total_amount?: number;
  /** Transaction count */
  transaction_count?: number;
  /** Confidence score */
  confidence?: number;
  /** Risk level */
  risk_level?: 'low' | 'medium' | 'high' | 'critical';
  /** Creation timestamp */
  created_at: Date;
} 