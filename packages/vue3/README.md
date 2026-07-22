# @fronts/vue3

Vue 3 producer and host adapters for the Fronts 2.0 application protocol.

```sh
pnpm add @fronts/core @fronts/vue3 vue
```

## Producer

```ts
import { defineComponent, h } from 'vue';
import { defineVueApp, useHostServices } from '@fronts/vue3';

interface Services {
  readonly telemetry: { emit(name: string, data?: unknown): void };
}

const Account = defineComponent({
  props: { accountId: { type: String, required: true } },
  setup(props) {
    const services = useHostServices<Services>();
    return () =>
      h(
        'button',
        { onClick: () => services.telemetry.emit('account.open', props.accountId) },
        `Account ${props.accountId}`,
      );
  },
});

export default defineVueApp<{ accountId: string }, Services>({
  name: 'account',
  capabilities: ['telemetry'],
  root: Account,
});
```

`defineVueApp()` owns the Vue app, provided Fronts context, reactive prop updates, `nextTick()`
readiness, optional application configuration, and unmount. It supports Element and ShadowRoot
targets.

## Vue host

```vue
<script setup lang="ts">
import { RemoteApp } from '@fronts/vue3';
import { host } from './runtime';
</script>

<template>
  <RemoteApp
    :host="host"
    :app="{ name: 'account', expose: './application' }"
    :app-props="{ accountId: 'A-42' }"
    :container="{ type: 'shadow' }"
  >
    <template #loading>Loading…</template>
    <template #error="{ error, retry }">
      {{ error.message }} <button @click="retry">Retry</button>
    </template>
  </RemoteApp>
</template>
```

Use the `RemoteApp` component or `useRemoteApp()` composable with a Fronts host. The package also
exports composables for application identity, abort signal, and scoped host services.

`retry()` abandons the failed attempt and mounts again with a new operation identity; it never
resumes a partially failed mount.

The `container` prop accepts either a static container request or an async resolver that can derive
the request from the resolved deployment before Fronts selects its loader.

`app-props`, `container`, and `resolve` are compared by value, so writing them inline in a template
neither updates nor remounts the application on every parent render. In-place mutation of a
reactive prop object still updates. Pass `are-props-equal` when props need a different equality
contract.

This adapter is for applications participating in the Fronts host ABI. If an MF-only Vue
architecture only needs framework/router integration, evaluate the official
`@module-federation/bridge-vue3` package first.

Fronts is currently alpha. Protocol and API changes may occur before 2.0 stable.

MIT
