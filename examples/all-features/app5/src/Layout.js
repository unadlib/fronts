import { defineAsyncComponent, ref } from "vue";

const Button = defineAsyncComponent(() => import('app6/src/components/Button'));

export default {
  name: "Layout",
  components: {
    App6Button: Button,
  },
  setup() {
    const showButton = ref(true);
    const buttonText = ref("React button");
    const clickedCount = ref(0);
    const incrementCount = () => (clickedCount.value += 1);

    return { showButton, buttonText, clickedCount, incrementCount };
  },
  template: `
    <div class="layout-app">
      <div>
        <h2>Vue State/Input</h2>
        <div>
          <label>
            <span>Show button:</span>
            <input v-model="showButton" type="checkbox" />
          </label>
        </div>
        <div>
          <label>
            <span>Button text:</span>
            <input v-model="buttonText" type="text" />
          </label>
        </div>
        <div>
          <label>
            <span>Times button clicked: </span>
            <input disabled type="number" :value="clickedCount" />
          </label>
        </div>
      </div>
      <div>
        <h2>Button - loaded via Module Federation</h2>
        <app6-button />
      </div>
    </div>
  `,
};
