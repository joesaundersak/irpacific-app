/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  typescript: { ignoreBuildErrors: true },
  images: { unoptimized: true },
}

module.exports = nextConfig
