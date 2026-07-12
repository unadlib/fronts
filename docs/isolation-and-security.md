# Isolation and security

## Threat model

Fronts assumes independently delivered applications may contain defects and may have different
levels of trust. It reduces accidental interference and constrains explicit host APIs. It does not
claim that same-realm JavaScript is a security sandbox.

Security decisions must consider three separate surfaces:

1. code provenance — what script/module is allowed to execute;
2. execution realm — what browser globals and DOM the code can reach;
3. authority — what host operations the application can invoke.

## Container comparison

| Container  | CSS isolation                                                  | JS realm isolation                                       | Host service transport | Typical use                              |
| ---------- | -------------------------------------------------------------- | -------------------------------------------------------- | ---------------------- | ---------------------------------------- |
| DOM        | None beyond producer conventions                               | None                                                     | Direct scoped object   | Trusted apps sharing a design system     |
| Shadow DOM | Strong selector boundary, with known escape/inheritance limits | None                                                     | Direct scoped object   | Trusted code requiring style containment |
| iframe     | Document/origin boundary                                       | Separate realm; strength depends on `sandbox` and origin | Scoped RPC             | Lower-trust or incompatible applications |

Official Module Federation deliberately does not provide automatic CSS isolation and recommends
producer-owned strategies because shared dependencies and runtime CSS capture create ambiguous
ownership. Fronts follows that rule. Its Shadow container supplies a target; it does not scrape or
move styles injected into the parent document. See the official
[style isolation guidance](https://module-federation.io/guide/basic/css-isolate).

## DOM container

The DOM adapter creates an owned child element with validated tag name, class, attributes, and
application identity data. The application mounts inside it. Unmount destroys the application
first, then removes the owned element.

DOM mode is appropriate only when producer code is trusted to share the page. The application can
still access `window`, `document`, cookies available to the page, and other DOM outside its target.

## Shadow DOM container

The Shadow adapter creates a host element and attaches an open or closed shadow root. Producer
styles must be authored for Shadow DOM: inline style, constructable stylesheet, CSS-in-JS aimed at
the shadow root, or an exported custom element.

Shadow DOM does not isolate:

- JavaScript globals or network access;
- inherited CSS custom properties and inheritable properties;
- browser APIs such as storage;
- portals that intentionally render outside the shadow root;
- shared singleton state.

Treat it as style/DOM encapsulation, not a hostile-code boundary.

## Iframe container and agent

Iframe mode divides responsibility:

- parent: resolve policy, create iframe, authorize capabilities, proxy lifecycle calls;
- child agent: own a separate MF instance, load/validate/mount the application, and operate on the
  child document;
- RPC channel: correlate requests by unpredictable channel ID and protocol version.

Required controls:

- exact `targetOrigin`; wildcard origins are rejected;
- sender `origin` and `source` validation on both sides;
- an allowlist of parent origins in the agent;
- explicit iframe `sandbox` and `allow` policy chosen by the host;
- one-time capability negotiation after the child application is loaded;
- negotiated capability and method validation on every host invocation;
- serializable arguments/results only;
- bounded connection and lifecycle timeouts;
- channel teardown and pending-promise rejection on dispose.

The iframe agent creates its own Module Federation instance. This prevents the parent from
evaluating the remote and then pretending an iframe provides isolation. Shared dependencies are
therefore scoped to the child runtime, trading some duplication for realm isolation.

### Sandbox and origin choice

For untrusted content, serve the agent from a dedicated origin and avoid combining
`allow-scripts` with `allow-same-origin` when the child could otherwise become same-origin with the
parent. Grant browser permissions (`allow`) individually. Content Security Policy, Trusted Types,
COOP/COEP, cookie attributes, and server headers remain deployment responsibilities.

The iframe container defaults to `sandbox="allow-scripts"`. `allow-same-origin` is available only
through an explicit sandbox option and should normally be paired with a dedicated child origin.

## Capability-scoped services

Producer declaration:

```ts
capabilities: ['navigation', 'telemetry'];
```

Host authorization:

```ts
capabilityPolicy: ({ capability, identity }) =>
  capability !== 'navigation' || trustedNavigationApps.has(identity.name);
```

For identity-, tenant-, deployment-, or trace-bound implementations, configure `createServices`.
It receives trusted host identity, operation, resolution policy, resolved deployment, declared
capabilities, and the instance signal, and may return an asynchronous disposer. Static and
provider services are merged, with provider values taking precedence, before policy evaluation.

The resulting scope exposes only allowed own keys. Prototype-mutating names are rejected. Service
objects are proxied and revoked immediately on abort or unmount; provider resources are then
disposed exactly once as lifecycle cleanup proceeds.

Iframe authority is the intersection of three sets:

1. the maximum configured by `IframeProxyLoaderOptions.capabilities`;
2. services actually present in the host-authorized instance facade;
3. capabilities declared by the application loaded inside the child.

Iframe protocol v2 requires the agent to send the third set after loading the real application.
The parent validates the intersection, locks one grant for that session, and the child creates RPC
stubs only for that exact grant. The parent independently checks the locked grant again on every
`service.call`; hiding extra stubs in the child is not treated as the security boundary. A call
before negotiation, a repeated negotiation, or a call outside the grant fails closed. The child
never receives an original host service object.

Guidelines:

- expose intent, not ambient authority;
- validate service arguments in the host implementation;
- include identity/tenant context server-side instead of trusting child-supplied identity;
- rate-limit expensive or sensitive methods;
- never expose raw auth tokens, storage, `fetch`, DOM roots, or a generic `eval/execute` service;
- log denied capability requests and privileged calls.
- make providers abort-aware and roll back partial allocation when they throw before returning.

## Supply-chain checklist

- HTTPS for registry, manifests, entries, chunks, and iframe agent.
- Immutable versioned URLs and restrictive CDN write permissions.
- Artifact signing/attestation in the deployment pipeline.
- CSP with explicit script/connect/frame origins; nonce/hash where applicable.
- Registry responses authenticated and authorized; browser query inputs are untrusted.
- Dependency and license scanning for producers and host.
- Retain previous immutable artifacts for rollback.
- Correlate registry deployment ID, MF loading trace, and Fronts trace ID.

## Non-goals

Fronts does not implement SES, Realms, DOM membrane virtualization, network interception, or a
complete browser sandbox. Use a hardened cross-origin iframe or a separate application boundary
when code is not trusted.
