import {
  TurnkeeperApiError,
  TurnkeeperProtocolError,
  TurnkeeperTransportError,
  TurnkeeperValidationError,
} from "./errors.js";

const API_KEY_RE = /^tk_(?:live|test)_[A-Za-z0-9_-]{32,96}$/;
const SAFE_ERROR_CODE_RE = /^[a-z0-9_]{1,80}$/;
const REQUEST_ID_RE = /^req_[A-Za-z0-9_-]{1,96}$/;
const MAX_RESPONSE_BYTES = 4 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 10_000;

export type TurnkeeperFetch = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

export interface TurnkeeperTransportOptions {
  readonly apiKey: string;
  readonly baseUrl: string;
  readonly fetch?: TurnkeeperFetch;
  readonly timeoutMs?: number;
}

export interface JsonRequestOptions {
  readonly body?: string;
  readonly idempotencyKey?: string;
  readonly method: "GET" | "POST";
  readonly signal?: AbortSignal;
}

export interface JsonTransport {
  requestJson(path: string, options: JsonRequestOptions): Promise<unknown>;
}

function configurationValidation(path: string, code: string): never {
  throw new TurnkeeperValidationError(
    [{ path, code }],
    "client_configuration",
  );
}

function normalizeBaseUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return configurationValidation("$.baseUrl", "invalid_base_url");
  }
  if (url.username || url.password || url.search || url.hash)
    return configurationValidation("$.baseUrl", "invalid_base_url");
  if (url.pathname !== "/" && url.pathname !== "")
    return configurationValidation("$.baseUrl", "invalid_base_url");
  const local =
    url.hostname === "localhost" ||
    url.hostname === "127.0.0.1" ||
    url.hostname === "[::1]" ||
    url.hostname === "::1";
  if (url.protocol !== "https:" && !(local && url.protocol === "http:"))
    return configurationValidation("$.baseUrl", "insecure_base_url");
  return url.origin;
}

function safeRequestId(value: unknown): string | undefined {
  return typeof value === "string" && REQUEST_ID_RE.test(value)
    ? value
    : undefined;
}

function retryAfterMs(
  value: string | null,
  now = Date.now(),
): number | undefined {
  if (value === null) return undefined;
  if (/^\d+$/.test(value)) return Math.min(Number(value) * 1000, 86_400_000);
  const date = Date.parse(value);
  if (!Number.isFinite(date)) return undefined;
  return Math.max(0, Math.min(date - now, 86_400_000));
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function apiError(response: Response, value: unknown): TurnkeeperApiError {
  const bodyRequestId = isObject(value)
    ? safeRequestId(value.request_id)
    : undefined;
  const requestId =
    safeRequestId(response.headers.get("x-request-id")) ?? bodyRequestId;
  const errorObject =
    isObject(value) && isObject(value.error) ? value.error : null;
  const code =
    errorObject &&
    typeof errorObject.code === "string" &&
    SAFE_ERROR_CODE_RE.test(errorObject.code)
      ? errorObject.code
      : "http_error";
  const retryDelay = retryAfterMs(response.headers.get("retry-after"));
  return new TurnkeeperApiError({
    code,
    status: response.status,
    ...(requestId ? { requestId } : {}),
    ...(retryDelay === undefined ? {} : { retryAfterMs: retryDelay }),
  });
}

async function boundedJson(response: Response): Promise<unknown> {
  const declared = response.headers.get("content-length");
  if (
    declared &&
    /^\d+$/.test(declared) &&
    Number(declared) > MAX_RESPONSE_BYTES
  ) {
    throw new TurnkeeperProtocolError("response_too_large", {
      status: response.status,
    });
  }
  if (!response.body) {
    if (!response.ok) return null;
    throw new TurnkeeperProtocolError("invalid_json_response", {
      status: response.status,
    });
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let byteCount = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      byteCount += value.byteLength;
      if (byteCount > MAX_RESPONSE_BYTES) {
        await reader.cancel().catch(() => undefined);
        throw new TurnkeeperProtocolError("response_too_large", {
          status: response.status,
        });
      }
      chunks.push(value);
    }
  } catch (error) {
    if (error instanceof TurnkeeperProtocolError) throw error;
    throw new TurnkeeperProtocolError("response_read_failed", {
      status: response.status,
    });
  }
  const bytes = new Uint8Array(byteCount);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new TurnkeeperProtocolError("invalid_json_response", {
      status: response.status,
    });
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    if (!response.ok) return null;
    throw new TurnkeeperProtocolError("invalid_json_response", {
      status: response.status,
    });
  }
}

export function createTransport(
  options: TurnkeeperTransportOptions,
): JsonTransport {
  if (!API_KEY_RE.test(options.apiKey))
    return configurationValidation("$.apiKey", "invalid_api_key");
  const baseUrl = normalizeBaseUrl(options.baseUrl);
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 120_000)
    return configurationValidation("$.timeoutMs", "invalid_timeout");
  const fetchImpl = options.fetch ?? globalThis.fetch;
  if (typeof fetchImpl !== "function")
    return configurationValidation("$.fetch", "fetch_unavailable");
  const apiKey = options.apiKey;

  return {
    async requestJson(path, requestOptions) {
      const controller = new AbortController();
      let callerAborted = requestOptions.signal?.aborted ?? false;
      const onAbort = (): void => {
        callerAborted = true;
        controller.abort();
      };
      requestOptions.signal?.addEventListener("abort", onAbort, { once: true });
      if (callerAborted) controller.abort();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      let response: Response;
      try {
        response = await fetchImpl(`${baseUrl}${path}`, {
          method: requestOptions.method,
          // Manual mode prevents fetch from forwarding the bearer key to a
          // redirect target and lets the SDK classify redirects as permanent.
          redirect: "manual",
          signal: controller.signal,
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${apiKey}`,
            "User-Agent": "turnkeeper-sdk/0.1.0-alpha.4",
            ...(requestOptions.body === undefined
              ? {}
              : { "Content-Type": "application/json" }),
            ...(requestOptions.idempotencyKey === undefined
              ? {}
              : { "Idempotency-Key": requestOptions.idempotencyKey }),
          },
          ...(requestOptions.body === undefined
            ? {}
            : { body: requestOptions.body }),
        });
      } catch {
        if (controller.signal.aborted) {
          throw new TurnkeeperTransportError(
            callerAborted ? "request_aborted" : "request_timeout",
          );
        }
        throw new TurnkeeperTransportError("network_error");
      } finally {
        clearTimeout(timeout);
        requestOptions.signal?.removeEventListener("abort", onAbort);
      }

      if (
        response.redirected ||
        (response.status >= 300 && response.status < 400)
      ) {
        throw new TurnkeeperProtocolError("redirect_not_allowed", {
          status: response.status,
        });
      }
      const value = await boundedJson(response);
      if (!response.ok) throw apiError(response, value);
      return value;
    },
  };
}
