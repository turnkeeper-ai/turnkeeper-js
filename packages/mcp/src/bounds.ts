const MAX_INPUT_BYTES = 64 * 1024;
const MAX_OUTPUT_BYTES = 256 * 1024;
const MAX_JSON_DEPTH = 24;
const MAX_JSON_NODES = 5_000;

export class PayloadBoundaryError extends Error {
  readonly code: "input_payload_invalid" | "input_payload_too_large" | "output_payload_too_large";

  constructor(
    code: "input_payload_invalid" | "input_payload_too_large" | "output_payload_too_large",
  ) {
    super(code);
    this.name = "PayloadBoundaryError";
    this.code = code;
  }
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function assertJsonTree(value: unknown): void {
  const stack: Array<{ depth: number; value: unknown }> = [{ depth: 0, value }];
  const seen = new Set<object>();
  let nodes = 0;

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) break;
    nodes += 1;
    if (nodes > MAX_JSON_NODES || current.depth > MAX_JSON_DEPTH) {
      throw new PayloadBoundaryError("input_payload_too_large");
    }

    const item = current.value;
    if (
      item === null ||
      typeof item === "string" ||
      typeof item === "boolean" ||
      (typeof item === "number" && Number.isFinite(item))
    ) {
      continue;
    }
    if (typeof item !== "object") throw new PayloadBoundaryError("input_payload_invalid");
    if (seen.has(item)) throw new PayloadBoundaryError("input_payload_invalid");
    seen.add(item);

    if (Array.isArray(item)) {
      for (let index = item.length - 1; index >= 0; index -= 1) {
        if (!Object.hasOwn(item, index)) throw new PayloadBoundaryError("input_payload_invalid");
        stack.push({ depth: current.depth + 1, value: item[index] });
      }
      continue;
    }
    if (!isPlainRecord(item)) throw new PayloadBoundaryError("input_payload_invalid");
    for (const entry of Object.values(item)) {
      stack.push({ depth: current.depth + 1, value: entry });
    }
  }
}

function serializedBytes(value: unknown): number {
  let serialized: string;
  try {
    serialized = JSON.stringify(value);
  } catch {
    throw new PayloadBoundaryError("input_payload_invalid");
  }
  return Buffer.byteLength(serialized, "utf8");
}

export function assertBoundedInput(value: unknown): void {
  assertJsonTree(value);
  if (serializedBytes(value) > MAX_INPUT_BYTES) {
    throw new PayloadBoundaryError("input_payload_too_large");
  }
}

function sortedJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortedJsonValue);
  if (!isPlainRecord(value)) return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, sortedJsonValue(value[key])]),
  );
}

export function serializeBoundedOutput(value: unknown): string {
  let serialized: string;
  try {
    serialized = JSON.stringify(sortedJsonValue(value), null, 2);
  } catch {
    throw new PayloadBoundaryError("output_payload_too_large");
  }
  if (Buffer.byteLength(serialized, "utf8") > MAX_OUTPUT_BYTES) {
    throw new PayloadBoundaryError("output_payload_too_large");
  }
  return serialized;
}
