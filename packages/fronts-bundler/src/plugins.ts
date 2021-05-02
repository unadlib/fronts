/* eslint-disable @typescript-eslint/no-var-requires */
import path from 'path';
import { container, DefinePlugin, BannerPlugin } from 'webpack';
import { getSiteConfig, DEFAULT_CONFIG_PATH } from './getSiteConfig';
import { ModuleFederationPluginOptions, RemotesConfig } from './interface';
import { getUrl } from './utils';

const DEFAULT_DEPENDENCY_CONFIG_MAIN = 'remoteEntry.js';

export const getPlugins = (configPath = DEFAULT_CONFIG_PATH) => {
  if (process.env.SPA) return [];
  const depURLs: Record<string, string | string[]> = {};
  const currentPath = path.resolve(process.cwd(), configPath);
  const siteConfig = getSiteConfig(configPath);
  if (typeof siteConfig.name !== 'string') {
    throw new Error(
      `The "name" field should be a string type in ${currentPath}`
    );
  }

  const {
    main = DEFAULT_DEPENDENCY_CONFIG_MAIN,
    exports,
    dependencies,
    version,
    registry,
    ...otherConfig
  } = siteConfig;

  if (typeof main !== 'string') {
    throw new Error(
      `The "main" field should be a string type in ${currentPath}`
    );
  }

  if (typeof registry !== 'undefined' && typeof registry !== 'string') {
    throw new Error(
      `The "registry" field should be a string type in ${currentPath}`
    );
  }

  // TODO: exclude about `fronts` package from the `shared` field
  const config: ModuleFederationPluginOptions = {
    ...otherConfig,
    filename: main,
    exposes: {},
  };

  if (Array.isArray(exports)) {
    const exposes = {};
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
        if (typeof registry !== 'undefined') {
          if (typeof dependencyConfig !== 'string') {
            throw new Error(
              `Type Error: ${dependency} value is ${dependencyConfig} in the "dependencies" field, and all properties of object "dependencies" should be a string type in ${currentPath}`
            );
          }
          return previousValue;
        }
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

  const metaData = {
    dependencies:
      (typeof registry !== 'undefined' ? dependencies : depURLs) ?? {},
    ...(registry ? { registry } : {}),
    ...(version ? { version } : {}),
  };

  return [
    new BannerPlugin({
      banner: `
        window.__FRONTS__ = window.__FRONTS__ ? window.__FRONTS__ : {};
        if (!window.__FRONTS__['${siteConfig.name}']) window.__FRONTS__['${
        siteConfig.name
      }'] = ${JSON.stringify(metaData)};`,
      include: `${config.filename}`,
      raw: true,
    }),
    new DefinePlugin({
      'process.env.APP_NAME': JSON.stringify(`${siteConfig.name}`),
      'process.env.FPM_DEPS': JSON.stringify(`${JSON.stringify(metaData)}`),
      // Fronts dependencies package manager registry url
      'process.env.FPM_REG': JSON.stringify(registry),
      ...(typeof registry !== 'undefined'
        ? {
            // Fronts dependencies package mapping
            'process.env.FPM_MAP': JSON.stringify(
              `${JSON.stringify(dependencies ?? {})}`
            ),
          }
        : {
            // Not using package management
            'process.env.DEP_URLS': JSON.stringify(
              `${JSON.stringify(depURLs)}`
            ),
          }),
    }),
    new container.ModuleFederationPlugin({
      ...config,
    }),
  ];
};
