import { createApp, defineAsyncComponent } from 'vue';
import { boot } from 'fronts';
import Layout from './Layout.vue';

const Content = defineAsyncComponent(() =>
  import('app6/src/components/Content')
);
const Button = defineAsyncComponent(() => import('app6/src/components/Button'));

export default function render(element) {
  const app = createApp(Layout);
  app.component('content-element', Content);
  app.component('button-element', Button);
  app.mount(element);
  return () => {
    app.unmount(element);
  };
}

boot(render, document.getElementById('app'));
