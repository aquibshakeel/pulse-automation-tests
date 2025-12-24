const { Kafka, logLevel } = require('kafkajs');
const config = require('../../config/environment.config');
const logger = require('../utils/logger');

class KafkaHelper {

  constructor(customConfig = {}) {
    const kafkaConfig = {
      clientId: config.kafka.clientId,
      brokers: config.kafka.brokers,
      connectionTimeout: config.kafka.connectionTimeout,
      requestTimeout: config.kafka.requestTimeout,
      logLevel: logLevel.ERROR,
      ...customConfig,
    };

    // Add SASL authentication if credentials provided
    if (config.kafka.username && config.kafka.password) {
      kafkaConfig.sasl = {
        mechanism: 'plain',
        username: config.kafka.username,
        password: config.kafka.password,
      };
    }

    // Add SSL configuration if enabled
    if (config.kafka.ssl) {
      kafkaConfig.ssl = true;
    }

    this.kafka = new Kafka(kafkaConfig);
    this.producer = null;
    this.consumer = null;
    this.isConnected = false;
  }

  async connect() {
    try {
      logger.info('Connecting to Kafka...');
      
      this.producer = this.kafka.producer();
      await this.producer.connect();
      
      this.consumer = this.kafka.consumer({ 
        groupId: `${config.kafka.clientId}-consumer-${Date.now()}` 
      });
      await this.consumer.connect();
      
      this.isConnected = true;
      logger.info('Connected to Kafka successfully');
    } catch (error) {
      logger.error('Failed to connect to Kafka', { error: error.message });
      throw error;
    }
  }

  async disconnect() {
    try {
      if (this.producer) {
        await this.producer.disconnect();
      }
      if (this.consumer) {
        await this.consumer.disconnect();
      }
      this.isConnected = false;
      logger.info('Disconnected from Kafka');
    } catch (error) {
      logger.error('Error disconnecting from Kafka', { error: error.message });
      throw error;
    }
  }

  async produceMessage(topic, message, key = null) {
    if (!this.isConnected) {
      throw new Error('Kafka is not connected. Call connect() first.');
    }

    try {
      logger.info(`Producing message to topic: ${topic}`, { key, message });
      
      await this.producer.send({
        topic,
        messages: [
          {
            key: key ? String(key) : null,
            value: JSON.stringify(message),
          },
        ],
      });
      
      logger.info(`Message produced successfully to topic: ${topic}`);
    } catch (error) {
      logger.error(`Failed to produce message to topic: ${topic}`, { error: error.message });
      throw error;
    }
  }

  async consumeMessage(topic, options = {}) {
    if (!this.isConnected) {
      throw new Error('Kafka is not connected. Call connect() first.');
    }

    const {
      filter = null,
      timeout = 10000,
      fromBeginning = true,
    } = options;

    try {
      logger.info(`Consuming message from topic: ${topic}`, { timeout, fromBeginning });

      await this.consumer.subscribe({ topic, fromBeginning });

      return await new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          logger.warn(`Timeout waiting for message from topic: ${topic}`);
          resolve(null);
        }, timeout);

        this.consumer.run({
          eachMessage: async ({ topic: msgTopic, partition, message }) => {
            try {
              const value = JSON.parse(message.value.toString());
              
              logger.info(`Received message from topic: ${msgTopic}`, {
                partition,
                offset: message.offset,
                value,
              });

              // Apply filter if provided
              if (!filter || filter(value)) {
                clearTimeout(timeoutId);
                await this.consumer.stop();
                resolve({
                  topic: msgTopic,
                  partition,
                  offset: message.offset,
                  key: message.key ? message.key.toString() : null,
                  value,
                  timestamp: message.timestamp,
                });
              }
            } catch (error) {
              clearTimeout(timeoutId);
              await this.consumer.stop();
              reject(error);
            }
          },
        });
      });
    } catch (error) {
      logger.error(`Failed to consume message from topic: ${topic}`, { error: error.message });
      throw error;
    }
  }

  async consumeMessages(topic, options = {}) {
    if (!this.isConnected) {
      throw new Error('Kafka is not connected. Call connect() first.');
    }

    const {
      maxMessages = 10,
      timeout = 10000,
      filter = null,
      fromBeginning = true,
    } = options;

    try {
      logger.info(`Consuming up to ${maxMessages} messages from topic: ${topic}`);

      await this.consumer.subscribe({ topic, fromBeginning });

      const messages = [];

      return await new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          logger.info(`Timeout reached. Consumed ${messages.length} messages`);
          resolve(messages);
        }, timeout);

        this.consumer.run({
          eachMessage: async ({ topic: msgTopic, partition, message }) => {
            try {
              const value = JSON.parse(message.value.toString());

              if (!filter || filter(value)) {
                messages.push({
                  topic: msgTopic,
                  partition,
                  offset: message.offset,
                  key: message.key ? message.key.toString() : null,
                  value,
                  timestamp: message.timestamp,
                });

                if (messages.length >= maxMessages) {
                  clearTimeout(timeoutId);
                  await this.consumer.stop();
                  resolve(messages);
                }
              }
            } catch (error) {
              clearTimeout(timeoutId);
              await this.consumer.stop();
              reject(error);
            }
          },
        });
      });
    } catch (error) {
      logger.error(`Failed to consume messages from topic: ${topic}`, { error: error.message });
      throw error;
    }
  }
}

module.exports = KafkaHelper;
