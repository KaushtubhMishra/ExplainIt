export type ThemeColors = {
  gradient: [string, string, string];
  card: string;
  cardBorder: string;
  accent: string;
  accentText: string;
  text: string;
  muted: string;
};

export const THEMES: Record<string, ThemeColors> = {
  sky: { gradient: ["#0B2E6B", "#1565C0", "#4FA8E0"], card: "rgba(255,255,255,0.13)", cardBorder: "rgba(255,255,255,0.22)", accent: "#FFD54F", accentText: "#1A1A1A", text: "#FFFFFF", muted: "rgba(255,255,255,0.82)" },
  forest: { gradient: ["#08291F", "#1B5E20", "#4E9A51"], card: "rgba(255,255,255,0.13)", cardBorder: "rgba(255,255,255,0.22)", accent: "#FFEB3B", accentText: "#1A1A1A", text: "#FFFFFF", muted: "rgba(255,255,255,0.82)" },
  sunset: { gradient: ["#2E1638", "#A3174F", "#E8734F"], card: "rgba(255,255,255,0.13)", cardBorder: "rgba(255,255,255,0.22)", accent: "#FFE082", accentText: "#1A1A1A", text: "#FFFFFF", muted: "rgba(255,255,255,0.85)" },
  night: { gradient: ["#070720", "#151B5E", "#303F9F"], card: "rgba(255,255,255,0.11)", cardBorder: "rgba(255,255,255,0.2)", accent: "#80DEEA", accentText: "#0A1A20", text: "#FFFFFF", muted: "rgba(255,255,255,0.8)" },
};

export const theme = (name: string): ThemeColors => THEMES[name] ?? THEMES.sky;
