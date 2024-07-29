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

export type RunReportResult = [string, number | null, number];

type MaybePromise<T> = T | Promise<T>;
