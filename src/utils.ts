import type { ChildProcess } from "node:child_process";
import type { Readable } from "node:stream";

export function streamToString(stream: Readable) {
  const chunks: Buffer[] = [];

  return new Promise<string>((resolve, reject) => {
    stream.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    stream.on("error", (err) => reject(err));
    stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
  });
}

export function childProcessFinished(child: ChildProcess) {
  return new Promise<number | null>((resolve, reject) => {
    child.once("close", resolve);
    child.once("error", reject);
  });
}
