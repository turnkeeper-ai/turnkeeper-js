#!/usr/bin/env node

import { runCli } from "./cli.js";

runCli(process.argv.slice(2)).then(
  (exitCode) => {
    process.exitCode = exitCode;
  },
  (error: unknown) => {
    process.stderr.write(
      `${error instanceof Error ? error.message : "command_failed"}\n`,
    );
    process.exitCode = 1;
  },
);
