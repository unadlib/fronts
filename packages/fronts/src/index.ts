window.__FRONTS__ = window.__FRONTS__ ?? {};
if (!window.__FRONTS__[process.env.APP_NAME!]) {
  window.__FRONTS__[process.env.APP_NAME!] = JSON.parse(process.env.FPM_DEPS!);
}
window.__FRONTS__.__main__ = window.__FRONTS__.__main__ ?? process.env.APP_NAME;

export * from './loadApp';
export * from './useApp';
export * from './interface';
export * from './boot';
export * from './useIFrame';
export * from './importApp';
export * from './injectScript';
export * from './loadScript';
