import { resolve } from 'path';
import { Configuration } from 'webpack';
import { getPlugins } from './plugins';
import { getSiteConfig } from './getSiteConfig';
import { FrontsConfiguration } from './interface';

const DEFAULT_CONFIG_PATH = 'site.json';

export const createWebpackConfig = ({
  configPath = DEFAULT_CONFIG_PATH,
  ...configuration
}: FrontsConfiguration): Configuration => {
  const currentPath = resolve(process.cwd(), configPath);
  const siteConfig = getSiteConfig(currentPath);
  const plugins = getPlugins(currentPath);
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
  const appList = Object.keys(siteConfig.dependencies ?? {});
  if (
    configuration.module?.rules &&
    !process.env.SPA &&
    typeof siteConfig.registry !== 'undefined' &&
    appList.length > 0
  ) {
    configuration.module?.rules.push({
      test: /\.(t|j)sx?$/,
      loader: 'string-replace-loader',
      options: {
        // TODO: use more stable syntax parsing replacement
        search: 'import\\s*\\(\\s*(\'|"|`)([^(?!\\.)]+)(\'|"|`)\\s*\\)',
        replace: (...args: string[]) => {
          const [appName] = args[2].split('/');
          if (!appList.includes(appName)) {
            throw new Error(
              `"import(${
                args.slice(-1)[0]
              })" is invalid, please configure a valid "${appName}" dependency in ${currentPath}`
            );
          }
          return `require('fronts').importApp('${args[2]}')`;
        },
        flags: 'g',
      },
    });
  }
  if (configuration.plugins) {
    configuration.plugins.push(...plugins);
  }
  return configuration;
};
