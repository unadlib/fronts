/// <reference path="./services.d.ts" />

/** An official Module Federation instance the composition root created before this example. */
declare const parentFederation: import('@module-federation/runtime').ModuleFederation;

declare const services: HostServices;
declare const navigationAllowlist: ReadonlySet<string>;
declare const reportAgentShutdownFailure: (error: unknown) => void;
