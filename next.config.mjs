/** @type {import('next').NextConfig} */
const nextConfig = {
  // Preserve M0's "build doesn't gate on types" behaviour.
  typescript: { ignoreBuildErrors: true },
};
export default nextConfig;
