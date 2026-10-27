// Usage: npm run check:targeting
// Regression tests for how a change request is scoped: which scene numbers it names
// (targetedSceneNumbers) and whether it's purely about the colour theme (isPureThemeRequest).
import { isPureThemeRequest, targetedSceneNumbers } from "../packages/shared/src/rules";

let ok = 0, total = 0;
function check(label: string, got: unknown, want: unknown) {
  total++;
  const pass = JSON.stringify(got) === JSON.stringify(want);
  ok += pass ? 1 : 0;
  console.log(pass ? "PASS" : "FAIL", label, "->", JSON.stringify(got), pass ? "" : `(wanted ${JSON.stringify(want)})`);
}

// Scene-number parsing: only numbers that are part of the scene reference itself count.
check('targetedSceneNumbers("Make scene 2 mention 5G")', targetedSceneNumbers("Make scene 2 mention 5G"), [2]);
check('targetedSceneNumbers("In scene 3 say it takes 2 minutes")', targetedSceneNumbers("In scene 3 say it takes 2 minutes"), [3]);
check('targetedSceneNumbers("Simplify scenes 2-4")', targetedSceneNumbers("Simplify scenes 2-4"), [2, 3, 4]);
check('targetedSceneNumbers("Simplify scenes 2 to 4")', targetedSceneNumbers("Simplify scenes 2 to 4"), [2, 3, 4]);
check('targetedSceneNumbers("Make scenes 2 and 3 shorter")', targetedSceneNumbers("Make scenes 2 and 3 shorter"), [2, 3]);
check('targetedSceneNumbers("Make scene 4 simpler")', targetedSceneNumbers("Make scene 4 simpler"), [4]);
check('targetedSceneNumbers("दृश्य 3 को छोटा करो")', targetedSceneNumbers("दृश्य 3 को छोटा करो"), [3]);
check('targetedSceneNumbers("Shorten the intro")', targetedSceneNumbers("Shorten the intro"), null);

// Pure-theme-request detection: a theme switch combined with a real content ask must not
// be treated as theme-only (that would silently drop the content part).
check('isPureThemeRequest("Use the sunset theme", "sunset")', isPureThemeRequest("Use the sunset theme", "sunset"), true);
check('isPureThemeRequest("change the colours to forest", "forest")', isPureThemeRequest("change the colours to forest", "forest"), true);
check('isPureThemeRequest("थीम रात वाली कर दो", "night")', isPureThemeRequest("थीम रात वाली कर दो", "night"), true);
check('isPureThemeRequest("Use the sunset theme and make it shorter", "sunset")', isPureThemeRequest("Use the sunset theme and make it shorter", "sunset"), false);
check('isPureThemeRequest("Switch to night and add more detail", "night")', isPureThemeRequest("Switch to night and add more detail", "night"), false);

console.log(`${ok}/${total}`);
if (ok !== total) process.exitCode = 1;
else console.log("All revise-targeting checks passed.");
