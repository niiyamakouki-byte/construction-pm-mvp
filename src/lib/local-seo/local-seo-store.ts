/**
 * LocalSeoStore — persists SeoArticle[] / KeywordTarget[] / BackLinkRecord[] / SerpSnapshot[]
 * to localStorage.
 *
 * Key prefix: "genbahub.local_seo.*"
 * Capacity: 1000件 FIFO
 * EventTarget singleton — "seo-article-added" / "seo-article-updated" / "seo-keyword-added" / "seo-snapshot-added" events
 */

import type {
  SeoArticle,
  SeoArticleId,
  KeywordTarget,
  KeywordTargetId,
  BackLinkRecord,
  BackLinkId,
  SerpSnapshot,
  SeoMetricsId,
} from "./types.js";

const ARTICLE_KEY = "genbahub.local_seo.articles";
const KEYWORD_KEY = "genbahub.local_seo.keywords";
const BACKLINK_KEY = "genbahub.local_seo.backlinks";
const SNAPSHOT_KEY = "genbahub.local_seo.snapshots";
const MAX_RECORDS = 1000;

function loadJson<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    return JSON.parse(raw) as T[];
  } catch {
    return [];
  }
}

function persistJson<T>(key: string, records: T[]): void {
  try {
    const trimmed =
      records.length > MAX_RECORDS ? records.slice(records.length - MAX_RECORDS) : records;
    localStorage.setItem(key, JSON.stringify(trimmed));
  } catch {
    // Silently ignore quota errors
  }
}

// ── Store class ────────────────────────────────────────────────────────────

export class LocalSeoStore extends EventTarget {
  // ── Articles ───────────────────────────────────────────────────────────

  getArticles(limit = MAX_RECORDS): SeoArticle[] {
    const all = loadJson<SeoArticle>(ARTICLE_KEY);
    return [...all].reverse().slice(0, limit);
  }

  getArticle(id: SeoArticleId): SeoArticle | null {
    return loadJson<SeoArticle>(ARTICLE_KEY).find((a) => a.id === id) ?? null;
  }

  addArticle(article: SeoArticle): void {
    const existing = loadJson<SeoArticle>(ARTICLE_KEY);
    persistJson(ARTICLE_KEY, [...existing, article]);
    this.dispatchEvent(new CustomEvent("seo-article-added", { detail: article }));
  }

  updateArticle(
    id: SeoArticleId,
    partial: Partial<Omit<SeoArticle, "id">>,
  ): SeoArticle | null {
    const existing = loadJson<SeoArticle>(ARTICLE_KEY);
    const idx = existing.findIndex((a) => a.id === id);
    if (idx < 0) return null;
    const updated = { ...existing[idx], ...partial } as SeoArticle;
    existing[idx] = updated;
    persistJson(ARTICLE_KEY, existing);
    this.dispatchEvent(new CustomEvent("seo-article-updated", { detail: updated }));
    return updated;
  }

  // ── Keywords ───────────────────────────────────────────────────────────

  getKeywords(limit = MAX_RECORDS): KeywordTarget[] {
    const all = loadJson<KeywordTarget>(KEYWORD_KEY);
    return [...all].reverse().slice(0, limit);
  }

  getKeyword(id: KeywordTargetId): KeywordTarget | null {
    return loadJson<KeywordTarget>(KEYWORD_KEY).find((k) => k.id === id) ?? null;
  }

  addKeyword(keyword: KeywordTarget): void {
    const existing = loadJson<KeywordTarget>(KEYWORD_KEY);
    persistJson(KEYWORD_KEY, [...existing, keyword]);
    this.dispatchEvent(new CustomEvent("seo-keyword-added", { detail: keyword }));
  }

  // ── BackLinks ──────────────────────────────────────────────────────────

  getBacklinks(limit = MAX_RECORDS): BackLinkRecord[] {
    const all = loadJson<BackLinkRecord>(BACKLINK_KEY);
    return [...all].reverse().slice(0, limit);
  }

  addBacklink(backlink: BackLinkRecord): void {
    const existing = loadJson<BackLinkRecord>(BACKLINK_KEY);
    persistJson(BACKLINK_KEY, [...existing, backlink]);
    this.dispatchEvent(new CustomEvent("seo-backlink-added", { detail: backlink }));
  }

  getBacklink(id: BackLinkId): BackLinkRecord | null {
    return loadJson<BackLinkRecord>(BACKLINK_KEY).find((b) => b.id === id) ?? null;
  }

  // ── Snapshots ──────────────────────────────────────────────────────────

  getSnapshots(limit = MAX_RECORDS): SerpSnapshot[] {
    const all = loadJson<SerpSnapshot>(SNAPSHOT_KEY);
    return [...all].reverse().slice(0, limit);
  }

  getSnapshot(id: SeoMetricsId): SerpSnapshot | null {
    return loadJson<SerpSnapshot>(SNAPSHOT_KEY).find((s) => s.id === id) ?? null;
  }

  addSnapshot(snapshot: SerpSnapshot): void {
    const existing = loadJson<SerpSnapshot>(SNAPSHOT_KEY);
    persistJson(SNAPSHOT_KEY, [...existing, snapshot]);
    this.dispatchEvent(new CustomEvent("seo-snapshot-added", { detail: snapshot }));
  }

  getSnapshotsByKeyword(keywordTargetId: KeywordTargetId): SerpSnapshot[] {
    return loadJson<SerpSnapshot>(SNAPSHOT_KEY).filter(
      (s) => s.keywordTargetId === keywordTargetId,
    );
  }

  // ── Subscribe ──────────────────────────────────────────────────────────

  subscribe(listener: () => void): () => void {
    const events = [
      "seo-article-added",
      "seo-article-updated",
      "seo-keyword-added",
      "seo-backlink-added",
      "seo-snapshot-added",
    ];
    for (const ev of events) {
      this.addEventListener(ev, listener);
    }
    return () => {
      for (const ev of events) {
        this.removeEventListener(ev, listener);
      }
    };
  }

  /** Remove all records — for testing only */
  clear(): void {
    persistJson(ARTICLE_KEY, []);
    persistJson(KEYWORD_KEY, []);
    persistJson(BACKLINK_KEY, []);
    persistJson(SNAPSHOT_KEY, []);
    this.dispatchEvent(new CustomEvent("seo-article-updated", { detail: null }));
  }
}

// ── Singleton ──────────────────────────────────────────────────────────────

let _instance: LocalSeoStore | null = null;

export const localSeoStore: LocalSeoStore = new Proxy({} as LocalSeoStore, {
  get(_target, prop, _receiver) {
    if (!_instance) {
      _instance = new LocalSeoStore();
    }
    const value = Reflect.get(_instance, prop, _instance);
    return typeof value === "function" ? value.bind(_instance) : value;
  },
});

/** Reset singleton — for testing only */
export function _resetLocalSeoStore(): void {
  _instance = null;
}
