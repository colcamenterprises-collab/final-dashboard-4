import fs from "fs";
import { globSync } from "glob";

const files = globSync("client/src/**/*.{tsx,ts,jsx,js}", { nodir: true }); // <-- fixed
const bad = /(ml-|pl-|margin-left:|padding-left:).*(64|256|280|sidebar)/i;

const offenders = files.filter(f => bad.test(fs.readFileSync(f, "utf8")));
if (offenders.length) {
  console.error("Blocked build: hard-coded left margins found:\n" + offenders.join("\n"));
  process.exit(1);
}

console.log(`✅ Layout check passed: ${files.length} files scanned, no margin hacks found.`);