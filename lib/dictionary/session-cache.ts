import {
  normalizeLookupTerm,
  type LookupApiResponse,
} from "@/lib/dictionary/validation";

const STORAGE_KEY = "lexivault:lookup-cache:v1";
const MAX_CACHE_ENTRIES = 50;

const memoryStore = new Map<string, LookupApiResponse>();
let hasHydrated = false;

function getSessionStorage(): Storage | null {
  try {
    if (typeof window === "undefined") {
      return null;
    }
    return window.sessionStorage ?? null;
  } catch {
    return null;
  }
}

function hydrateStore(): void {
  if (hasHydrated) {
    return;
  }
  hasHydrated = true;

  const storage = getSessionStorage();
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

    for (const item of parsed) {
      if (
        Array.isArray(item) &&
        item.length === 2 &&
        typeof item[0] === "string" &&
        item[1] &&
        typeof item[1] === "object"
      ) {
        const key = normalizeLookupTerm(item[0]);
        if (key) {
          memoryStore.set(key, item[1] as LookupApiResponse);
        }
      }
    }

    while (memoryStore.size > MAX_CACHE_ENTRIES) {
      const oldestKey = memoryStore.keys().next().value;
      if (oldestKey === undefined) {
        break;
      }
      memoryStore.delete(oldestKey);
    }
  } catch {
    // Corrupted or blocked sessionStorage should fall back cleanly to memory.
  }
}

function persistStore(): void {
  const storage = getSessionStorage();
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

  // Refresh LRU position.
  memoryStore.delete(key);
  memoryStore.set(key, hit);
  persistStore();
  return hit;
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
  memoryStore.set(key, response);

  while (memoryStore.size > MAX_CACHE_ENTRIES) {
    const oldestKey = memoryStore.keys().next().value;
    if (oldestKey === undefined) {
      break;
    }
    memoryStore.delete(oldestKey);
  }

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

  for (const [key, cached] of memoryStore.entries()) {
    let matchedInResponse = false;
    const updatedEntries = cached.entries.map((entry) => {
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
      memoryStore.set(key, { ...cached, entries: updatedEntries });
    }
  }

  if (changed) {
    persistStore();
  }
}

export function clearLookupSessionCache(): void {
  memoryStore.clear();
  hasHydrated = false;
  const storage = getSessionStorage();
  if (!storage) {
    return;
  }
  try {
    storage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore restricted storage errors.
  }
}
