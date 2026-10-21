import { loadFont } from "@remotion/fonts";
import { staticFile } from "remotion";

// Fonts ship with the project (public/fonts), so rendering works offline.
const WEIGHTS = ["400", "600", "700"];
for (const weight of WEIGHTS) {
  loadFont({ family: "Poppins", url: staticFile(`fonts/poppins-latin-${weight}-normal.woff2`), weight });
  loadFont({ family: "Noto Sans Devanagari", url: staticFile(`fonts/noto-sans-devanagari-devanagari-${weight}-normal.woff2`), weight });
}

export const fontFor = (language: string) =>
  language === "hi-IN"
    ? `"Noto Sans Devanagari", Poppins, sans-serif`
    : `Poppins, "Noto Sans Devanagari", sans-serif`;
