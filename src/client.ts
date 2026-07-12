import { createReplayOperations, type ReplayOperations } from "./replay/client.js";
import { createTransport, type TurnkeeperFetch } from "./transport.js";

export interface TurnkeeperClientOptions {
  readonly apiKey: string;
  readonly baseUrl: string;
  readonly fetch?: TurnkeeperFetch;
  readonly timeoutMs?: number;
}

export class TurnkeeperClient {
  readonly replay: ReplayOperations;

  constructor(options: TurnkeeperClientOptions) {
    this.replay = createReplayOperations(createTransport(options));
  }
}
