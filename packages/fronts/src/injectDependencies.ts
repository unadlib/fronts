try {
  window.__FRONTS__ = window.__FRONTS__ ?? {};
  if (!window.__FRONTS__[process.env.APP_NAME!]) {
    window.__FRONTS__[process.env.APP_NAME!] = JSON.parse(
      process.env.FPM_DEPS!
    );
  }
  window.__FRONTS__.__main__ =
    window.__FRONTS__.__main__ ?? process.env.APP_NAME;
} catch (e) {
  //
}
