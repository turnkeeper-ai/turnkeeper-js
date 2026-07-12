import { TurnkeeperValidationError } from "../errors.js";
import type { JsonTransport } from "../transport.js";
import {
  MAX_REPLAY_REQUEST_BYTES,
  assertValidReplayBatch,
  parseReplayReadResponse,
  parseReplayWriteResponse,
  validateReplayReadQuery,
} from "./validation.js";
import type {
  ReplayBatch,
  ReplayReadQuery,
  ReplayReadResponse,
  ReplayWriteOptions,
  ReplayWriteResponse,
  TurnkeeperRequestOptions,
} from "./types.js";

export interface ReplayOperations {
  ingestBatch(batch: ReplayBatch, options?: ReplayWriteOptions): Promise<ReplayWriteResponse>;
  listEvents(query?: ReplayReadQuery, options?: TurnkeeperRequestOptions): Promise<ReplayReadResponse>;
}

function encodedBytes(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

function readPath(query: ReplayReadQuery): string {
  const search = new URLSearchParams();
  if (query.type !== undefined) search.set("type", query.type);
  if (query.conversationExternalId !== undefined) search.set("conversation_external_id", query.conversationExternalId);
  if (query.turnExternalId !== undefined) search.set("turn_external_id", query.turnExternalId);
  if (query.from !== undefined) search.set("from", query.from);
  if (query.to !== undefined) search.set("to", query.to);
  if (query.page !== undefined) search.set("page", String(query.page));
  if (query.limit !== undefined) search.set("limit", String(query.limit));
  const suffix = search.toString();
  return `/api/v1/events${suffix ? `?${suffix}` : ""}`;
}

export function createReplayOperations(transport: JsonTransport): ReplayOperations {
  return {
    async ingestBatch(batch, options = {}) {
      assertValidReplayBatch(batch, {
        ...(options.now === undefined ? {} : { now: options.now }),
        ...(options.retentionDays === undefined ? {} : { retentionDays: options.retentionDays }),
      });
      const body = JSON.stringify(batch);
      if (encodedBytes(body) > MAX_REPLAY_REQUEST_BYTES) {
        throw new TurnkeeperValidationError([{ path: "$", code: "request_too_large" }]);
      }
      const response = await transport.requestJson("/api/v1/events/batch", {
        body,
        method: "POST",
        ...(options.signal === undefined ? {} : { signal: options.signal }),
      });
      return parseReplayWriteResponse(response, batch.events);
    },

    async listEvents(query = {}, options = {}) {
      const issues = validateReplayReadQuery(query);
      if (issues.length > 0) throw new TurnkeeperValidationError(issues);
      const response = await transport.requestJson(readPath(query), {
        method: "GET",
        ...(options.signal === undefined ? {} : { signal: options.signal }),
      });
      return parseReplayReadResponse(response);
    },
  };
}
