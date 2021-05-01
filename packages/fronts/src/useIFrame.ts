import { UseIFrame } from './interface';

export const getIFrameUrl = (siteName: string) => {
  // TODO: think about registry
  const urlsMap: Record<string, string | string[]> = JSON.parse(
    process.env.DEP_URLS!
  );
  // TODO: pass `props`
  const url = Array.isArray(urlsMap[siteName])
    ? urlsMap[siteName][0] // TODO: handle link request error
    : (urlsMap[siteName] as string);
  if (typeof urlsMap[siteName] === 'undefined') {
    console.warn(
      `The site named "${siteName}" is not in the dependency list of "${process.env.APP_NAME}" App.`
    );
  }
  return url;
};

export const useIFrame: UseIFrame = (siteName, { target, ...options }) => {
  const iframe = document.createElement('iframe');
  iframe.src = getIFrameUrl(siteName);
  for (const key in options) {
    iframe.setAttribute(key, options[key]);
  }
  target?.appendChild(iframe);
};
