#!/usr/bin/env node

import { configuredWorkspaceRoot, startMcpServer } from "./server.js";

async function main(): Promise<void> {
  await startMcpServer({ workspaceRoot: configuredWorkspaceRoot() });
}

main().catch(() => {
  process.stderr.write("Turnkeeper MCP server failed to start.\n");
  process.exitCode = 1;
});
