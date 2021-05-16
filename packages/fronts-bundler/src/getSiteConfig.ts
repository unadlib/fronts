import { SiteConfig } from './interface';

export const getSiteConfig = (currentPath: string) => {
  let siteConfig: SiteConfig;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    siteConfig = require(currentPath);
  } catch (e) {
    console.error(
      `Failed to read the site config file. Please check ${currentPath}.`
    );
    throw e;
  }
  return siteConfig;
};
