export interface CachedClassification {
    address: string;
    classification: string;
    confidence: number;
    reasoning: string;
    riskLevel: string;
    keyIndicators: string[];
    transactionCount: number;
    lastUpdated: Date;
    expiresAt: Date;
}

export class ClassificationCache {
    private cache = new Map<string, CachedClassification>();
    private readonly CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

    constructor() {
        // Clean up expired entries periodically
        setInterval(() => this.cleanupExpiredEntries(), 60 * 60 * 1000); // Every hour
    }

    async getClassification(address: string): Promise<CachedClassification | null> {
        const key = address.toLowerCase();
        const cached = this.cache.get(key);
        
        if (!cached) {
            return null;
        }
        
        // Check if expired
        if (new Date() > cached.expiresAt) {
            this.cache.delete(key);
            return null;
        }
        
        return cached;
    }

    async setClassification(
        address: string,
        classification: string,
        confidence: number,
        reasoning: string,
        riskLevel: string,
        keyIndicators: string[],
        transactionCount: number
    ): Promise<void> {
        const key = address.toLowerCase();
        const now = new Date();
        const expiresAt = new Date(now.getTime() + this.CACHE_DURATION_MS);
        
        const cachedClassification: CachedClassification = {
            address: address.toLowerCase(),
            classification,
            confidence,
            reasoning,
            riskLevel,
            keyIndicators,
            transactionCount,
            lastUpdated: now,
            expiresAt
        };
        
        this.cache.set(key, cachedClassification);
    }

    async updateClassification(
        address: string,
        updates: Partial<CachedClassification>
    ): Promise<void> {
        const key = address.toLowerCase();
        const existing = this.cache.get(key);
        
        if (existing) {
            const updated: CachedClassification = {
                ...existing,
                ...updates,
                lastUpdated: new Date()
            };
            this.cache.set(key, updated);
        }
    }

    async invalidateClassification(address: string): Promise<void> {
        const key = address.toLowerCase();
        this.cache.delete(key);
    }

    async getCacheStats(): Promise<{
        totalEntries: number;
        expiredEntries: number;
        memoryUsage: number;
        hitRate: number;
    }> {
        const totalEntries = this.cache.size;
        const now = new Date();
        const expiredEntries = Array.from(this.cache.values())
            .filter(entry => now > entry.expiresAt).length;
        
        // Estimate memory usage (rough calculation)
        const memoryUsage = totalEntries * 1024; // ~1KB per entry
        
        // Calculate hit rate (this would need to be implemented with actual usage tracking)
        const hitRate = 0.8; // Placeholder
        
        return {
            totalEntries,
            expiredEntries,
            memoryUsage,
            hitRate
        };
    }

    async clearCache(): Promise<void> {
        this.cache.clear();
    }

    async getClassificationsByType(classificationType: string): Promise<CachedClassification[]> {
        return Array.from(this.cache.values())
            .filter(entry => entry.classification === classificationType)
            .filter(entry => new Date() <= entry.expiresAt);
    }

    async getHighRiskClassifications(): Promise<CachedClassification[]> {
        return Array.from(this.cache.values())
            .filter(entry => ['high', 'critical'].includes(entry.riskLevel))
            .filter(entry => new Date() <= entry.expiresAt);
    }

    async getClassificationsByConfidence(minConfidence: number): Promise<CachedClassification[]> {
        return Array.from(this.cache.values())
            .filter(entry => entry.confidence >= minConfidence)
            .filter(entry => new Date() <= entry.expiresAt);
    }

    async exportCache(): Promise<CachedClassification[]> {
        const now = new Date();
        return Array.from(this.cache.values())
            .filter(entry => now <= entry.expiresAt)
            .map(entry => ({
                ...entry,
                lastUpdated: entry.lastUpdated.toISOString(),
                expiresAt: entry.expiresAt.toISOString()
            }));
    }

    async importCache(classifications: CachedClassification[]): Promise<void> {
        for (const classification of classifications) {
            const key = classification.address.toLowerCase();
            const expiresAt = new Date(classification.expiresAt);
            
            // Only import if not expired
            if (new Date() <= expiresAt) {
                this.cache.set(key, {
                    ...classification,
                    lastUpdated: new Date(classification.lastUpdated),
                    expiresAt
                });
            }
        }
    }

    private cleanupExpiredEntries(): void {
        const now = new Date();
        const expiredKeys: string[] = [];
        
        for (const [key, entry] of this.cache.entries()) {
            if (now > entry.expiresAt) {
                expiredKeys.push(key);
            }
        }
        
        // Remove expired entries
        expiredKeys.forEach(key => this.cache.delete(key));
        
        if (expiredKeys.length > 0) {
            console.log(`Cleaned up ${expiredKeys.length} expired classification cache entries`);
        }
    }

    // Utility methods for cache management
    
    async getCacheSize(): Promise<number> {
        return this.cache.size;
    }

    async isAddressCached(address: string): Promise<boolean> {
        const key = address.toLowerCase();
        const cached = this.cache.get(key);
        
        if (!cached) {
            return false;
        }
        
        // Check if expired
        if (new Date() > cached.expiresAt) {
            this.cache.delete(key);
            return false;
        }
        
        return true;
    }

    async getCacheKeys(): Promise<string[]> {
        return Array.from(this.cache.keys());
    }

    async getCacheEntry(address: string): Promise<CachedClassification | null> {
        return this.getClassification(address);
    }

    async setCacheEntry(
        address: string,
        classification: CachedClassification
    ): Promise<void> {
        const key = address.toLowerCase();
        this.cache.set(key, classification);
    }

    async removeCacheEntry(address: string): Promise<boolean> {
        const key = address.toLowerCase();
        return this.cache.delete(key);
    }

    async getCacheEntriesByPattern(pattern: RegExp): Promise<CachedClassification[]> {
        return Array.from(this.cache.values())
            .filter(entry => pattern.test(entry.address))
            .filter(entry => new Date() <= entry.expiresAt);
    }

    async getCacheEntriesByDateRange(
        startDate: Date,
        endDate: Date
    ): Promise<CachedClassification[]> {
        return Array.from(this.cache.values())
            .filter(entry => {
                const lastUpdated = entry.lastUpdated;
                return lastUpdated >= startDate && lastUpdated <= endDate;
            })
            .filter(entry => new Date() <= entry.expiresAt);
    }
} 