/** @type {import('next').NextConfig} */
const nextConfig = {
  // Self-contained server bundle for the Docker image.
  output: "standalone",
  // heic-convert / libheif-js ship a WASM blob and must not be webpack-bundled.
  serverExternalPackages: ["heic-convert", "libheif-js"],
  outputFileTracingIncludes: {
    "/api/**": ["./node_modules/libheif-js/**/*.wasm"],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "25mb",
    },
  },
};

export default nextConfig;
