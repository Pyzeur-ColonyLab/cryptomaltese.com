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
    private hitCount = 0;
    private missCount = 0;

    constructor() {
        // Clean up expired entries periodically
        setInterval(() => this.cleanupExpiredEntries(), 60 * 60 * 1000); // Every hour
    }

    async getClassification(address: string): Promise<CachedClassification | null> {
        const key = address.toLowerCase();
        const cached = this.cache.get(key);
        
        if (!cached) {
            this.missCount++;
            return null;
        }
        
        // Check if expired
        if (new Date() > cached.expiresAt) {
            this.cache.delete(key);
            this.missCount++;
            return null;
        }
        
        this.hitCount++;
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
        
        const totalRequests = this.hitCount + this.missCount;
        const hitRate = totalRequests > 0 ? this.hitCount / totalRequests : 0;
        
        return {
            totalEntries,
            expiredEntries,
            memoryUsage,
            hitRate
        };
    }

    async clearCache(): Promise<void> {
        this.cache.clear();
        this.hitCount = 0;
        this.missCount = 0;
    }

    async getClassificationsByType(classificationType: string): Promise<CachedClassification[]> {
        return Array.from(this.cache.values())
            .filter(entry => entry.classification === classificationType);
    }

    async getHighRiskClassifications(): Promise<CachedClassification[]> {
        return Array.from(this.cache.values())
            .filter(entry => entry.riskLevel === 'high' || entry.riskLevel === 'critical');
    }

    async getClassificationsByConfidence(minConfidence: number): Promise<CachedClassification[]> {
        return Array.from(this.cache.values())
            .filter(entry => entry.confidence >= minConfidence);
    }

    async exportCache(): Promise<CachedClassification[]> {
        return Array.from(this.cache.values()).map(entry => ({
            ...entry,
            lastUpdated: entry.lastUpdated,
            expiresAt: entry.expiresAt
        }));
    }

    async importCache(classifications: CachedClassification[]): Promise<void> {
        for (const classification of classifications) {
            const key = classification.address.toLowerCase();
            this.cache.set(key, {
                ...classification,
                lastUpdated: new Date(classification.lastUpdated),
                expiresAt: new Date(classification.expiresAt)
            });
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
        
        for (const key of expiredKeys) {
            this.cache.delete(key);
        }
        
        if (expiredKeys.length > 0) {
            console.log(`Cleaned up ${expiredKeys.length} expired classification cache entries`);
        }
    }

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
            .filter(entry => pattern.test(entry.address));
    }

    async getCacheEntriesByDateRange(
        startDate: Date,
        endDate: Date
    ): Promise<CachedClassification[]> {
        return Array.from(this.cache.values())
            .filter(entry => entry.lastUpdated >= startDate && entry.lastUpdated <= endDate);
    }
} 