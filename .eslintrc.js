module.exports = {
  env: {
    browser: true,
    es2021: true,
    node: true,
  },
  extends: [
    'eslint:recommended',
    'plugin:playwright/recommended',
    'prettier',
  ],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  plugins: ['playwright'],
  rules: {
    // Enforce using helpers instead of direct library imports
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            group: ['axios', 'node-fetch', 'got'],
            message: 'Use ApiHelper from common/helpers/api-helper.js instead',
          },
          {
            group: ['kafkajs'],
            message: 'Use KafkaHelper from common/helpers/kafka-helper.js instead',
          },
          {
            group: ['mongodb'],
            message: 'Use MongoHelper from common/helpers/mongodb-helper.js instead',
          },
          {
            group: ['ssh2-sftp*', '@aws-sdk/*'],
            message: 'Use FileHelper from common/helpers/file-helper.js instead',
          },
        ],
      },
    ],
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
  },
  overrides: [
    {
      // Allow direct imports in helper files themselves
      files: ['common/helpers/*.js'],
      rules: {
        'no-restricted-imports': 'off',
      },
    },
  ],
};
