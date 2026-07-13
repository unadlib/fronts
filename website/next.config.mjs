import { execFileSync } from 'node:child_process';
import { createMDX } from 'fumadocs-mdx/next';

const revision = execFileSync('git', ['rev-parse', 'HEAD'], {
  cwd: import.meta.dirname,
  encoding: 'utf8',
}).trim();

const withMDX = createMDX();

/** @type {import('next').NextConfig} */
const config = {
  env: {
    NEXT_PUBLIC_FRONTS_REVISION: revision,
  },
  images: {
    unoptimized: true,
  },
  output: 'export',
  reactStrictMode: true,
  trailingSlash: true,
};

export default withMDX(config);
