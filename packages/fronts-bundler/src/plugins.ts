/* eslint-disable @typescript-eslint/no-var-requires */
import path from 'path';
import { container, DefinePlugin } from 'webpack';
import { getSiteConfig } from './getSiteConfig';
import { ModuleFederationPluginOptions, RemotesConfig } from './interface';
import { getUrl } from './utils';

const DEFAULT_DEPENDENCY_CONFIG_MAIN = 'remoteEntry.js';

export const getPlugins = () => {
  if (process.env.SPA) return [];
  const depURLs: Record<string, string | string[]> = {};
  const currentPath = path.resolve(process.cwd(), 'site.json');
  const siteConfig = getSiteConfig();
  if (typeof siteConfig.name !== 'string') {
    throw new Error(
      `The "name" field should be a string type in ${currentPath}`
    );
  }

  const {
    main = DEFAULT_DEPENDENCY_CONFIG_MAIN,
    exports,
    dependencies,
    bootstrap,
    version,
    ...otherConfig
  } = siteConfig;

  if (typeof main !== 'string') {
    throw new Error(
      `The "main" field should be a string type in ${currentPath}`
    );
  }

  const config: ModuleFederationPluginOptions = {
    ...otherConfig,
    filename: main,
    exposes: {},
  };

  if (Array.isArray(exports)) {
    if (exports.includes('.')) {
      throw new Error(
        `The "exports" field should be a Array<string> type WITHOUT '.' in ${currentPath}`
      );
    }
    if (typeof bootstrap !== 'string' && typeof bootstrap !== 'undefined') {
      throw new Error(
        `The "bootstrap" field should be a string in ${currentPath}`
      );
    }
    const exposes = bootstrap ? { '.': bootstrap } : {};
    // TODO: set exposes ExposesObject string[]
    Object.assign(
      config.exposes,
      exports.reduce(
        (acc, name) => Object.assign(acc, { [name]: name }),
        exposes
      )
    );
  } else if (typeof siteConfig.exports !== 'undefined') {
    throw new Error(
      `The "exports" field should be a Array<string> type in ${currentPath}`
    );
  }

  if (dependencies) {
    if (typeof dependencies !== 'object') {
      throw new Error(
        `The "dependencies" field should be a object type in ${currentPath}`
      );
    }
    config.remotes = Object.entries(dependencies).reduce(
      (previousValue, [dependency, dependencyConfig]) => {
        if (typeof dependencyConfig === 'string') {
          depURLs[dependency] = getUrl(dependencyConfig);
          return Object.assign(previousValue, {
            [dependency]: `${dependency}@${dependencyConfig}`,
          });
        } else if (typeof dependencyConfig === 'object') {
          let external = dependencyConfig.external;
          if (!external) {
            if (typeof dependencyConfig.host !== 'string') {
              throw new Error(
                `Type Error: ${dependency} config "host" field should be a string in the "dependencies" field from ${currentPath}.`
              );
            }
            external = `${dependency}@${dependencyConfig.host}${
              /\/$/.test(dependencyConfig.host) ? '' : '/'
            }${dependencyConfig.main ?? DEFAULT_DEPENDENCY_CONFIG_MAIN}`;
          }
          const remoteConfig: RemotesConfig = { external };
          if (dependencyConfig.shareScope) {
            remoteConfig.shareScope = dependencyConfig.shareScope;
          }
          if (Array.isArray(external)) {
            depURLs[dependency] = external.map(getUrl);
          } else {
            depURLs[dependency] = getUrl(external);
          }
          return Object.assign(previousValue, {
            [dependency]: remoteConfig,
          });
        } else {
          throw new Error(
            `Type Error: ${dependency} value is ${dependencyConfig} in the "dependencies" field, and all properties of object "dependencies" should be a object/string type in ${currentPath}`
          );
        }
      },
      {} as Record<string, RemotesConfig>
    );
  }

  return [
    new DefinePlugin({
      'process.env.APP_NAME': JSON.stringify(`${siteConfig.name}`),
      'process.env.DEP_URLS': JSON.stringify(`${JSON.stringify(depURLs)}`),
    }),
    new container.ModuleFederationPlugin({
      ...config,
    }),
  ];
};
