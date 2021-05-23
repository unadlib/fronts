import { getCacheLink, setCacheLink } from './cache';
import { storePrefix } from './constants';
import { injectScript } from './injectScript';
import { RegistryResponse } from './interface';

const getContainer = (name: string) => (window as Record<string, any>)[name];

const loadModuleScript = (name: string, url: string) => {
  return new Promise((resolve, reject) => {
    const container = getContainer(name);
    if (typeof container !== 'undefined') {
      // Script have already been loaded.
      return resolve(null);
    }
    injectScript({
      url,
      reject,
      resolve,
    });
  });
};

export const getModule = async (name: string, module: string) => {
  // Initializes the share scope. This fills it with known provided modules from this build and all remotes
  await __webpack_init_sharing__('default');
  const container = getContainer(name); // or get the container somewhere else
  // Initialize the container, it may provide shared modules
  await container.init(__webpack_share_scopes__.default);
  const factory = await container.get(module);
  return factory();
};

export const getScriptLink = async (name: string) => {
  if (typeof process.env.FPM_MAP !== 'string') {
    throw new Error(`The data about Fronts app dependencies does not exist.`);
  }
  const frontsPackagesMap = JSON.parse(process.env.FPM_MAP);
  const depInfo = frontsPackagesMap[name];
  const storageKey = `${storePrefix}${name}`;
  const isExternalLink = /^(http|https):/.test(depInfo);
  const cacheLink = await getCacheLink(storageKey);
  let scriptLink: string;
  if (isExternalLink) {
    scriptLink = depInfo;
  } else {
    // todo: uuid
    const fetchPromise: Promise<RegistryResponse> = fetch(
      `${process.env.FPM_REG}?scope=${encodeURIComponent(`${name}@${depInfo}`)}`
    )
      .then((data) => data.json())
      .catch(() => {
        //
      });
    if (cacheLink) {
      fetchPromise.then((depLinks) => {
        setCacheLink(storageKey, depLinks[name]);
      });
      scriptLink = cacheLink;
    } else {
      const depLinks = await fetchPromise;
      setCacheLink(storageKey, depLinks[name]);
      scriptLink = depLinks[name];
    }
  }
  return scriptLink;
};

export const importApp = async (path: string) => {
  const [name, ...paths] = path.split('/');
  const modulePath = `./${paths.join('/')}`;
  try {
    const scriptLink = await getScriptLink(name);
    await loadModuleScript(name, scriptLink);
    const module = await getModule(name, modulePath);
    return module;
  } catch (e) {
    console.error(
      `Failed to import module ${modulePath} of application ${name} from registry ${process.env.FPM_REG}:`
    );
    throw e;
  }
};
