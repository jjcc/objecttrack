/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  // Enable source maps for debugging
  webpack(config, { dev }) {
  if (dev) {
    config.devtool = "source-map";
  }
  return config;
  }
};

export default nextConfig;
