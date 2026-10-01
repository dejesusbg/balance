import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Fully static site (out/) for Netlify. Data lives in IndexedDB on the device.
  output: "export",
  images: { unoptimized: true },
  // Dev only: let a phone on the same Wi-Fi load the dev server by IP
  // (Next blocks dev resources from other hosts by default).
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*", "172.*.*.*", "*.local"],
};

export default nextConfig;
