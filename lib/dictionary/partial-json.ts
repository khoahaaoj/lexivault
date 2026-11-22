import type { PartialLookupEntry } from "@/lib/dictionary/stream";
import type { CefrLevel } from "@/types/database";

const VALID_CEFR_LEVELS = new Set<CefrLevel>([
  "A1",
  "A2",
  "B1",
  "B2",
  "C1",
  "C2",
]);

const COMPLETE_NUMBER_PATTERN = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/;

type ObjectFrame = {
  kind: "object";
  lastCompletedEnd: number;
  phase: "key_or_end" | "after_key" | "colon" | "after_value";
};

type ArrayFrame = {
  kind: "array";
  lastCompletedEnd: number;
  phase: "value_or_end" | "after_value";
};

type ContainerFrame = ObjectFrame | ArrayFrame;

function isWhitespace(ch: string): boolean {
  return ch === " " || ch === "\t" || ch === "\n" || ch === "\r";
}

function isCompleteJsonPrimitive(token: string): boolean {
  return (
    token === "true" ||
    token === "false" ||
    token === "null" ||
    COMPLETE_NUMBER_PATTERN.test(token)
  );
}

/**
 * Strips an incomplete trailing backslash or truncated `\uXXXX` escape inside
 * an open JSON string so appending a closing `"` produces valid JSON.
 */
function stripTrailingIncompleteEscape(text: string): string {
  const end = text.length;

  // Count consecutive trailing backslashes: an odd count leaves an open `\`.
  let slashCount = 0;
  while (end - 1 - slashCount >= 0 && text[end - 1 - slashCount] === "\\") {
    slashCount += 1;
  }
  if (slashCount % 2 === 1) {
    return text.slice(0, end - 1);
  }

  // Check for an incomplete `\u` escape with 0..3 hex digits at the very tail.
  const unicodeMatch = /(\\+)u[0-9a-fA-F]{0,3}$/.exec(text);
  if (unicodeMatch && unicodeMatch[1].length % 2 === 1) {
    const matchStart = unicodeMatch.index + unicodeMatch[1].length - 1;
    return text.slice(0, matchStart);
  }

  return text;
}

function closeStack(stack: readonly ContainerFrame[]): string {
  let suffix = "";
  for (let i = stack.length - 1; i >= 0; i -= 1) {
    suffix += stack[i].kind === "object" ? "}" : "]";
  }
  return suffix;
}

function markValueCompleted(stack: ContainerFrame[], endPos: number): void {
  const parent = stack[stack.length - 1];
  if (!parent) {
    return;
  }
  parent.lastCompletedEnd = endPos;
  parent.phase = "after_value";
}

/**
 * Repairs an incomplete JSON object/array prefix (typically received mid-stream
 * from structured LLM output) into parseable JSON, returning `null` if the
 * prefix has not started a JSON container or is structurally invalid.
 */
export function repairPartialJson(raw: string): string | null {
  let start = 0;
  while (start < raw.length && isWhitespace(raw[start])) {
    start += 1;
  }
  if (start >= raw.length) {
    return null;
  }
  const firstChar = raw[start];
  if (firstChar !== "{" && firstChar !== "[") {
    return null;
  }

  const stack: ContainerFrame[] = [];
  let inString = false;
  let escaped = false;
  let stringIsObjectKey = false;
  let primitiveStart = -1;

  for (let i = start; i < raw.length; i += 1) {
    const ch = raw[i];

    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === "\\") {
        escaped = true;
        continue;
      }
      if (ch === '"') {
        inString = false;
        const top = stack[stack.length - 1];
        if (stringIsObjectKey) {
          if (top?.kind === "object") {
            top.phase = "after_key";
          }
        } else {
          markValueCompleted(stack, i + 1);
        }
      }
      continue;
    }

    if (primitiveStart !== -1) {
      if (isWhitespace(ch) || ch === "," || ch === "}" || ch === "]") {
        const token = raw.slice(primitiveStart, i);
        primitiveStart = -1;
        if (!isCompleteJsonPrimitive(token)) {
          return null;
        }
        markValueCompleted(stack, i);
      } else {
        continue;
      }
    }

    if (isWhitespace(ch)) {
      continue;
    }

    if (stack.length === 0 && i > start) {
      return null;
    }

    if (ch === "{") {
      stack.push({
        kind: "object",
        lastCompletedEnd: i + 1,
        phase: "key_or_end",
      });
      continue;
    }

    if (ch === "[") {
      stack.push({
        kind: "array",
        lastCompletedEnd: i + 1,
        phase: "value_or_end",
      });
      continue;
    }

    if (ch === "}") {
      const top = stack.pop();
      if (!top || top.kind !== "object") {
        return null;
      }
      if (stack.length === 0) {
        return raw.slice(start, i + 1);
      }
      markValueCompleted(stack, i + 1);
      continue;
    }

    if (ch === "]") {
      const top = stack.pop();
      if (!top || top.kind !== "array") {
        return null;
      }
      if (stack.length === 0) {
        return raw.slice(start, i + 1);
      }
      markValueCompleted(stack, i + 1);
      continue;
    }

    if (ch === '"') {
      const top = stack[stack.length - 1];
      if (!top) {
        return null;
      }
      inString = true;
      escaped = false;
      stringIsObjectKey = top.kind === "object" && top.phase === "key_or_end";
      continue;
    }

    if (ch === ":") {
      const top = stack[stack.length - 1];
      if (!top || top.kind !== "object") {
        return null;
      }
      top.phase = "colon";
      continue;
    }

    if (ch === ",") {
      const top = stack[stack.length - 1];
      if (!top) {
        return null;
      }
      top.phase = top.kind === "object" ? "key_or_end" : "value_or_end";
      continue;
    }

    // Start of a primitive literal (`true`, `false`, `null`, number).
    primitiveStart = i;
  }

  if (inString) {
    const top = stack[stack.length - 1];
    if (!top) {
      return null;
    }
    if (stringIsObjectKey) {
      const prefix = raw.slice(start, top.lastCompletedEnd);
      return `${prefix}${closeStack(stack)}`;
    }
    const safePrefix = stripTrailingIncompleteEscape(raw.slice(start));
    return `${safePrefix}"${closeStack(stack)}`;
  }

  if (primitiveStart !== -1) {
    const token = raw.slice(primitiveStart);
    if (isCompleteJsonPrimitive(token)) {
      return `${raw.slice(start)}${closeStack(stack)}`;
    }
    const top = stack[stack.length - 1];
    if (!top) {
      return null;
    }
    return `${raw.slice(start, top.lastCompletedEnd)}${closeStack(stack)}`;
  }

  const top = stack[stack.length - 1];
  if (!top) {
    return null;
  }

  if (top.kind === "object") {
    if (top.phase !== "after_value") {
      return `${raw.slice(start, top.lastCompletedEnd)}${closeStack(stack)}`;
    }
  } else if (top.phase !== "after_value") {
    return `${raw.slice(start, top.lastCompletedEnd)}${closeStack(stack)}`;
  }

  return `${raw.slice(start)}${closeStack(stack)}`;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asCefrLevel(value: unknown): CefrLevel | null {
  return typeof value === "string" && VALID_CEFR_LEVELS.has(value as CefrLevel)
    ? (value as CefrLevel)
    : null;
}

export type ParsedPartialDictionaryResponse = {
  is_valid?: boolean;
  suggestion?: string | null;
  entries: PartialLookupEntry[];
};

/**
 * Best-effort parser for streaming Gemini dictionary JSON chunks.
 * Filters out incomplete sub-items whose primary text field is still empty so
 * UI lists grow smoothly without rendering blank placeholders.
 */
export function parsePartialDictionaryResponse(
  raw: string,
): ParsedPartialDictionaryResponse | null {
  const repaired = repairPartialJson(raw);
  if (!repaired) {
    return null;
  }

  let decoded: unknown;
  try {
    decoded = JSON.parse(repaired);
  } catch {
    return null;
  }

  const root = asRecord(decoded);
  if (!root) {
    return null;
  }

  const rawEntries = Array.isArray(root.entries) ? root.entries : [];
  const entries: PartialLookupEntry[] = [];

  for (const item of rawEntries) {
    const record = asRecord(item);
    if (!record) {
      continue;
    }

    const word = asString(record.word).trim().toLowerCase();
    if (!word) {
      continue;
    }

    const collocations = Array.isArray(record.collocations)
      ? record.collocations
          .map(asRecord)
          .filter(
            (col): col is Record<string, unknown> =>
              col !== null && asString(col.phrase).trim().length > 0,
          )
          .map((col) => ({
            phrase: asString(col.phrase).trimStart(),
            meaning_vi: asString(col.meaning_vi).trimStart(),
          }))
      : [];

    const synonyms = Array.isArray(record.synonyms)
      ? record.synonyms
          .map(asRecord)
          .filter(
            (syn): syn is Record<string, unknown> =>
              syn !== null && asString(syn.word).trim().length > 0,
          )
          .map((syn) => ({
            word: asString(syn.word).trimStart(),
            difference_vi: asString(syn.difference_vi).trimStart(),
          }))
      : [];

    const antonyms = Array.isArray(record.antonyms)
      ? record.antonyms
          .map(asRecord)
          .filter(
            (ant): ant is Record<string, unknown> =>
              ant !== null && asString(ant.word).trim().length > 0,
          )
          .map((ant) => ({
            word: asString(ant.word).trimStart(),
            meaning_vi: asString(ant.meaning_vi).trimStart(),
          }))
      : [];

    const examples = Array.isArray(record.examples)
      ? record.examples
          .map(asRecord)
          .filter(
            (ex): ex is Record<string, unknown> =>
              ex !== null && asString(ex.en).trim().length > 0,
          )
          .map((ex) => ({
            en: asString(ex.en).trimStart(),
            vi: asString(ex.vi).trimStart(),
          }))
      : [];

    entries.push({
      word,
      part_of_speech: asString(record.part_of_speech).trim().toLowerCase(),
      cefr_level: asCefrLevel(record.cefr_level),
      ipa_uk: asString(record.ipa_uk).trim(),
      ipa_us: asString(record.ipa_us).trim(),
      audio_uk_url: null,
      audio_us_url: null,
      definition_en: asString(record.definition_en).trimStart(),
      explanation_vi: asString(record.explanation_vi).trimStart(),
      nuance_note_vi: asString(record.nuance_note_vi).trimStart(),
      collocations,
      synonyms,
      antonyms,
      examples,
    });
  }

  return {
    ...(typeof root.is_valid === "boolean" ? { is_valid: root.is_valid } : {}),
    ...(typeof root.suggestion === "string" || root.suggestion === null
      ? { suggestion: root.suggestion }
      : {}),
    entries,
  };
}
