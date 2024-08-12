import type { RunReportGenerator } from ".";

import { render } from "ejs";

import { version } from "../../package.json";
import template from "./html.ejs" with { type: "text" };

export default {
  flag: "--html",
  key: "html",
  description: "Output results in HTML format",
  generate(results) {
    return render(template, { results, version });
  },
} as const satisfies RunReportGenerator;
