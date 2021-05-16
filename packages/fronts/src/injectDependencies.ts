import { identifier } from "./constants";

try {
  window[identifier] = window[identifier] ?? {};
  window[identifier].__main__ =
    window[identifier].__main__ ?? process.env.APP_NAME;
  window[identifier].__entry__ =
    window[identifier].__entry__ ?? window.location.href;
  if (!window[identifier][process.env.APP_NAME!]) {
    window[identifier][process.env.APP_NAME!] = JSON.parse(
      process.env.FPM_DEPS!
    );
  }
} catch (e) {
  //
}
