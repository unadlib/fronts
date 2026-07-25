import { createApp, h } from 'vue';

import './styles.css';

createApp({
  render: () =>
    h('main', { class: 'producer-page' }, [
      h('p', { class: 'eyebrow' }, 'Fronts 1.0 producer'),
      h('h1', 'Vue 3 account remote'),
      h('p', 'The remote exposes a Fronts application through Module Federation.'),
    ]),
}).mount('#root');
