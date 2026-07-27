/**
 * Application-owned ActionContext persistence helpers for check → review resume.
 * In production, replace the in-memory map with durable application storage.
 */

import type { ActionContext } from "@turnkeeper/sdk";
import { ActionContextSchema } from "@turnkeeper/sdk";

export type PersistedActionRecord = {
  actionBinding: string;
  /** Hosted opaque review.actionRef when known; otherwise null until getReview. */
  actionRef: string | null;
  context: ActionContext;
  proposalId: string;
  reviewId: string | null;
};

const memoryStore = new Map<string, PersistedActionRecord>();

export function serializeActionContext(context: ActionContext): string {
  const parsed = ActionContextSchema.parse(context);
  return JSON.stringify(parsed);
}

export function parseActionContext(serialized: string): ActionContext {
  return ActionContextSchema.parse(JSON.parse(serialized) as unknown);
}

export function persistActionRecord(record: PersistedActionRecord): void {
  ActionContextSchema.parse(record.context);
  memoryStore.set(record.proposalId, {
    actionBinding: record.actionBinding,
    actionRef: record.actionRef,
    context: record.context,
    proposalId: record.proposalId,
    reviewId: record.reviewId,
  });
}

export function loadActionRecord(proposalId: string): PersistedActionRecord | null {
  return memoryStore.get(proposalId) ?? null;
}

export function clearActionRecords(): void {
  memoryStore.clear();
}
