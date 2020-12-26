import path from 'path';
import { rollup } from 'rollup';
import resolvePlugin from '@rollup/plugin-node-resolve';
import replacePlugin from '@rollup/plugin-replace';
// import commonjsPlugin from "@rollup/plugin-commonjs";
import { terser as terserPlugin } from 'rollup-plugin-terser';
import chalk from 'chalk';

type GenerateOption = {
  inputFile: string;
  outputFile: string;
  format: 'cjs' | 'es' | 'umd';
  name: string;
  banner?: string;
};

const generateBundledModules = async ({
  inputFile,
  outputFile,
  format,
  name,
  banner,
}: GenerateOption) => {
  console.log(`Generating bundle:`);
  console.log(chalk.grey(`-> ${outputFile}`));
  const isUmd = format === 'umd';
  const plugins = [
    resolvePlugin(),
    // commonjsPlugin({
    //   namedExports: {},
    // }),
  ];
  plugins.push(
    replacePlugin({
      __DEV__: isUmd ? 'false' : "process.env.NODE_ENV !== 'production'",
    }),
    terserPlugin()
  );
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { dependencies = {}, devDependencies = {} } = require(path.resolve(
      outputFile,
      '../../package.json'
    ));
    const external = Object.keys({ ...dependencies, ...devDependencies });
    const bundle = await rollup({
      input: inputFile,
      external,
      plugins,
    });
    await bundle.write({
      file: outputFile,
      format,
      exports: 'named',
      name: isUmd ? name : undefined,
      banner,
    });
    console.log(chalk.green(`Succeed to generate ${outputFile} bundle.\n`));
  } catch (e) {
    console.log(chalk.red(`Failed to generate ${outputFile} bundle.\n`));
    console.log(chalk.red(e));
  }
};

export { generateBundledModules };
