import {
  normalizeLookupTerm,
  type LookupApiResponse,
} from "@/lib/dictionary/validation";

const STORAGE_KEY = "lexivault:lookup-cache:v2";
const MAX_CACHE_ENTRIES = 200;
export const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

type CacheRecord = {
  response: LookupApiResponse;
  cachedAt: number;
};

const memoryStore = new Map<string, CacheRecord>();
let hasHydrated = false;

function getBrowserStorage(): Storage | null {
  try {
    if (typeof window === "undefined") {
      return null;
    }
    return window.localStorage ?? window.sessionStorage ?? null;
  } catch {
    return null;
  }
}

function isExpired(record: CacheRecord, now = Date.now()): boolean {
  return now - record.cachedAt > CACHE_TTL_MS;
}

function evictOverflow(): void {
  while (memoryStore.size > MAX_CACHE_ENTRIES) {
    const oldestKey = memoryStore.keys().next().value;
    if (oldestKey === undefined) {
      break;
    }
    memoryStore.delete(oldestKey);
  }
}

function hydrateStore(): void {
  if (hasHydrated) {
    return;
  }
  hasHydrated = true;

  const storage = getBrowserStorage();
  if (!storage) {
    return;
  }

  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) {
      return;
    }
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return;
    }

    const now = Date.now();
    for (const item of parsed) {
      if (
        Array.isArray(item) &&
        item.length === 2 &&
        typeof item[0] === "string" &&
        item[1] &&
        typeof item[1] === "object"
      ) {
        const record = item[1] as Partial<CacheRecord>;
        const key = normalizeLookupTerm(item[0]);
        if (
          key &&
          typeof record.cachedAt === "number" &&
          Number.isFinite(record.cachedAt) &&
          record.response &&
          typeof record.response === "object" &&
          !isExpired(record as CacheRecord, now)
        ) {
          memoryStore.set(key, record as CacheRecord);
        }
      }
    }

    evictOverflow();
  } catch {
    // Corrupted or blocked browser storage should fall back cleanly to memory.
  }
}

function persistStore(): void {
  const storage = getBrowserStorage();
  if (!storage) {
    return;
  }

  try {
    storage.setItem(
      STORAGE_KEY,
      JSON.stringify(Array.from(memoryStore.entries())),
    );
  } catch {
    // Ignore quota / security errors in restricted browser modes.
  }
}

export function getCachedLookup(term: string): LookupApiResponse | null {
  const key = normalizeLookupTerm(term);
  if (!key) {
    return null;
  }

  hydrateStore();
  const hit = memoryStore.get(key);
  if (!hit) {
    return null;
  }

  if (isExpired(hit)) {
    memoryStore.delete(key);
    persistStore();
    return null;
  }

  // Refresh LRU position without extending expiry unnecessarily or refresh cleanly.
  memoryStore.delete(key);
  memoryStore.set(key, hit);
  persistStore();
  return hit.response;
}

export function setCachedLookup(
  term: string,
  response: LookupApiResponse,
): void {
  if (!response.is_valid || response.entries.length === 0) {
    return;
  }

  const key = normalizeLookupTerm(term);
  if (!key) {
    return;
  }

  hydrateStore();
  if (memoryStore.has(key)) {
    memoryStore.delete(key);
  }
  memoryStore.set(key, {
    response,
    cachedAt: Date.now(),
  });

  evictOverflow();
  persistStore();
}

export function markCachedEntrySaved(
  word: string,
  partOfSpeech: string,
  ids: { entryId: string; srsCardId: string },
): void {
  const targetWord = normalizeLookupTerm(word);
  const targetPos = partOfSpeech.trim().toLowerCase();
  if (!targetWord || !targetPos) {
    return;
  }

  hydrateStore();
  let changed = false;

  for (const [key, record] of memoryStore.entries()) {
    let matchedInResponse = false;
    const updatedEntries = record.response.entries.map((entry) => {
      const sameSense =
        normalizeLookupTerm(entry.word) === targetWord &&
        entry.part_of_speech.trim().toLowerCase() === targetPos;
      if (!sameSense) {
        return entry;
      }
      matchedInResponse = true;
      return {
        ...entry,
        id: ids.entryId,
        srs_card_id: ids.srsCardId,
        is_saved: true,
      };
    });

    if (matchedInResponse) {
      changed = true;
      memoryStore.set(key, {
        ...record,
        response: { ...record.response, entries: updatedEntries },
      });
    }
  }

  if (changed) {
    persistStore();
  }
}

export function clearLookupSessionCache(): void {
  memoryStore.clear();
  hasHydrated = false;
  const storage = getBrowserStorage();
  if (!storage) {
    return;
  }
  try {
    storage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore restricted storage errors.
  }
}
