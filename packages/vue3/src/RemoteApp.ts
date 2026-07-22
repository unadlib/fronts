import { computed, defineComponent, h, type PropType, type VNodeChild } from 'vue';

import type {
  AppRef,
  BuiltInContainerRequest,
  ContainerRequest,
  ContainerRequestResolver,
  FrontsHost,
  MountedApplication,
  MountResolveOptions,
} from '@fronts/core';

import { useRemoteApp } from './useRemoteApp.js';

type UnknownHost = FrontsHost<unknown, object>;

export const RemoteApp = defineComponent({
  name: 'FrontsRemoteApp',
  inheritAttrs: false,
  props: {
    app: { type: Object as PropType<AppRef>, required: true },
    appProps: { type: null, required: true },
    container: [Object, Function] as PropType<
      | BuiltInContainerRequest
      | ContainerRequest
      | ContainerRequestResolver<unknown, ContainerRequest>
    >,
    fallback: null as unknown as PropType<VNodeChild | ((error: Error) => VNodeChild)>,
    host: { type: Object as PropType<UnknownHost>, required: true },
    instanceId: String,
    loading: null as unknown as PropType<VNodeChild>,
    mountKey: [String, Number],
    readyTimeoutMs: Number,
    resolve: Object as PropType<MountResolveOptions>,
    targetProps: Object as PropType<Record<string, unknown>>,
    traceId: String,
  },
  emits: {
    error: (error: Error) => error instanceof Error,
    ready: (instance: MountedApplication<unknown, unknown>) => instance !== null,
  },
  setup(props, { attrs, emit, slots }) {
    const options = computed(() => ({
      app: props.app,
      appProps: props.appProps,
      host: props.host,
      onError: (error: Error) => emit('error', error),
      onReady: (instance: MountedApplication<unknown, unknown>) => emit('ready', instance),
      ...(props.container === undefined ? {} : { container: props.container }),
      ...(props.instanceId === undefined ? {} : { instanceId: props.instanceId }),
      ...(props.mountKey === undefined ? {} : { mountKey: props.mountKey }),
      ...(props.readyTimeoutMs === undefined ? {} : { readyTimeoutMs: props.readyTimeoutMs }),
      ...(props.resolve === undefined ? {} : { resolve: props.resolve }),
      ...(props.traceId === undefined ? {} : { traceId: props.traceId }),
    }));
    const remote = useRemoteApp(options);

    return () => {
      let status: VNodeChild = null;
      if (remote.status.value === 'mounting') {
        status = slots.loading?.() ?? props.loading ?? null;
      } else if (remote.status.value === 'error' && remote.error.value !== null) {
        status =
          slots.error?.({ error: remote.error.value }) ??
          (typeof props.fallback === 'function'
            ? props.fallback(remote.error.value)
            : (props.fallback ?? null));
      }

      return h('div', { ...attrs, 'data-fronts-vue-status': remote.status.value }, [
        h('div', {
          ...props.targetProps,
          'data-fronts-vue-target': '',
          ref: remote.target,
        }),
        status,
      ]);
    };
  },
});
