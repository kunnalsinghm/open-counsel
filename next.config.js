/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: { bodySizeLimit: '5mb' },
    // sql.js's WASM loader must not be bundled by webpack — it does
    // runtime `module.exports` assignment that breaks under Next's
    // server bundling otherwise.
    serverComponentsExternalPackages: ['sql.js'],
  },
};

module.exports = nextConfig;
