/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: '**.shopee.com.br',
      },
      {
        protocol: 'https',
        hostname: '**.mercadolivre.com.br',
      },
      {
        protocol: 'https',
        hostname: '**.amazon.com.br',
      },
    ],
  },
  experimental: {
    // Permite uso de pacotes server-only quando necessário
    serverComponentsExternalPackages: [],
  },
};

module.exports = nextConfig;
