import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const tracked = execFileSync(
  "git",
  ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
  { encoding: "utf8" },
)
  .split("\0")
  .filter(Boolean);
const failures: string[] = [];
let inspected = 0;

for (const path of tracked) {
  if (!existsSync(path)) continue;
  inspected += 1;
  const contents = readFileSync(path);
  if (contents.includes(0)) continue;
  const text = contents.toString("utf8");
  if (text.startsWith("\uFEFF")) failures.push(`${path}: UTF-8 BOM`);
  if (text.includes("\r")) failures.push(`${path}: CRLF line ending`);
  if (text.length > 0 && !text.endsWith("\n")) {
    failures.push(`${path}: missing final newline`);
  }
  text.split("\n").forEach((line, index) => {
    if (/[ \t]+$/u.test(line)) {
      failures.push(`${path}:${index + 1}: trailing whitespace`);
    }
  });
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`Formatting hygiene passed for ${inspected} proposed public files.`);
}
