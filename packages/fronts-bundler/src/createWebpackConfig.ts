import { Configuration } from 'webpack';
import { resolve } from 'path';
import { getPlugins } from './plugins';
import { getSiteConfig } from './getSiteConfig';

const plugins = getPlugins();

export const createWebpackConfig = (configuration: Configuration) => {
  const siteConfig = getSiteConfig();
  // TODO: custom path with version
  if (!configuration.output?.path && siteConfig.version) {
    const relativePath = siteConfig.version
      ? `dist/${siteConfig.version}`
      : `dist`;
    configuration.output = {
      ...(configuration.output ?? {}),
      path: resolve(__dirname, relativePath),
    };
  }
  if (configuration.module?.rules && !process.env.SPA) {
    // configuration.module?.rules.push({
    //   test: /\.(t|j)sx?$/,
    //   exclude: /node_modules/,
    //   loader: 'string-replace-loader',
    //   options: {
    //     search: 'import\\s*\\(',
    //     replace: "require('fronts').importApp(",
    //     flags: 'g',
    //   },
    // });
  }
  if (configuration.plugins) {
    configuration.plugins.push(...plugins);
  }
  return configuration;
};
