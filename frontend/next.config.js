/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // This allows the Next.js server to proxy API requests to your backend
  // This is useful in development to avoid CORS issues.
  // In production, you'd likely have a reverse proxy (e.g., Nginx)
  // or just use the NEXT_PUBLIC_API_URL env var directly in fetch.
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:8080/api/:path*', // Proxy to Backend
      },
    ];
  },
};

module.exports = nextConfig;
