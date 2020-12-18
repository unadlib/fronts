/* eslint-disable no-console */
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs-extra';
import ts from 'typescript';
import chalk from 'chalk';
import { array } from 'yargs';
import { handleWorkspaces, Package } from './workspaces';

const projects = array('p').argv.p;

type CompileOption = {
  currentPath: string;
  target?: number;
  module?: number;
  outDir?: string;
  declarationDir?: string;
  inputFile?: string;
};

const defaultOutDir = 'build';
const defaultDeclarationDir = 'dist';
const defaultInputFile = 'src/index.ts';

const compileTypeScript = ({
  currentPath,
  target,
  module,
  outDir = path.resolve(currentPath, defaultOutDir),
  declarationDir = path.resolve(currentPath, defaultDeclarationDir),
  inputFile = path.resolve(currentPath, defaultInputFile), // its postfix is `.ts` by default
}: CompileOption) => {
  fs.removeSync(declarationDir);
  fs.removeSync(outDir);

  console.log(`Compiling TypeScript:`);
  console.log(chalk.grey(`-> ${outDir}`));

  const tsConfig = path.resolve('tsconfig.json');
  const json = ts.parseConfigFileTextToJson(
    tsConfig,
    ts.sys.readFile(tsConfig)!
  );
  const { options } = ts.parseJsonConfigFileContent(
    json.config,
    ts.sys,
    path.dirname(tsConfig)
  );
  options.target = target || options.module;
  options.module = module || options.module;
  options.outDir = outDir;
  options.declaration = true;
  options.declarationDir = declarationDir;

  const compilerHost = ts.createCompilerHost(options, true);
  const program = ts.createProgram([inputFile], options, compilerHost);
  const result = program.emit();
  if (result.emitSkipped) {
    const message = result.diagnostics
      .map(
        diagnostic =>
          `${ts.DiagnosticCategory[diagnostic.category]} ${diagnostic.code} (${
            diagnostic.file
          }:${diagnostic.start}): ${diagnostic.messageText}`
      )
      .join('\n');
    console.log(chalk.red(`Failed to compile Typescript:\n\n${message}`));
  }
  console.log(chalk.green(`Succeed to compile Typescript.\n`));
};

const getCamelCase = (name: string) => {
  return name.replace(/-(\w)/g, (_, str) => str.toUpperCase());
};

type Generate = (option: {
  currentPath: string;
  name: string;
  packageJson: Package;
}) => Promise<void>;

const compileProject = async (generate: Generate, packageChildPath: string) => {
  const packageJsonPath = path.resolve(packageChildPath, 'package.json');
  try {
    const packageJson: Package = fs.readJSONSync(packageJsonPath);
    if (!packageJson.private) {
      compileTypeScript({
        currentPath: packageChildPath,
        target: ts.ScriptTarget.ES5,
        module: ts.ModuleKind.ES2015,
        outDir: path.resolve(packageChildPath, defaultOutDir),
      });
      await generate({
        currentPath: packageChildPath,
        name: getCamelCase(packageJson.name),
        packageJson,
      });
    }
  } catch (e) {
    // console.error('Loaded child package.json file error.');
  }
};

const compile = async (generate: Generate) => {
  if (Array.isArray(projects) && projects.length > 0) {
    for (const project of projects) {
      if (typeof project === 'string') {
        await compileProject(generate, path.resolve(project));
      }
    }
    return;
  }
  await handleWorkspaces(async (packageParentDir, packageChildDir) => {
    const packageChildPath = path.resolve(packageParentDir, packageChildDir);
    const project = packageChildPath.replace(`${process.cwd()}/`, '');
    spawn('yarn', ['build', '-p', project], { stdio: 'inherit' });
    // await compileProject(generate, packageChildPath);
  });
};

export { compileTypeScript, compile };
