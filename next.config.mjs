/** @type {import('next').NextConfig} */
const securityHeaders = [
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
];

const nextConfig = {
  images: {
    unoptimized: true,
  },
  poweredByHeader: false,
  reactStrictMode: true,
  async headers() {
    return [
      {
        headers: securityHeaders,
        source: "/(.*)",
      },
    ];
  },
};

export default nextConfig;
