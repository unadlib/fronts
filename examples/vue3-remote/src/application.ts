import { defineComponent, h } from 'vue';

import { defineVueApp, useHostServices } from '@fronts/vue3';

export interface AccountProps {
  readonly accountId: string;
}

export interface AccountServices {
  readonly telemetry: { emit(name: string, data?: unknown): void };
}

const Account = defineComponent({
  name: 'AccountRemote',
  props: {
    accountId: { type: String, required: true },
  },
  setup(props) {
    const services = useHostServices<AccountServices>();
    return () =>
      h('article', { style: accountCardStyle }, [
        h('p', { style: eyebrowStyle }, 'Vue 3 · Module Federation · Shadow DOM'),
        h('h2', `Account ${props.accountId}`),
        h('p', 'This Vue tree follows the same framework-neutral application ABI.'),
        h(
          'button',
          {
            onClick: () =>
              services.telemetry.emit('account.opened', { accountId: props.accountId }),
            style: buttonStyle,
            type: 'button',
          },
          'Record telemetry',
        ),
      ]);
  },
});

const accountCardStyle = {
  background: '#eafbf4',
  border: '1px solid #9bd8c2',
  borderRadius: '1rem',
  color: '#183029',
  fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
  padding: '1.5rem',
};

const eyebrowStyle = {
  color: '#197456',
  fontSize: '0.75rem',
  fontWeight: '700',
  letterSpacing: '0.08em',
  textTransform: 'uppercase' as const,
};

const buttonStyle = {
  background: '#197456',
  border: '0',
  borderRadius: '0.5rem',
  color: 'white',
  cursor: 'pointer',
  padding: '0.65rem 0.9rem',
};

export default defineVueApp<AccountProps, AccountServices>({
  capabilities: ['telemetry'],
  name: 'vue-account',
  root: Account,
});
