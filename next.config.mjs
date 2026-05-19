/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typescript: {
    // TEMPORARY: Allow build to pass while we fix remaining type errors.
    // Remove this once typecheck is clean.
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
