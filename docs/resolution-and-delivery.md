# Resolution and delivery

## Separate policy from loading

A logical application reference should survive CDN moves, version promotions, tenant overrides,
and bundler changes:

```ts
const ref = {
  name: 'checkout',
  expose: './application',
  range: '^2.4.0',
  channel: 'stable',
};
```

The resolver combines that reference with request context:

```ts
const context = {
  environment: 'production',
  tenant: 'acme',
  cohort: 'experiment-b',
};
```

It returns one concrete result:

```ts
{
  ref,
  version: '2.4.3',
  source: {
    remote: {
      name: 'checkout_2_4_3',
      entry: 'https://cdn.example.com/checkout/2.4.3/mf-manifest.json',
    },
  },
  metadata: { deploymentId: 'dep-781', integritySet: 'sha384-…' },
}
```

The loader does not re-run business policy. It executes the resolved source.

## Resolver composition

Fronts includes:

- `createStaticResolver()` for tests, local development, and deterministic fallbacks;
- `createRegistryResolver()` for an HTTP deployment registry;
- `createCachedResolver()` for TTL plus stale-on-error behavior;
- `createFallbackResolver()` for ordered resolver fallback;
- `MemoryResolutionCache`, with a pluggable `ResolutionCache` contract.

The default cache key includes name, expose, range, channel, environment, tenant, and cohort. If
custom metadata affects selection, provide a custom key; otherwise two policy contexts could
incorrectly share a cached decision.

## Registry request and response

The built-in registry resolver sends a `GET` with these query fields when present:

```text
name, expose, range, channel, environment, tenant, cohort
```

The minimal response contains `source` and can also return `version` and `metadata`:

```json
{
  "version": "2.4.3",
  "source": {
    "remote": {
      "name": "checkout_2_4_3",
      "entry": "https://cdn.example.com/checkout/2.4.3/mf-manifest.json"
    }
  },
  "metadata": {
    "deploymentId": "dep-781"
  }
}
```

Authentication headers, credentials, endpoint calculation, fetch implementation, and payload
decoding are injectable. The registry should authorize the caller and validate every policy input;
the browser query is not trusted evidence of tenant or cohort membership.

## Resolution-aware container planning

A mount can derive its container only after the registry returns a concrete deployment. The
planner runs inside the same transaction before Fronts selects a container-specific loader:

```ts
await host.mount({
  ref: { name: 'checkout' },
  target: document.querySelector('#slot')!,
  props: { cartId: 'C-42' },
  container: ({ identity, resolved }) => {
    const frame = resolved.metadata?.frame;
    if (typeof frame !== 'object' || frame === null) return { type: 'dom' };

    const url = Reflect.get(frame, 'url');
    const origin = Reflect.get(frame, 'origin');
    if (typeof url !== 'string' || typeof origin !== 'string') {
      throw new Error('Invalid iframe deployment metadata.');
    }
    return {
      type: 'iframe',
      src: url,
      targetOrigin: origin,
      title: identity.name,
    };
  },
});
```

Validate registry metadata before constructing the request. Fronts snapshots the returned request,
routes the selected type through `containerLoaders`, and later gives the same frozen
`ResolvedApp` to `ContainerPrepareContext`.

## Module Federation source rules

`@fronts/mf` accepts the official `Remote` shape: an entry-based remote or a version-based remote.
The adapter:

1. registers the concrete remote on the supplied MF instance;
2. derives `remoteName/expose` from source and normalized reference;
3. calls `loadRemote(id, { from: 'runtime' })`;
4. maps null or thrown results to a Fronts load error;
5. uses `preloadRemote()` when the host requests preload;
6. rejects reuse of a remote name for a different source or known resolved version on the same MF
   instance unless force replacement is explicit.

Manifest is preferred over a raw remote entry because MF can discover expose assets, shared
metadata, type files, and preload resources. The official
[Manifest/Snapshot documentation](https://module-federation.io/guide/basic/manifest-snapshot)
describes that asset graph. Fronts treats it as MF-owned data and never edits the global snapshot.

## Version and channel policy

Recommended registry behavior:

- resolve a semantic range only against immutable published versions;
- map a channel (`stable`, `canary`, `next`) to a version/deployment server-side;
- calculate cohort allocation deterministically from authenticated subject + experiment salt;
- return a concrete version and immutable asset URL;
- record the policy revision/deployment ID in metadata;
- never reuse a mutable remote name for two loaded deployments in one MF instance (the Fronts MF
  adapter also guards registrations it has observed on that instance);
- keep the old artifact available for at least the rollback window.

Fronts does not prescribe the registry's database or rollout algorithm. That is deployment-plane
policy and must remain independently operable.

## Cache and outage behavior

`createCachedResolver()` has two windows:

- fresh TTL: return the cached resolution without calling the registry;
- stale TTL: if refresh fails, return the previous resolution while it remains within the stale
  window.

This is availability behavior, not silent version fallback. Emit telemetry whenever stale data is
used, set finite windows, and ensure immutable artifacts remain available. Do not allow stale cache
to bypass a security revocation; registries should provide a separate kill-switch path or a very
short TTL for sensitive applications.

## Preload

`host.preload()` resolves the same policy and asks the transport loader to preload. It does not
mount, create a service scope, or claim a container. MF's preload promise now reports aggregate
resource success/failure; callers should treat rejection as an optimization failure unless product
policy requires the application before navigation.

## Safe promotion and rollback

Use immutable deployment URLs and Fronts replacement together:

1. Registry promotes version B for the target policy cohort.
2. Host resolves B and mounts it in a staging slot.
3. B must pass protocol validation and readiness.
4. Host commits B and unmounts A.
5. If steps 2–3 fail, A remains the active instance.
6. Registry can demote B; future resolutions return A or a repaired C.

Avoid `registerRemotes(..., { force: true })` for routine promotion of an already active remote.
The official Runtime warns that force replacement clears loaded-module cache. Fronts supports the
flag only as an explicit source/adapter option; immutable remote names plus application
replacement are easier to audit.

## Out of scope

Fronts does not publish assets, sign manifests, generate types, run a deployment registry, or
choose shared dependency versions. Those remain producer/deployment/MF responsibilities.
