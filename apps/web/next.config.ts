import type { NextConfig } from "next";
import { config } from "dotenv";
import { fileURLToPath } from "node:url";

// One .env for the whole project lives at the root (C:\projects\explainit\.env).
config({ path: fileURLToPath(new URL("../../.env", import.meta.url)) });

const nextConfig: NextConfig = {};
export default nextConfig;
