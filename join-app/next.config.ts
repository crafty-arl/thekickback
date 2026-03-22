import type { NextConfig } from "next";
import { execSync } from "child_process";

let buildNumber = "dev";
let buildDate = new Date().toISOString().split("T")[0];
try {
  buildNumber = execSync("git rev-list --count HEAD", { encoding: "utf8" }).trim();
} catch { /* not in git */ }

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["mapbox-gl"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store, must-revalidate" },
        ],
      },
    ];
  },
  env: {
    NEXT_PUBLIC_APP_VERSION: `1.0.${buildNumber}`,
    NEXT_PUBLIC_BUILD_NUMBER: buildNumber,
    NEXT_PUBLIC_BUILD_DATE: buildDate,
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "wofvgfhejrvudvfxdytc.supabase.co" },
    ],
  },
};

export default nextConfig;
