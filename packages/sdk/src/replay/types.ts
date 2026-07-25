import type { TurnkeeperValidationIssue } from "../errors.js";

export const REPLAY_API_VERSION = "2026-07-09" as const;

export const REPLAY_EVENT_TYPES = [
  "input.received",
  "turn.started",
  "turn.decision_recorded",
  "model.completed",
  "output.finalized",
  "output.queued",
  "output.held",
  "output.sent",
  "output.failed",
  "turn.completed",
  "turn.failed",
] as const;

declare const opaqueReplayIdBrand: unique symbol;

export type OpaqueReplayId = string & { readonly [opaqueReplayIdBrand]: true };
export type ReplayEventType = (typeof REPLAY_EVENT_TYPES)[number];
export type ReplayBotType = "seller" | "buyer";
export type ReplayChannel = "sms" | "webhook" | "simulator";
export type ReplayProvider = "anthropic";
export type ReplayDeliveryState = "queued" | "held" | "sent" | "failed" | "none";

export interface ReplayEventData {
  readonly bot_type?: ReplayBotType | null;
  readonly channel?: ReplayChannel | null;
  readonly stage_before?: string | null;
  readonly stage_after?: string | null;
  readonly decision_code?: string | null;
  readonly outcome_code?: string | null;
  readonly reason_code?: string | null;
  readonly reply_source?: string | null;
  readonly extracted_field_names?: readonly string[] | null;
  readonly provider?: ReplayProvider | null;
  readonly model?: string | null;
  readonly input_tokens?: number | null;
  readonly output_tokens?: number | null;
  readonly cache_read_tokens?: number | null;
  readonly cache_write_tokens?: number | null;
  readonly latency_ms?: number | null;
  readonly fallback?: boolean | null;
  readonly message_length?: number | null;
  readonly message_fingerprint?: OpaqueReplayId | null;
  readonly delivery_state?: ReplayDeliveryState | null;
  readonly attempt?: number | null;
}

export interface ReplayPrivacy {
  readonly mode: "metadata_only";
  readonly key_version: number;
}

export interface ReplayEvent {
  readonly api_version: typeof REPLAY_API_VERSION;
  readonly source_event_id: OpaqueReplayId;
  readonly type: ReplayEventType;
  readonly occurred_at: string;
  readonly conversation_external_id: OpaqueReplayId;
  readonly turn_external_id: OpaqueReplayId;
  readonly turn_index?: number | null;
  readonly event_index: number;
  readonly parent_source_event_id?: OpaqueReplayId | null;
  readonly trace_id?: OpaqueReplayId | null;
  readonly data: ReplayEventData;
  readonly privacy: ReplayPrivacy;
}

export interface ReplayBatch {
  readonly events: readonly ReplayEvent[];
}

export type ReplayValidationIssue = TurnkeeperValidationIssue;

export interface ReplayEnvelopeValidationFailure {
  readonly ok: false;
  readonly envelopeErrors: readonly ReplayValidationIssue[];
}

export interface ReplayEventValidationSuccess {
  readonly contentHash: string;
  readonly event: ReplayEvent;
  readonly ok: true;
  readonly index: number;
  readonly source_event_id: OpaqueReplayId;
}

export interface ReplayEventValidationFailure {
  readonly ok: false;
  readonly index: number;
  readonly errors: readonly ReplayValidationIssue[];
  readonly source_event_id?: OpaqueReplayId;
}

export interface ReplayEnvelopeValidationSuccess {
  readonly ok: true;
  readonly events: readonly (ReplayEventValidationSuccess | ReplayEventValidationFailure)[];
}

export type ReplayEnvelopeValidationResult =
  | ReplayEnvelopeValidationFailure
  | ReplayEnvelopeValidationSuccess;

export interface ReplayValidationOptions {
  readonly enforceRetention?: boolean;
  readonly now?: Date;
  readonly retentionDays?: number;
}

export type ReplayWriteStatus = "accepted" | "duplicate" | "rejected";

export interface ReplayWriteResult {
  readonly index: number;
  readonly source_event_id: OpaqueReplayId;
  readonly status: ReplayWriteStatus;
  readonly code: string;
  readonly errors?: readonly ReplayValidationIssue[];
}

export interface ReplayWriteResponse {
  readonly request_id: string;
  readonly results: readonly ReplayWriteResult[];
}

export interface ReplayReadQuery {
  readonly conversationExternalId?: OpaqueReplayId;
  readonly from?: string;
  readonly limit?: number;
  readonly page?: number;
  readonly to?: string;
  readonly turnExternalId?: OpaqueReplayId;
  readonly type?: ReplayEventType;
}

export interface ReplayReadEvent extends ReplayEvent {
  readonly public_id: string;
  readonly turn_index: number | null;
  readonly parent_source_event_id: OpaqueReplayId | null;
  readonly trace_id: OpaqueReplayId | null;
}

export interface ReplayPagination {
  readonly has_next_page: boolean;
  readonly has_previous_page: boolean;
  readonly page: number;
  readonly page_size: number;
  readonly total_events: number;
  readonly total_pages: number;
}

export interface ReplayReadResponse {
  readonly request_id: string;
  readonly events: readonly ReplayReadEvent[];
  readonly pagination: ReplayPagination;
}

export interface TurnkeeperRequestOptions {
  readonly signal?: AbortSignal;
}

export interface ReplayWriteOptions extends TurnkeeperRequestOptions {
  readonly now?: Date;
  readonly retentionDays?: number;
}
