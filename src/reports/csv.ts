import { stringify } from "csv-stringify/sync";
import type { ReportGenerator } from ".";

export default {
  flag: "--csv",
  key: "csv",
  description: "Output results in CSV format",
  generate(results) {
    return stringify(results, {
      header: true,
      columns: ["version", "exitCode"],
    });
  },
} as const satisfies ReportGenerator;
