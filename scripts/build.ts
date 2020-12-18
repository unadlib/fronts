/* eslint-disable no-console */
import path from 'path';
import { compile } from './typescript';
import { generateBundledModules } from './rollup';
import { buildTypes as buildTypesObject } from './workspaces';

process.chdir(path.resolve(__dirname, '..'));

console.log(`\nBuilding...\n`);
/**
 * sub-project set { "build": ['es', 'cjs', 'umd'] } for config about build types.
 */
compile(async ({ currentPath, name, packageJson }) => {
  const banner = packageJson.bin ? '#!/usr/bin/env node' : undefined;
  const { build: buildTypes = ['es', 'cjs', 'umd'] } = packageJson;
  for (const buildType of buildTypes) {
    await generateBundledModules({
      inputFile: path.resolve(currentPath, 'build/index.js'),
      outputFile: path.resolve(
        currentPath,
        `dist/index.${buildTypesObject[buildType]}.js`
      ),
      format: buildType,
      name,
      banner,
    });
  }
});
