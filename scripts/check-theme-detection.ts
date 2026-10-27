import { requestedTheme } from "../packages/shared/src/rules";
const nullCases = [
  "Make it simpler and explain why the sky is blue",
  "Add a real-life example of a forest fire, make it shorter",
  "Change to a night-time example",
  "रात में क्या होता है समझाओ",
  // A colour word in the same sentence as a theme name, but not describing the app's look:
  "Add why the sky changes colour at sunset",
  "Explain what colour the forest leaves turn",
  "आसमान का रंग रात में काला क्यों होता है",
];
const themeCases: [string, string][] = [
  ["use the sunset theme", "sunset"],
  ["change the colours to forest", "forest"],
  ["थीम रात वाली कर दो", "night"],
  ["sunset colours", "sunset"],
  ["colour scheme: sky", "sky"],
];
let ok = 0, total = 0;
for (const t of nullCases) { total++; const got = requestedTheme(t); const pass = got === null; ok += pass ? 1 : 0; console.log(pass ? "PASS" : "FAIL", String(got), t); }
for (const [t, want] of themeCases) { total++; const got = requestedTheme(t); const pass = got === want; ok += pass ? 1 : 0; console.log(pass ? "PASS" : "FAIL", String(got), t); }
console.log(`${ok}/${total}`);
if (ok !== total) process.exitCode = 1;
else console.log("All theme-detection checks passed.");
