/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      {
        source: '/settings',
        destination: '/profile',
        permanent: false,
      },
      {
        source: '/settings/profile',
        destination: '/profile',
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
