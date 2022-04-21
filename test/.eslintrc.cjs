module.exports = {
  globals: {
    should: true
  },
  env: {
    node: true,
    mocha: true
  },
  parserOptions: {
    // this is required for dynamic import()
    ecmaVersion: 2020
  },
  ignorePatterns: ['node_modules/']
};
