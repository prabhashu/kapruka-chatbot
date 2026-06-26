/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.kapruka.com' },
      { protocol: 'https', hostname: '**.kapruka.lk' },
      { protocol: 'https', hostname: 'i.kapruka.com' },
    ],
  },
  serverExternalPackages: ['@modelcontextprotocol/sdk'],
};

export default nextConfig;
