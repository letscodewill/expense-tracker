import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow requests from the LAN IP printed by `next dev` (e.g. http://192.168.56.1:3000)
  // when testing from another device. `0.0.0.0` here is meaningless — it's a bind address,
  // not an origin requests come from.
  allowedDevOrigins: ['192.168.56.1', 'localhost'],
};

export default nextConfig;
