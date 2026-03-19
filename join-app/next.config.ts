import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["mapbox-gl"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "wofvgfhejrvudvfxdytc.supabase.co" },
    ],
  },
};

export default nextConfig;
