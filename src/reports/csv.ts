import { stringify } from "csv-stringify/sync";
import type { RunReportGenerator } from ".";

export default {
  flag: "--csv",
  key: "csv",
  description: "Output results in CSV format",
  generate(results) {
    return stringify(results, {
      header: true,
      columns: ["version", "exitCode", "time"],
    });
  },
} as const satisfies RunReportGenerator;
