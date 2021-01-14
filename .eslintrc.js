module.exports = {
  root: true,
  env: {
    node: true
  },
  parserOptions: {
    ecmaVersion: 2020
  },
  extends: [
    'digitalbazaar',
    'digitalbazaar/jsdoc'
  ],
  ignorePatterns: ['node_modules/']
};
