/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  allowedDevOrigins: [
    "192.168.200.167",
    "localhost",
    "127.0.0.1",
  ],
}

export default nextConfig
