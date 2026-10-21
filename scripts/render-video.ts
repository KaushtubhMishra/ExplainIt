// Usage: npm run render [-- <run folder | latest>] [--concurrency 2] [--music none|<file>] [--scale 0.5]
// --scale 0.5 renders a quick 540x960 draft.
import { findRun, parseArgs } from "./lib";
import { renderStep } from "./steps";

const { flags, positional } = parseArgs(process.argv.slice(2));

async function main() {
  const runDir = findRun(positional[0]);
  console.log(`Run: ${runDir}`);
  await renderStep(runDir, {
    concurrency: flags.concurrency ? Number(flags.concurrency) : undefined,
    music: flags.music,
    scale: flags.scale ? Number(flags.scale) : undefined,
  });
}

main().catch((e) => { console.error(`\n${(e as Error).message}`); process.exitCode = 1; });
