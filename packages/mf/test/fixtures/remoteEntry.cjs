/* global module */

const application = {
  name: 'runtime-integration-fixture',
  protocol: 'fronts.application',
  protocolVersion: 1,
  mount() {
    return {
      ready: Promise.resolve(),
      update() {},
      unmount() {},
    };
  },
};

module.exports = {
  async get(expose) {
    if (expose !== './application') {
      throw new Error(`Unknown fixture expose: ${expose}`);
    }
    return () => ({ default: application });
  },
  async init() {},
};
