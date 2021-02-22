import path from 'path';
import { SiteConfig } from './interface';

export const DEFAULT_CONFIG_PATH = 'site.json';

export const getSiteConfig = (configPath = DEFAULT_CONFIG_PATH) => {
  const currentPath = path.resolve(process.cwd(), configPath);
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const siteConfig: SiteConfig = require(currentPath);
  return siteConfig;
};
