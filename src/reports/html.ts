import type { RunReportGenerator } from ".";

import { render } from "ejs";

import template from "./template.ejs";

export default {
  flag: "--html",
  key: "html",
  description: "Output results in HTML format",
  generate(results) {
    return render(template, { results });
  },
} as const satisfies RunReportGenerator;
