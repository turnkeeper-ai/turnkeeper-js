import type { ReplayValidationIssue } from "./replay/types.js";

export type TurnkeeperErrorKind = "validation" | "api" | "transport" | "protocol";
export type TurnkeeperTransportCode = "network_error" | "request_timeout" | "request_aborted";

export interface RetryDecision {
  readonly retry: boolean;
  readonly retryAfterMs?: number;
}

interface ErrorDetails {
  readonly code: string;
  readonly kind: TurnkeeperErrorKind;
  readonly requestId?: string;
}

export class TurnkeeperError extends Error {
  readonly code: string;
  readonly kind: TurnkeeperErrorKind;
  readonly requestId: string | undefined;

  constructor(message: string, details: ErrorDetails) {
    super(message);
    this.name = "TurnkeeperError";
    this.code = details.code;
    this.kind = details.kind;
    this.requestId = details.requestId;
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      kind: this.kind,
      code: this.code,
      ...(this.requestId ? { requestId: this.requestId } : {}),
    };
  }
}

export class TurnkeeperValidationError extends TurnkeeperError {
  readonly issues: readonly ReplayValidationIssue[];

  constructor(issues: readonly ReplayValidationIssue[]) {
    super("Replay input failed local validation.", {
      code: "invalid_replay_input",
      kind: "validation",
    });
    this.name = "TurnkeeperValidationError";
    this.issues = issues.map(({ path, code }) => ({ path, code }));
  }

  override toJSON(): Record<string, unknown> {
    return { ...super.toJSON(), issues: this.issues };
  }
}

export class TurnkeeperApiError extends TurnkeeperError {
  readonly status: number;
  readonly retryAfterMs: number | undefined;

  constructor(details: {
    readonly code: string;
    readonly requestId?: string;
    readonly retryAfterMs?: number;
    readonly status: number;
  }) {
    super("Turnkeeper rejected the request.", {
      code: details.code,
      kind: "api",
      ...(details.requestId ? { requestId: details.requestId } : {}),
    });
    this.name = "TurnkeeperApiError";
    this.status = details.status;
    this.retryAfterMs = details.retryAfterMs;
  }

  override toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      status: this.status,
      ...(this.retryAfterMs === undefined ? {} : { retryAfterMs: this.retryAfterMs }),
    };
  }
}

export class TurnkeeperTransportError extends TurnkeeperError {
  readonly transportCode: TurnkeeperTransportCode;

  constructor(code: TurnkeeperTransportCode) {
    super(
      code === "request_timeout"
        ? "The Turnkeeper request timed out."
        : code === "request_aborted"
          ? "The Turnkeeper request was aborted."
          : "The Turnkeeper request could not be completed.",
      { code, kind: "transport" },
    );
    this.name = "TurnkeeperTransportError";
    this.transportCode = code;
  }
}

export class TurnkeeperProtocolError extends TurnkeeperError {
  readonly status: number | undefined;

  constructor(code: string, details: { readonly requestId?: string; readonly status?: number } = {}) {
    super("Turnkeeper returned an invalid response.", {
      code,
      kind: "protocol",
      ...(details.requestId ? { requestId: details.requestId } : {}),
    });
    this.name = "TurnkeeperProtocolError";
    this.status = details.status;
  }

  override toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      ...(this.status === undefined ? {} : { status: this.status }),
    };
  }
}

export function classifyRetry(error: unknown): RetryDecision {
  if (error instanceof TurnkeeperApiError) {
    const retry = error.status === 429 || error.status >= 500;
    return {
      retry,
      ...(retry && error.retryAfterMs !== undefined ? { retryAfterMs: error.retryAfterMs } : {}),
    };
  }

  if (error instanceof TurnkeeperTransportError) {
    return { retry: error.transportCode !== "request_aborted" };
  }

  return { retry: false };
}
