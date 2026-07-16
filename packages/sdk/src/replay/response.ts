export const REPLAY_RESULT_CODES = Object.freeze({
  alreadyStored: "already_stored",
  idempotencyConflict: "idempotency_conflict",
  orderingConflict: "ordering_conflict",
  schemaInvalid: "schema_invalid",
  stored: "stored",
} as const);

export type ReplayResultStatus = "accepted" | "duplicate" | "rejected";
export type ReplayResultCode = (typeof REPLAY_RESULT_CODES)[keyof typeof REPLAY_RESULT_CODES];

export interface ReplayWireResultError {
  readonly code: string;
  readonly path: string;
}

export interface ReplayWireResult {
  readonly code: ReplayResultCode;
  readonly errors?: readonly ReplayWireResultError[];
  readonly index: number;
  readonly source_event_id: string;
  readonly status: ReplayResultStatus;
}

export interface ReplayBatchWireResponse {
  readonly request_id: string;
  readonly results: readonly ReplayWireResult[];
}
