/**
 * Nominatim geocoding utility with in-memory + localStorage cache.
 * Rate limit: 1 req/sec (Nominatim policy), so cache aggressively.
 */

type GeoResult = { lat: number; lon: number } | null;

const CACHE_KEY = "geocode_cache";
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

type CacheEntry = { lat: number; lon: number; ts: number };
type CacheMap = Record<string, CacheEntry>;

// In-memory cache (avoids repeated localStorage reads)
let memCache: CacheMap = {};

function loadCache(): CacheMap {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as CacheMap;
      // Prune expired entries
      const now = Date.now();
      const pruned: CacheMap = {};
      for (const [k, v] of Object.entries(parsed)) {
        if (now - v.ts < CACHE_TTL_MS) pruned[k] = v;
      }
      return pruned;
    }
  } catch {
    // corrupt cache, ignore
  }
  return {};
}

function saveCache(cache: CacheMap): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // storage full, ignore
  }
}

function initCache(): void {
  if (Object.keys(memCache).length === 0) {
    memCache = loadCache();
  }
}

/**
 * Geocode an address string to lat/lon using Nominatim.
 * Returns cached result if available. Returns null on failure.
 */
export async function geocodeAddress(address: string): Promise<GeoResult> {
  const key = address.trim().toLowerCase();
  if (!key) return null;

  initCache();

  // Check cache
  const cached = memCache[key];
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return { lat: cached.lat, lon: cached.lon };
  }

  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`;
    const res = await fetch(url, {
      headers: { "User-Agent": "construction-pm-mvp/1.0" },
    });
    const data = (await res.json()) as Array<{ lat: string; lon: string }>;

    if (data.length > 0) {
      const lat = parseFloat(data[0].lat);
      const lon = parseFloat(data[0].lon);
      if (!isNaN(lat) && !isNaN(lon)) {
        memCache[key] = { lat, lon, ts: Date.now() };
        saveCache(memCache);
        return { lat, lon };
      }
    }
  } catch {
    // Network error, return null
  }

  return null;
}
