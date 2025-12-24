require('dotenv').config();

const config = {
  env: process.env.TEST_ENV || 'local',
  apiBaseUrl: process.env.API_BASE_URL || 'http://localhost:3000',
  
  kafka: {
    brokers: process.env.KAFKA_BROKERS?.split(',') || ['localhost:9092'],
    clientId: process.env.KAFKA_CLIENT_ID || 'pulse-automation-tests',
    username: process.env.KAFKA_USERNAME,
    password: process.env.KAFKA_PASSWORD,
    ssl: process.env.KAFKA_SSL === 'true',
    connectionTimeout: 10000,
    requestTimeout: 30000,
  },
  
  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017',
    database: process.env.MONGODB_DATABASE || 'test_db',
    username: process.env.MONGODB_USERNAME,
    password: process.env.MONGODB_PASSWORD,
    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    },
  },
  
  sftp: {
    host: process.env.SFTP_HOST || 'localhost',
    port: parseInt(process.env.SFTP_PORT || '22', 10),
    username: process.env.SFTP_USERNAME || 'testuser',
    password: process.env.SFTP_PASSWORD,
    privateKeyPath: process.env.SFTP_PRIVATE_KEY_PATH,
  },
  
  s3: {
    region: process.env.AWS_REGION || 'us-east-1',
    bucket: process.env.S3_BUCKET || 'test-bucket',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
};

module.exports = config;
