const SftpClient = require('ssh2-sftp-client');
const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const fs = require('fs');
const path = require('path');
const config = require('../../config/environment.config');
const logger = require('../utils/logger');

class FileHelper {
  constructor() {
    this.sftpClient = null;
    this.s3Client = null;
  }

  async uploadFile(localPath, remotePath, storageType) {
    if (storageType === 'sftp') {
      return await this._uploadToSftp(localPath, remotePath);
    } else if (storageType === 's3') {
      return await this._uploadToS3(localPath, remotePath);
    } else {
      throw new Error(`Unsupported storage type: ${storageType}. Use 'sftp' or 's3'.`);
    }
  }

  /**
   * Download a file from SFTP or S3
   * @param {string} remotePath - Remote file path or S3 key
   * @param {string} localPath - Local file path to save
   * @param {string} storageType - Storage type ('sftp' or 's3')
   * @returns {Promise<void>}
   */
  async downloadFile(remotePath, localPath, storageType) {
    if (storageType === 'sftp') {
      return await this._downloadFromSftp(remotePath, localPath);
    } else if (storageType === 's3') {
      return await this._downloadFromS3(remotePath, localPath);
    } else {
      throw new Error(`Unsupported storage type: ${storageType}. Use 'sftp' or 's3'.`);
    }
  }

  /**
   * Upload file to SFTP
   * @private
   * @param {string} localPath - Local file path
   * @param {string} remotePath - Remote file path
   * @returns {Promise<void>}
   */
  async _uploadToSftp(localPath, remotePath) {
    this.sftpClient = new SftpClient();

    try {
      logger.info('Uploading file to SFTP', { localPath, remotePath });

      const connectionConfig = {
        host: config.sftp.host,
        port: config.sftp.port,
        username: config.sftp.username,
      };

      // Add authentication method
      if (config.sftp.privateKeyPath) {
        connectionConfig.privateKey = fs.readFileSync(config.sftp.privateKeyPath);
      } else if (config.sftp.password) {
        connectionConfig.password = config.sftp.password;
      } else {
        throw new Error('SFTP authentication credentials not configured');
      }

      await this.sftpClient.connect(connectionConfig);

      // Ensure remote directory exists
      const remoteDir = path.dirname(remotePath);
      await this.sftpClient.mkdir(remoteDir, true);

      // Upload file
      await this.sftpClient.put(localPath, remotePath);

      logger.info('File uploaded to SFTP successfully', { remotePath });
    } catch (error) {
      logger.error('Failed to upload file to SFTP', { error: error.message });
      throw error;
    } finally {
      if (this.sftpClient) {
        await this.sftpClient.end();
      }
    }
  }

  /**
   * Download file from SFTP
   * @private
   * @param {string} remotePath - Remote file path
   * @param {string} localPath - Local file path
   * @returns {Promise<void>}
   */
  async _downloadFromSftp(remotePath, localPath) {
    this.sftpClient = new SftpClient();

    try {
      logger.info('Downloading file from SFTP', { remotePath, localPath });

      const connectionConfig = {
        host: config.sftp.host,
        port: config.sftp.port,
        username: config.sftp.username,
      };

      // Add authentication method
      if (config.sftp.privateKeyPath) {
        connectionConfig.privateKey = fs.readFileSync(config.sftp.privateKeyPath);
      } else if (config.sftp.password) {
        connectionConfig.password = config.sftp.password;
      } else {
        throw new Error('SFTP authentication credentials not configured');
      }

      await this.sftpClient.connect(connectionConfig);

      // Ensure local directory exists
      const localDir = path.dirname(localPath);
      if (!fs.existsSync(localDir)) {
        fs.mkdirSync(localDir, { recursive: true });
      }

      // Download file
      await this.sftpClient.get(remotePath, localPath);

      logger.info('File downloaded from SFTP successfully', { localPath });
    } catch (error) {
      logger.error('Failed to download file from SFTP', { error: error.message });
      throw error;
    } finally {
      if (this.sftpClient) {
        await this.sftpClient.end();
      }
    }
  }

  /**
   * Upload file to S3
   * @private
   * @param {string} localPath - Local file path
   * @param {string} s3Key - S3 object key
   * @returns {Promise<void>}
   */
  async _uploadToS3(localPath, s3Key) {
    try {
      logger.info('Uploading file to S3', { localPath, s3Key, bucket: config.s3.bucket });

      this._initializeS3Client();

      const fileStream = fs.createReadStream(localPath);
      const uploadParams = {
        Bucket: config.s3.bucket,
        Key: s3Key,
        Body: fileStream,
      };

      const command = new PutObjectCommand(uploadParams);
      await this.s3Client.send(command);

      logger.info('File uploaded to S3 successfully', { s3Key });
    } catch (error) {
      logger.error('Failed to upload file to S3', { error: error.message });
      throw error;
    }
  }

  /**
   * Download file from S3
   * @private
   * @param {string} s3Key - S3 object key
   * @param {string} localPath - Local file path
   * @returns {Promise<void>}
   */
  async _downloadFromS3(s3Key, localPath) {
    try {
      logger.info('Downloading file from S3', { s3Key, localPath, bucket: config.s3.bucket });

      this._initializeS3Client();

      const downloadParams = {
        Bucket: config.s3.bucket,
        Key: s3Key,
      };

      const command = new GetObjectCommand(downloadParams);
      const response = await this.s3Client.send(command);

      // Ensure local directory exists
      const localDir = path.dirname(localPath);
      if (!fs.existsSync(localDir)) {
        fs.mkdirSync(localDir, { recursive: true });
      }

      // Write file to disk
      const writeStream = fs.createWriteStream(localPath);
      response.Body.pipe(writeStream);

      return new Promise((resolve, reject) => {
        writeStream.on('finish', () => {
          logger.info('File downloaded from S3 successfully', { localPath });
          resolve();
        });
        writeStream.on('error', reject);
      });
    } catch (error) {
      logger.error('Failed to download file from S3', { error: error.message });
      throw error;
    }
  }

  /**
   * Initialize S3 client
   * @private
   */
  _initializeS3Client() {
    if (!this.s3Client) {
      const s3Config = {
        region: config.s3.region,
      };

      if (config.s3.accessKeyId && config.s3.secretAccessKey) {
        s3Config.credentials = {
          accessKeyId: config.s3.accessKeyId,
          secretAccessKey: config.s3.secretAccessKey,
        };
      }

      this.s3Client = new S3Client(s3Config);
    }
  }

  /**
   * List files in SFTP directory
   * @param {string} remotePath - Remote directory path
   * @returns {Promise<Array<Object>>} List of files
   * 
   * @example
   * const files = await fileHelper.listSftpFiles('/data/exports');
   */
  async listSftpFiles(remotePath) {
    this.sftpClient = new SftpClient();

    try {
      logger.info('Listing SFTP directory', { remotePath });

      const connectionConfig = {
        host: config.sftp.host,
        port: config.sftp.port,
        username: config.sftp.username,
      };

      if (config.sftp.privateKeyPath) {
        connectionConfig.privateKey = fs.readFileSync(config.sftp.privateKeyPath);
      } else if (config.sftp.password) {
        connectionConfig.password = config.sftp.password;
      }

      await this.sftpClient.connect(connectionConfig);
      const fileList = await this.sftpClient.list(remotePath);

      logger.info(`Found ${fileList.length} files in SFTP directory`, { remotePath });
      return fileList;
    } catch (error) {
      logger.error('Failed to list SFTP directory', { error: error.message });
      throw error;
    } finally {
      if (this.sftpClient) {
        await this.sftpClient.end();
      }
    }
  }
}

module.exports = FileHelper;
