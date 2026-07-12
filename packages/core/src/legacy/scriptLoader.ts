import type { ResolvedApp } from '../resolver/index.js';
import { FrontsError, createAbortedError, frontsErrorCodes } from '../errors.js';
import { adaptLegacyFrontsModule } from './adapter.js';
import type {
  LegacyFrontsModule,
  LegacyOriginPolicy,
  LegacyScriptLoader,
  LegacyScriptLoaderOptions,
  LegacyScriptSource,
} from './types.js';

interface LegacyGlobals {
  __FRONTS__DYNAMIC__IMPORT__?: boolean;
  __FRONTS__DYNAMIC__MODULES__?: Record<string, LegacyFrontsModule>;
}

interface GlobalSnapshot {
  readonly hadDynamicImport: boolean;
  readonly dynamicImport: boolean | undefined;
  readonly hadModules: boolean;
  readonly modules: Record<string, LegacyFrontsModule> | undefined;
}

function asLegacyWindow(view: Window): Window & LegacyGlobals {
  return view as Window & LegacyGlobals;
}

function hasOwn(value: object, key: PropertyKey): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function loadFailure(message: string, details: Readonly<Record<string, unknown>>): FrontsError {
  return new FrontsError(frontsErrorCodes.loadFailed, message, {
    details,
    phase: 'load',
  });
}

function isAllowedOrigin(policy: LegacyOriginPolicy, url: URL): boolean {
  return typeof policy === 'function' ? policy(url) : policy.includes(url.origin);
}

function raceWithSignal<Value>(promise: Promise<Value>, signal: AbortSignal): Promise<Value> {
  if (signal.aborted) {
    return Promise.reject(createAbortedError('load', signal.reason));
  }

  return new Promise<Value>((resolve, reject) => {
    const onAbort = () => reject(createAbortedError('load', signal.reason));
    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener('abort', onAbort);
        resolve(value);
      },
      (error: unknown) => {
        signal.removeEventListener('abort', onAbort);
        reject(error);
      },
    );
  });
}

export function createLegacyScriptLoader(
  options: LegacyScriptLoaderOptions = {},
): LegacyScriptLoader {
  const document = options.document ?? globalThis.document;
  if (document === undefined || document.defaultView === null) {
    throw loadFailure('The legacy script loader requires a browser Document.', {});
  }

  const view = asLegacyWindow(document.defaultView);
  const baseUrl = new URL(document.baseURI);
  const originPolicy = options.allowedOrigins ?? [baseUrl.origin];
  const timeoutMs = options.timeoutMs ?? 10_000;
  const removeScript = options.removeScript ?? true;
  const requireIntegrity = options.requireIntegrityForCrossOrigin ?? true;
  const controller = new AbortController();
  const scriptLoads = new Map<string, Promise<LegacyFrontsModule>>();
  const sourceByName = new Map<string, string>();
  const loadedValues = new Map<string, LegacyFrontsModule>();
  let snapshot: GlobalSnapshot | undefined;
  let disposed = false;

  const installGlobals = (): Record<string, LegacyFrontsModule> => {
    if (snapshot === undefined) {
      snapshot = {
        dynamicImport: view.__FRONTS__DYNAMIC__IMPORT__,
        hadDynamicImport: hasOwn(view, '__FRONTS__DYNAMIC__IMPORT__'),
        hadModules: hasOwn(view, '__FRONTS__DYNAMIC__MODULES__'),
        modules: view.__FRONTS__DYNAMIC__MODULES__,
      };
    }
    view.__FRONTS__DYNAMIC__IMPORT__ = true;
    view.__FRONTS__DYNAMIC__MODULES__ ??= {};
    return view.__FRONTS__DYNAMIC__MODULES__;
  };

  const validateSource = (source: LegacyScriptSource, globalName: string): URL => {
    let url: URL;
    try {
      url = new URL(source.url, baseUrl);
    } catch (error) {
      throw new FrontsError(
        frontsErrorCodes.loadFailed,
        `Legacy application "${globalName}" has an invalid script URL.`,
        { cause: error, details: { url: source.url }, phase: 'load' },
      );
    }

    if (!['http:', 'https:'].includes(url.protocol) || !isAllowedOrigin(originPolicy, url)) {
      throw loadFailure(
        `Legacy script origin "${url.origin}" is not allowed for application "${globalName}".`,
        { globalName, origin: url.origin, url: url.href },
      );
    }
    if (requireIntegrity && url.origin !== baseUrl.origin && !source.integrity) {
      throw loadFailure(
        `Cross-origin legacy script "${url.href}" requires a Subresource Integrity value.`,
        { globalName, origin: url.origin, url: url.href },
      );
    }
    return url;
  };

  const inject = (
    url: URL,
    source: LegacyScriptSource,
    globalName: string,
    modules: Record<string, LegacyFrontsModule>,
  ): Promise<LegacyFrontsModule> => {
    const key = `${globalName}\u0000${url.href}`;
    const existing = scriptLoads.get(key);
    if (existing !== undefined) {
      return existing;
    }

    const promise = new Promise<LegacyFrontsModule>((resolve, reject) => {
      const script = document.createElement('script');
      script.async = true;
      script.src = url.href;
      if (source.integrity !== undefined) {
        script.integrity = source.integrity;
      }
      if (source.crossOrigin !== undefined) {
        script.crossOrigin = source.crossOrigin;
      }
      if (source.nonce !== undefined) {
        script.nonce = source.nonce;
      }
      if (source.referrerPolicy !== undefined) {
        script.referrerPolicy = source.referrerPolicy;
      }

      let settled = false;
      const finish = (operation: () => void): void => {
        if (settled) {
          return;
        }
        settled = true;
        globalThis.clearTimeout(timeout);
        controller.signal.removeEventListener('abort', onAbort);
        script.removeEventListener('error', onError);
        script.removeEventListener('load', onLoad);
        if (removeScript) {
          script.remove();
        }
        operation();
      };
      const onAbort = () =>
        finish(() => reject(createAbortedError('load', controller.signal.reason)));
      const onError = () =>
        finish(() =>
          reject(
            loadFailure(`Failed to load legacy script "${url.href}".`, {
              globalName,
              url: url.href,
            }),
          ),
        );
      const onLoad = () =>
        finish(() => {
          const loaded = modules[globalName];
          if (loaded === undefined || typeof loaded.default !== 'function') {
            reject(
              loadFailure(
                `Legacy script "${url.href}" did not register application "${globalName}".`,
                { globalName, url: url.href },
              ),
            );
            return;
          }
          loadedValues.set(globalName, loaded);
          resolve(loaded);
        });
      const timeout = globalThis.setTimeout(
        () =>
          finish(() =>
            reject(
              loadFailure(`Timed out loading legacy script "${url.href}".`, {
                globalName,
                timeoutMs,
                url: url.href,
              }),
            ),
          ),
        timeoutMs,
      );

      controller.signal.addEventListener('abort', onAbort, { once: true });
      script.addEventListener('error', onError, { once: true });
      script.addEventListener('load', onLoad, { once: true });
      document.head.append(script);
    });

    scriptLoads.set(key, promise);
    void promise.catch(() => {
      scriptLoads.delete(key);
      if (modules[globalName] === undefined) {
        sourceByName.delete(globalName);
      }
    });
    return promise;
  };

  const loadModule = async (
    resolved: ResolvedApp<LegacyScriptSource>,
    signal: AbortSignal,
  ): Promise<LegacyFrontsModule> => {
    if (signal.aborted) {
      throw createAbortedError('load', signal.reason);
    }
    if (disposed) {
      throw loadFailure('The legacy script loader has been disposed.', {
        name: resolved.ref.name,
      });
    }
    const globalName = resolved.source.globalName ?? resolved.ref.name;
    const url = validateSource(resolved.source, globalName);
    const boundSource = sourceByName.get(globalName);
    if (boundSource !== undefined && boundSource !== url.href) {
      throw loadFailure(
        `Legacy global "${globalName}" is already bound to a different script URL.`,
        { currentUrl: boundSource, globalName, requestedUrl: url.href },
      );
    }
    sourceByName.set(globalName, url.href);

    const modules = installGlobals();
    const registered = modules[globalName];
    const loaded =
      registered !== undefined
        ? registered
        : await raceWithSignal(inject(url, resolved.source, globalName, modules), signal);
    if (typeof loaded.default !== 'function') {
      throw loadFailure(`Legacy global "${globalName}" is not a Fronts 0.x module.`, {
        globalName,
        url: url.href,
      });
    }
    return loaded;
  };

  return {
    dispose() {
      if (disposed) {
        return;
      }
      disposed = true;
      controller.abort('legacy script loader disposed');
      scriptLoads.clear();
      sourceByName.clear();

      if (snapshot !== undefined) {
        const modules = view.__FRONTS__DYNAMIC__MODULES__;
        if (modules !== undefined) {
          for (const [name, value] of loadedValues) {
            if (modules[name] === value) {
              Reflect.deleteProperty(modules, name);
            }
          }
        }
        if (!snapshot.hadModules && modules !== undefined) {
          if (Object.keys(modules).length === 0) {
            delete view.__FRONTS__DYNAMIC__MODULES__;
          }
        } else if (
          snapshot.hadModules &&
          snapshot.modules === undefined &&
          modules !== undefined &&
          Object.keys(modules).length === 0
        ) {
          Reflect.set(view, '__FRONTS__DYNAMIC__MODULES__', undefined);
        }
        if (snapshot.hadDynamicImport) {
          Reflect.set(view, '__FRONTS__DYNAMIC__IMPORT__', snapshot.dynamicImport);
        } else {
          delete view.__FRONTS__DYNAMIC__IMPORT__;
        }
      }
      loadedValues.clear();
    },
    async load(resolved, context) {
      const loaded = await loadModule(resolved, context.signal);
      return adaptLegacyFrontsModule(loaded, {
        name: resolved.ref.name,
        updateMode: options.updateMode ?? 'remount',
      });
    },
    async preload(resolved, context) {
      await loadModule(resolved, context.signal);
    },
  };
}
