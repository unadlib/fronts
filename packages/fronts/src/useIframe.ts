import { getUid } from './getUid';
import { getScriptLink } from './importApp';
import { UseIframe } from './interface';

/**
 *
 */
export const getIframeUrl = async (siteName: string) => {
  let hasVersionControl: boolean;
  try {
    hasVersionControl = !!process.env.FPM_REG;
  } catch (e) {
    throw new Error(
      `The current running mode is SPA, it does not contain any Micro Frontends mode, please use the native iframe element API instead of 'useIframe()'.`
    );
  }
  if (hasVersionControl) {
    const scriptLink = await getScriptLink(siteName);
    const url = new URL(scriptLink).origin;
    return url;
  }
  const urlsMap: Record<string, string | string[]> = JSON.parse(
    process.env.DEP_URLS!
  );
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

export const useIframe: UseIframe = async ({ target, name, url, attrs }) => {
  const iframe = document.createElement('iframe');
  iframe.src = url ?? (await getIframeUrl(name));
  const uid = getUid(name);
  iframe.setAttribute('frameBorder', 'no');
  const attributes: Record<string, any> = attrs ?? {};
  for (const key in attributes) {
    iframe.setAttribute(key, attributes[key]);
  }
  iframe.setAttribute('data-fronts', uid);
  iframe.setAttribute('name', uid);
  target?.appendChild(iframe);
};
