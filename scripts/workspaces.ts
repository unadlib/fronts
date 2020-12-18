import globParent from 'glob-parent';
import fs from 'fs-extra';
import path from 'path';

export const buildTypes = {
  es: 'esm',
  cjs: 'cjs',
  umd: 'umd',
} as const;

export type Package = {
  workspaces: string[];
  private: boolean;
  name: string;
  bin?: Record<string, string>;
  build: (keyof typeof buildTypes)[];
};

export type Handler = (
  packageParentDir: string,
  packageChildDir: string
) => Promise<void>;

export const handleWorkspaces = async (handler: Handler) => {
  const { workspaces }: Package = fs.readJSONSync(path.resolve('package.json'));
  for (const pattern of workspaces) {
    const packageParentDir = path.resolve(globParent(pattern));
    const packageChildDirs = fs.readdirSync(packageParentDir);
    for (const packageChildDir of packageChildDirs) {
      await handler(packageParentDir, packageChildDir);
    }
  }
};
