/** @type {import('next').NextConfig} */
const nextConfig = {
	distDir: process.env.NEXT_BUILD_DIST_DIR || ".next",
	images: { remotePatterns: [{ protocol: "https", hostname: "images.unsplash.com" }, { protocol: "https", hostname: "res.cloudinary.com" }] },
};

export default nextConfig;
