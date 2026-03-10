/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:4567/api/:path*', 
      },
      {
        source: '/webhook/:path*',
        destination: 'http://localhost:4567/webhook/:path*',
      }
    ]
  },
};

export default nextConfig;
