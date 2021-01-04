/* eslint-disable @typescript-eslint/no-var-requires */
import path from 'path';
import { container, DefinePlugin } from 'webpack';

type ModuleFederationPluginOptions = ConstructorParameters<
  typeof container.ModuleFederationPlugin
>[0];

interface SiteConfig
  extends Pick<
    ModuleFederationPluginOptions,
    Exclude<keyof ModuleFederationPluginOptions, 'exposes' | 'filename'>
  > {
  /**
   * The main filename of the container as relative path inside the `output.path` directory.
   */
  main?: string;
  /**
   * Modules that should be exposed by this container. When provided, property name is used as public name, otherwise public name is automatically inferred from request.
   */
  exports?: string[];
}

export const getPlugins = () => {
  const currentPath = path.resolve(process.cwd(), 'site.json');
  const siteConfig: SiteConfig = require(currentPath);
  if (typeof siteConfig.name !== 'string') {
    throw new Error(
      `The "name" field should be a string type in ${currentPath}`
    );
  }

  const { main, exports, ...otherConfig } = siteConfig;

  const config: ModuleFederationPluginOptions = {
    ...otherConfig,
    exposes: {},
  };

  if (typeof main === 'string') {
    config.filename = main;
  } else if (typeof main !== 'undefined') {
    throw new Error(
      `The "main" field should be a string type in ${currentPath}`
    );
  }

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

  return [
    new DefinePlugin({
      'process.env.APP_NAME': JSON.stringify(`${siteConfig.name}`),
    }),
    new container.ModuleFederationPlugin({
      ...config,
    }),
  ];
};
