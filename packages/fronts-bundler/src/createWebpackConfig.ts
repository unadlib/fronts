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
  if (
    configuration.module?.rules &&
    !process.env.SPA &&
    typeof siteConfig.registry !== 'undefined'
  ) {
    configuration.module?.rules.push({
      test: /\.(t|j)sx?$/,
      exclude: /importApp/,
      loader: 'string-replace-loader',
      options: {
        // TODO: use more stable syntax parsing replacement
        // thank about external app when use register
        search: "import\\s*\\('app",
        replace: "require('fronts').importApp('app",
        flags: 'g',
      },
    });
  }
  if (configuration.plugins) {
    configuration.plugins.push(...plugins);
  }
  return configuration;
};
