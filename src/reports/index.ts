import { default as csv } from "./csv";
import { default as html } from "./html";

export const reportGenerators = [
  csv,
  html,
] as const satisfies ReportGenerator[];

export interface ReportGenerator {
  flag: `--${string}`;
  key: string;
  description: string;
  generate(results: [string, string][]): MaybePromise<string>;
}

type MaybePromise<T> = T | Promise<T>;
