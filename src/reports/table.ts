import type { RunReportGenerator, RunReportResult } from ".";

import { Console } from "node:console";

import { Writable } from "node:stream";

function consoleTableToString(...args: Parameters<Console["table"]>) {
  return new Promise<string>((resolve, reject) => {
    let table = "";

    const writable = new Writable({
      write(chunk, encoding, callback) {
        table += chunk;
        callback();
      },
    });

    const cons = new Console(writable);
    cons.table(...args);

    resolve(table.trimEnd());
  });
}

export default {
  flag: "--table",
  key: "table",
  description: "Output results in an ASCII table",
  async generate(results) {
    const formattedResults: RunReportResult[] = [];
    let hasStdout = false;
    let hasStderr = false;

    for (const result of results) {
      formattedResults.push({
        ...result,
        time: Math.round(result.time * 100) / 100,
      });

      if (result.stdout) {
        hasStdout = true;
      }
      if (result.stderr) {
        hasStderr = true;
      }
    }

    const tableProperties = ["version", "exitCode", "time"];

    if (hasStdout) {
      tableProperties.push("stdout");
    }
    if (hasStderr) {
      tableProperties.push("stderr");
    }

    return await consoleTableToString(formattedResults, tableProperties);
  },
} as const satisfies RunReportGenerator;
