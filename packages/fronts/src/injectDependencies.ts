try {
  window.__FRONTS__ = window.__FRONTS__ ?? {};
  window.__FRONTS__.__main__ =
    window.__FRONTS__.__main__ ?? process.env.APP_NAME;
  window.__FRONTS__.__entry__ =
    window.__FRONTS__.__entry__ ?? window.location.href;
  if (!window.__FRONTS__[process.env.APP_NAME!]) {
    window.__FRONTS__[process.env.APP_NAME!] = JSON.parse(
      process.env.FPM_DEPS!
    );
  }
} catch (e) {
  //
}
