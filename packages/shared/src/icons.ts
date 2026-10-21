// Lucide icon names the LLM is allowed to use. Add names here to allow more icons.
export const ICON_NAMES = [
  "sun", "moon", "star", "cloud", "cloud-rain", "cloud-snow", "cloud-lightning", "snowflake",
  "droplet", "droplets", "waves", "wind", "thermometer", "thermometer-sun", "rainbow", "umbrella",
  "sunrise", "sunset", "mountain", "tree-pine", "leaf", "sprout", "flower", "earth", "globe",
  "zap", "flame", "atom", "flask-conical", "microscope", "magnet", "battery", "lightbulb",
  "eye", "ear", "heart", "brain", "hand", "user", "users", "house", "factory", "car", "plane",
  "ship", "rocket", "clock", "calendar", "timer", "arrow-up", "arrow-down", "rotate-cw",
  "refresh-cw", "circle-help", "check", "x", "plus", "minus", "scale", "fish", "bird", "bug",
  "egg", "apple", "utensils", "book-open", "graduation-cap", "sparkles",
  // phones, apps, and settings
  "smartphone", "search", "download", "settings", "sliders-horizontal", "bell", "wifi", "bluetooth",
  "lock", "shield-check", "battery-charging", "signal", "sun-medium", "moon-star", "volume-2", "languages",
  "type", "image", "camera", "map-pin", "store", "layout-grid", "app-window", "mouse-pointer-click",
  "log-in", "user-plus", "key-round", "folder", "accessibility", "scan-face", "circle-check", "circle-alert",
  "info", "badge-check", "list-checks", "mail", "message-circle", "phone", "music", "calendar-days",
  "wallet", "indian-rupee", "thumbs-up",
  // computers and technology
  "memory-stick", "cpu", "gauge", "hard-drive", "monitor", "laptop", "gamepad-2", "server", "layers",
  "trending-up", "chart-bar", "hourglass", "package", "arrow-right", "arrow-left-right", "play",
] as const;

export type IconNameType = (typeof ICON_NAMES)[number];
