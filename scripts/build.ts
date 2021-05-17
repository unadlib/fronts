/* eslint-disable no-console */
import path from 'path';
import { array } from 'yargs';
import { compile, compileProject, Generate } from './typescript';
import { generateBundledModules } from './rollup';
import { buildTypes as buildTypesObject, handleWorkspaces } from './workspaces';

process.chdir(path.resolve(__dirname, '..'));

const projects = array('p').argv.p;

const generate: Generate = async ({ currentPath, name, packageJson }) => {
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
};

/**
 * sub-project set { "build": ['es', 'cjs', 'umd'] } for config about build types.
 */

if (projects && projects.length > 0) {
  compile(projects, generate);
} else {
  handleWorkspaces(async (packageParentDir, packageChildDir) => {
    const packageChildPath = path.resolve(packageParentDir, packageChildDir);
    await compileProject(generate, packageChildPath);
  });
}
