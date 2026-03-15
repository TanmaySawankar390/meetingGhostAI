import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  // Mirror Caddy's production behavior for local development
  async rewrites() {
    // When Next.js runs inside Docker, it must proxy to the 'backend' container.
    // When running directly on the host, it proxies to localhost.
    const backendUrl = process.env.INTERNAL_BACKEND_URL || 'http://localhost:8000';
    const livekitUrl = process.env.INTERNAL_LIVEKIT_URL || 'http://localhost:7880';
    
    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
      // Proxy twirp WebRTC signal routes to LiveKit server locally
      {
        source: '/twirp/:path*',
        destination: `${livekitUrl}/twirp/:path*`,
      },
    ];
  },
};

export default nextConfig;
