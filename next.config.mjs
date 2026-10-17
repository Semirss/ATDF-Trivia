/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    const noStoreHeaders = [
      {
        key: "Cache-Control",
        value: "private, no-store, no-cache, max-age=0, must-revalidate"
      },
      {
        key: "CDN-Cache-Control",
        value: "no-store"
      },
      {
        key: "Vercel-CDN-Cache-Control",
        value: "no-store"
      },
      {
        key: "Pragma",
        value: "no-cache"
      },
      {
        key: "Expires",
        value: "0"
      }
    ];

    return [
      {
        source: "/admin/:path*",
        headers: noStoreHeaders
      },
      {
        source: "/api/admin/:path*",
        headers: noStoreHeaders
      }
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**"
      }
    ]
  }
};

export default nextConfig;
