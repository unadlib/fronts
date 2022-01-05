import { boot } from 'fronts';
import { createApp } from 'vue';
import Layout from './Layout';

const App = {
  components: {
    layout: Layout,
  },
  template: `
    <h1>Vue</h1>
    <div class="app">
      <layout />
    </div>
  `,
};

export default function render(element) {
  const app = createApp(App);
  app.mount(element);
  return () => {
    app.unmount(element);
  };
}

boot(render, document.getElementById('app'));
