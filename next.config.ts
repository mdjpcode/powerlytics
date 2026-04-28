import type { NextConfig } from "next";

const repoName = process.env.GITHUB_REPOSITORY?.split("/")[1] ?? "";
const isGhPages = process.env.GITHUB_ACTIONS === "true";

const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  trailingSlash: true,
  basePath: isGhPages && repoName ? `/${repoName}` : "",
  assetPrefix: isGhPages && repoName ? `/${repoName}/` : undefined,
};

export default nextConfig;
