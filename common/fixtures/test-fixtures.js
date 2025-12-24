const playwrightTest = require('@playwright/test');
const ApiHelper = require('../helpers/api-helper');
const KafkaHelper = require('../helpers/kafka-helper');
const MongoHelper = require('../helpers/mongodb-helper');
const FileHelper = require('../helpers/file-helper');

const test = playwrightTest.test.extend({
  api: async ({ request }, use) => {
    const helper = new ApiHelper(request);
    await use(helper);
  },

  kafka: async ({}, use) => {
    const helper = new KafkaHelper();
    await helper.connect();
    await use(helper);
    await helper.disconnect();
  },

  mongo: async ({}, use) => {
    const helper = new MongoHelper();
    await helper.connect();
    await use(helper);
    await helper.disconnect();
  },

  file: async ({}, use) => {
    const helper = new FileHelper();
    await use(helper);
  },
});

module.exports = { test, expect: playwrightTest.expect };
