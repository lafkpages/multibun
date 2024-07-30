import { default as csv } from "./csv";
import { default as html } from "./html";

export const runReportGenerators = [
  csv,
  html,
] as const satisfies RunReportGenerator[];

export interface RunReportGenerator {
  flag: `--${string}`;
  key: string;
  description: string;
  generate(results: RunReportResult[]): MaybePromise<string>;
}

export interface RunReportResult {
  version: string;
  exitCode: number | null;
  time: number;
  stdout?: string;
  stderr?: string;
}

type MaybePromise<T> = T | Promise<T>;
