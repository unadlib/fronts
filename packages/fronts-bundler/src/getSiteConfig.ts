import path from 'path';
import { SiteConfig } from './interface';

export const getSiteConfig = () => {
  const currentPath = path.resolve(process.cwd(), 'site.json');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const siteConfig: SiteConfig = require(currentPath);
  return siteConfig;
};
