import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Fully static site (out/) for Netlify. Data lives in IndexedDB on the device.
  output: "export",
  images: { unoptimized: true },
};

export default nextConfig;
