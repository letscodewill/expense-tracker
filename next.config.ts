import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow requests from the LAN IP printed by `next dev` (e.g. http://192.168.56.1:3000)
  // when testing from another device. `0.0.0.0` here is meaningless — it's a bind address,
  // not an origin requests come from.
  allowedDevOrigins: ['192.168.56.1', 'localhost'],
  async headers() {
    return [{ source: '/sw.js', headers: [
      { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
      { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
      { key: 'Service-Worker-Allowed', value: '/' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
    ] }]
  },
};

export default nextConfig;
