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
- capability and method validation before host invocation;
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

The resulting scope exposes only allowed keys. Service objects are proxied and revoked on abort or
unmount. In iframe mode, the same allowed keys become RPC stubs; the child never receives the
original host object.

Guidelines:

- expose intent, not ambient authority;
- validate service arguments in the host implementation;
- include identity/tenant context server-side instead of trusting child-supplied identity;
- rate-limit expensive or sensitive methods;
- never expose raw auth tokens, storage, `fetch`, DOM roots, or a generic `eval/execute` service;
- log denied capability requests and privileged calls.

## Legacy script policy

The legacy loader exists only for migration and has a stricter default posture:

- origin allowlist/predicate;
- SRI required by default for cross-origin scripts;
- optional nonce, referrer policy, and cross-origin attributes;
- load timeout and cancellation;
- deterministic global registration name;
- restoration of loader-owned globals on disposal.

Legacy code still executes in the parent realm and can access page globals. SRI verifies bytes; it
does not sandbox behavior. Prefer moving high-risk legacy applications directly to iframe mode or
rewriting them to the application protocol.

## Supply-chain checklist

- HTTPS for registry, manifests, entries, chunks, and iframe agent.
- Immutable versioned URLs and restrictive CDN write permissions.
- Artifact signing/attestation in the deployment pipeline.
- CSP with explicit script/connect/frame origins; nonce/hash where applicable.
- SRI for legacy cross-origin scripts when the asset graph permits it.
- Registry responses authenticated and authorized; browser query inputs are untrusted.
- Dependency and license scanning for producers and host.
- Retain previous immutable artifacts for rollback.
- Correlate registry deployment ID, MF loading trace, and Fronts trace ID.

## Non-goals

Fronts does not implement SES, Realms, DOM membrane virtualization, network interception, or a
complete browser sandbox. Use a hardened cross-origin iframe or a separate application boundary
when code is not trusted.
