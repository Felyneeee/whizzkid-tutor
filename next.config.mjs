/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Allow phones on the local network to load Next.js dev assets and HMR.
  allowedDevOrigins: ["192.168.254.104"],
};
export default nextConfig;
