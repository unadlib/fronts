import { container, Configuration } from 'webpack';

export interface FrontsConfiguration extends Configuration {
  /**
   * Fronts site config path
   */
  configPath?: string;
}

export interface RemotesConfig {
  /**
   * Container locations from which modules should be resolved and loaded at runtime.
   */
  external: string | string[];
  /**
   * The name of the share scope shared with this remote.
   */
  shareScope?: string;
}

export interface DependencyConfig {
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

export type ModuleFederationPluginOptions = ConstructorParameters<
  typeof container.ModuleFederationPlugin
>[0];

export interface SiteConfig
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
  /**
   * Specify a version for the package.
   */
  version?: string;
  /**
   * Specify a registry server to resolve packages by name and version.
   */
  registry?: string;
}
