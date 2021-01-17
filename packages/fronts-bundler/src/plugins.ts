/* eslint-disable @typescript-eslint/no-var-requires */
import path from 'path';
import { container, DefinePlugin } from 'webpack';

const DEFAULT_DEPENDENCY_CONFIG_MAIN = 'remoteEntry.js';

interface RemotesConfig {
  /**
   * Container locations from which modules should be resolved and loaded at runtime.
   */
  external: string | string[];
  /**
   * The name of the share scope shared with this remote.
   */
  shareScope?: string;
}

interface DependencyConfig {
  /**
   * Container locations from which modules should be resolved and loaded at runtime.
   */
  external?: string | string[];
  /**
   * The name of the share scope shared with this remote.
   */
  shareScope?: string;
  /**
   * The host url for this remote.
   */
  host?: string;
  /**
   * The main filename for this remote.
   */
  main?: string;
}

type ModuleFederationPluginOptions = ConstructorParameters<
  typeof container.ModuleFederationPlugin
>[0];

interface SiteConfig
  extends Pick<
    ModuleFederationPluginOptions,
    Exclude<
      keyof ModuleFederationPluginOptions,
      'exposes' | 'filename' | 'remotes'
    >
  > {
  /**
   * The main filename of the container as relative path inside the `output.path` directory.
   */
  main?: string;
  /**
   * Modules that should be exposed by this container. When provided, property name is used as public name, otherwise public name is automatically inferred from request.
   */
  exports?: string[];
  /**
   * Container dependent locations and request scopes from which modules should be resolved and loaded at runtime. When provided, property name is used as request scope, otherwise request scope is automatically inferred from container dependent location.
   */
  dependencies?: Record<string, DependencyConfig | string>;
}

export const getPlugins = () => {
  if (process.env.SPA) return [];
  const currentPath = path.resolve(process.cwd(), 'site.json');
  const siteConfig: SiteConfig = require(currentPath);
  if (typeof siteConfig.name !== 'string') {
    throw new Error(
      `The "name" field should be a string type in ${currentPath}`
    );
  }

  const {
    main = DEFAULT_DEPENDENCY_CONFIG_MAIN,
    exports,
    dependencies,
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
    // TODO: set exposes ExposesObject
    Object.assign(
      config.exposes,
      exports.reduce((acc, name) => Object.assign(acc, { [name]: name }), {})
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
    }),
    new container.ModuleFederationPlugin({
      ...config,
    }),
  ];
};
