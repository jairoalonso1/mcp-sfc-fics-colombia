/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: "/mcp",
        destination: "/api/mcp"
      },
      {
        source: "/sse",
        destination: "/api/mcp"
      },
      {
        source: "/",
        has: [
          {
            type: "header",
            key: "content-type",
            value: ".*application/json.*"
          }
        ],
        destination: "/api/mcp"
      },
      {
        source: "/",
        has: [
          {
            type: "header",
            key: "accept",
            value: ".*text/event-stream.*"
          }
        ],
        destination: "/api/mcp"
      }
    ];
  }
};

export default nextConfig;
