/**
 * CacheService - Production-grade caching system
 * Handles localStorage, sessionStorage, and memory caching
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl?: number; // Time to live in milliseconds
  version?: string;
}

interface CacheOptions {
  ttl?: number;
  storage?: 'memory' | 'session' | 'local';
  compress?: boolean;
}

export class CacheService {
  private static memoryCache = new Map<string, CacheEntry<any>>();
  private static readonly VERSION = '1.0.0';
  private static readonly MAX_CACHE_SIZE = 50 * 1024 * 1024; // 50MB

  /**
   * Set cache entry
   */
  static set<T>(
    key: string,
    data: T,
    options: CacheOptions = {}
  ): boolean {
    const { ttl, storage = 'memory', compress = false } = options;

    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl,
      version: this.VERSION
    };

    try {
      const serialized = compress 
        ? this.compress(JSON.stringify(entry))
        : JSON.stringify(entry);

      switch (storage) {
        case 'memory':
          this.memoryCache.set(key, entry);
          this.cleanupMemoryCache();
          return true;

        case 'session':
          if (this.getStorageSize('session') + serialized.length > this.MAX_CACHE_SIZE) {
            this.cleanupStorage('session');
          }
          sessionStorage.setItem(key, serialized);
          return true;

        case 'local':
          if (this.getStorageSize('local') + serialized.length > this.MAX_CACHE_SIZE) {
            this.cleanupStorage('local');
          }
          localStorage.setItem(key, serialized);
          return true;

        default:
          return false;
      }
    } catch (error) {
      console.warn(`Failed to cache ${key}:`, error);
      return false;
    }
  }

  /**
   * Get cache entry
   */
  static get<T>(
    key: string,
    options: { storage?: 'memory' | 'session' | 'local', compress?: boolean } = {}
  ): T | null {
    const { storage = 'memory', compress = false } = options;

    try {
      let entry: CacheEntry<T> | null = null;

      switch (storage) {
        case 'memory':
          entry = this.memoryCache.get(key) || null;
          break;

        case 'session':
          const sessionData = sessionStorage.getItem(key);
          if (sessionData) {
            entry = JSON.parse(compress ? this.decompress(sessionData) : sessionData);
          }
          break;

        case 'local':
          const localData = localStorage.getItem(key);
          if (localData) {
            entry = JSON.parse(compress ? this.decompress(localData) : localData);
          }
          break;
      }

      if (!entry) return null;

      // Check version
      if (entry.version !== this.VERSION) {
        this.remove(key, { storage });
        return null;
      }

      // Check TTL
      if (entry.ttl) {
        const age = Date.now() - entry.timestamp;
        if (age > entry.ttl) {
          this.remove(key, { storage });
          return null;
        }
      }

      return entry.data;
    } catch (error) {
      console.warn(`Failed to get cache ${key}:`, error);
      return null;
    }
  }

  /**
   * Remove cache entry
   */
  static remove(
    key: string,
    options: { storage?: 'memory' | 'session' | 'local' } = {}
  ): void {
    const { storage = 'memory' } = options;

    switch (storage) {
      case 'memory':
        this.memoryCache.delete(key);
        break;
      case 'session':
        sessionStorage.removeItem(key);
        break;
      case 'local':
        localStorage.removeItem(key);
        break;
    }
  }

  /**
   * Clear all cache
   */
  static clear(storage?: 'memory' | 'session' | 'local' | 'all'): void {
    switch (storage) {
      case 'memory':
        this.memoryCache.clear();
        break;
      case 'session':
        sessionStorage.clear();
        break;
      case 'local':
        localStorage.clear();
        break;
      case 'all':
      default:
        this.memoryCache.clear();
        sessionStorage.clear();
        localStorage.clear();
        break;
    }
  }

  /**
   * Get cache size
   */
  static getCacheSize(storage: 'memory' | 'session' | 'local' = 'memory'): number {
    switch (storage) {
      case 'memory':
        let size = 0;
        this.memoryCache.forEach(entry => {
          size += JSON.stringify(entry).length;
        });
        return size;

      case 'session':
        return this.getStorageSize('session');

      case 'local':
        return this.getStorageSize('local');

      default:
        return 0;
    }
  }

  /**
   * Get storage size
   */
  private static getStorageSize(type: 'session' | 'local'): number {
    const storage = type === 'session' ? sessionStorage : localStorage;
    let size = 0;

    for (let key in storage) {
      if (storage.hasOwnProperty(key)) {
        size += storage[key].length + key.length;
      }
    }

    return size;
  }

  /**
   * Cleanup expired entries
   */
  private static cleanupMemoryCache(): void {
    const now = Date.now();
    const toDelete: string[] = [];

    this.memoryCache.forEach((entry, key) => {
      if (entry.ttl) {
        const age = now - entry.timestamp;
        if (age > entry.ttl) {
          toDelete.push(key);
        }
      }
    });

    toDelete.forEach(key => this.memoryCache.delete(key));

    // Remove oldest entries if cache is too large
    if (this.memoryCache.size > 100) {
      const entries = Array.from(this.memoryCache.entries());
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
      
      const toRemove = entries.slice(0, entries.length - 100);
      toRemove.forEach(([key]) => this.memoryCache.delete(key));
    }
  }

  /**
   * Cleanup storage
   */
  private static cleanupStorage(type: 'session' | 'local'): void {
    const storage = type === 'session' ? sessionStorage : localStorage;
    const entries: Array<[string, CacheEntry<any>]> = [];

    // Collect all cache entries
    for (let key in storage) {
      if (storage.hasOwnProperty(key)) {
        try {
          const entry = JSON.parse(storage[key]);
          if (entry.timestamp) {
            entries.push([key, entry]);
          }
        } catch {
          // Not a cache entry, skip
        }
      }
    }

    // Sort by timestamp (oldest first)
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);

    // Remove oldest 25%
    const toRemove = Math.floor(entries.length * 0.25);
    for (let i = 0; i < toRemove; i++) {
      storage.removeItem(entries[i][0]);
    }
  }

  /**
   * Simple compression using LZ-string algorithm
   */
  private static compress(data: string): string {
    // In production, use a library like lz-string
    // This is a placeholder
    return btoa(encodeURIComponent(data));
  }

  /**
   * Simple decompression
   */
  private static decompress(data: string): string {
    // In production, use a library like lz-string
    // This is a placeholder
    return decodeURIComponent(atob(data));
  }

  /**
   * Cache with memoization decorator
   */
  static memoize<T extends (...args: any[]) => any>(
    fn: T,
    options: CacheOptions = {}
  ): T {
    return ((...args: Parameters<T>) => {
      const key = `memoize_${fn.name}_${JSON.stringify(args)}`;
      const cached = this.get(key, options);
      
      if (cached !== null) {
        return cached;
      }

      const result = fn(...args);
      this.set(key, result, options);
      return result;
    }) as T;
  }

  /**
   * Cache async operations
   */
  static async cacheAsync<T>(
    key: string,
    factory: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T> {
    const cached = this.get<T>(key, options);
    if (cached !== null) {
      return cached;
    }

    const result = await factory();
    this.set(key, result, options);
    return result;
  }
}