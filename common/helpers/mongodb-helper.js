const { MongoClient } = require('mongodb');
const config = require('../../config/environment.config');
const logger = require('../utils/logger');

class MongoHelper {
  constructor(customConfig = {}) {
    this.uri = customConfig.uri || config.mongodb.uri;
    this.dbName = customConfig.database || config.mongodb.database;
    this.client = null;
    this.db = null;
    this.isConnected = false;
  }

  async connect() {
    try {
      logger.info('Connecting to MongoDB...', { uri: this.uri, database: this.dbName });
      
      this.client = new MongoClient(this.uri, config.mongodb.options);
      await this.client.connect();
      this.db = this.client.db(this.dbName);
      this.isConnected = true;
      
      logger.info('Connected to MongoDB successfully');
    } catch (error) {
      logger.error('Failed to connect to MongoDB', { error: error.message });
      throw error;
    }
  }

  async disconnect() {
    try {
      if (this.client) {
        await this.client.close();
        this.isConnected = false;
        logger.info('Disconnected from MongoDB');
      }
    } catch (error) {
      logger.error('Error disconnecting from MongoDB', { error: error.message });
      throw error;
    }
  }
  
  async query(collection, filter = {}, options = {}) {
    this._ensureConnected();

    try {
      logger.info(`Querying collection: ${collection}`, { filter, options });
      
      const cursor = this.db.collection(collection).find(filter, {
        projection: options.projection,
      });

      if (options.sort) {
        cursor.sort(options.sort);
      }
      if (options.skip) {
        cursor.skip(options.skip);
      }
      if (options.limit) {
        cursor.limit(options.limit);
      }

      const results = await cursor.toArray();
      
      logger.info(`Query returned ${results.length} documents from ${collection}`);
      return results;
    } catch (error) {
      logger.error(`Failed to query collection: ${collection}`, { error: error.message });
      throw error;
    }
  }

  /**
   * Find a single document
   * @param {string} collection - Collection name
   * @param {Object} filter - Query filter
   * @param {Object} options - Query options
   * @returns {Promise<Object|null>} Document or null if not found
   * 
   * @example
   * const user = await mongoHelper.findOne('users', { email: 'john@test.com' });
   */
  async findOne(collection, filter = {}, options = {}) {
    this._ensureConnected();

    try {
      logger.info(`Finding one document in collection: ${collection}`, { filter });
      
      const result = await this.db.collection(collection).findOne(filter, options);
      
      logger.info(`Document ${result ? 'found' : 'not found'} in ${collection}`);
      return result;
    } catch (error) {
      logger.error(`Failed to find document in collection: ${collection}`, { 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Insert a single document or multiple documents
   * @param {string} collection - Collection name
   * @param {Object|Array<Object>} documents - Document(s) to insert
   * @returns {Promise<Object>} Insert result with insertedId(s)
   * 
   * @example
   * // Insert single document
   * const result = await mongoHelper.insert('users', {
   *   name: 'John Doe',
   *   email: 'john@test.com'
   * });
   * console.log(result.insertedId);
   * 
   * @example
   * // Insert multiple documents
   * const result = await mongoHelper.insert('users', [
   *   { name: 'John', email: 'john@test.com' },
   *   { name: 'Jane', email: 'jane@test.com' }
   * ]);
   * console.log(result.insertedIds);
   */
  async insert(collection, documents) {
    this._ensureConnected();

    try {
      const isArray = Array.isArray(documents);
      logger.info(`Inserting ${isArray ? 'multiple' : 'single'} document(s) into: ${collection}`);
      
      let result;
      if (isArray) {
        result = await this.db.collection(collection).insertMany(documents);
        logger.info(`Inserted ${result.insertedCount} documents into ${collection}`);
      } else {
        result = await this.db.collection(collection).insertOne(documents);
        logger.info(`Inserted document into ${collection}`, { insertedId: result.insertedId });
      }
      
      return result;
    } catch (error) {
      logger.error(`Failed to insert into collection: ${collection}`, { error: error.message });
      throw error;
    }
  }

  /**
   * Update documents in a collection
   * @param {string} collection - Collection name
   * @param {Object} filter - Filter to match documents
   * @param {Object} update - Update operations
   * @param {Object} options - Update options
   * @param {boolean} [options.upsert=false] - Create if not exists
   * @param {boolean} [options.multiple=false] - Update multiple documents
   * @returns {Promise<Object>} Update result
   * 
   * @example
   * // Update single document
   * const result = await mongoHelper.update(
   *   'users',
   *   { email: 'john@test.com' },
   *   { $set: { status: 'inactive' } }
   * );
   * 
   * @example
   * // Update multiple documents
   * const result = await mongoHelper.update(
   *   'users',
   *   { status: 'pending' },
   *   { $set: { status: 'active' } },
   *   { multiple: true }
   * );
   * 
   * @example
   * // Upsert (create if not exists)
   * const result = await mongoHelper.update(
   *   'users',
   *   { email: 'new@test.com' },
   *   { $set: { name: 'New User' } },
   *   { upsert: true }
   * );
   */
  async update(collection, filter, update, options = {}) {
    this._ensureConnected();

    try {
      const { upsert = false, multiple = false } = options;
      
      logger.info(`Updating document(s) in collection: ${collection}`, { 
        filter, 
        update, 
        upsert, 
        multiple 
      });
      
      let result;
      if (multiple) {
        result = await this.db.collection(collection).updateMany(filter, update, { upsert });
        logger.info(`Updated ${result.modifiedCount} documents in ${collection}`);
      } else {
        result = await this.db.collection(collection).updateOne(filter, update, { upsert });
        logger.info(`Updated document in ${collection}`, { modifiedCount: result.modifiedCount });
      }
      
      return result;
    } catch (error) {
      logger.error(`Failed to update collection: ${collection}`, { error: error.message });
      throw error;
    }
  }

  /**
   * Delete documents from a collection
   * @param {string} collection - Collection name
   * @param {Object} filter - Filter to match documents
   * @param {Object} options - Delete options
   * @param {boolean} [options.multiple=false] - Delete multiple documents
   * @returns {Promise<Object>} Delete result
   * 
   * @example
   * // Delete single document
   * const result = await mongoHelper.delete('users', { email: 'john@test.com' });
   * 
   * @example
   * // Delete multiple documents
   * const result = await mongoHelper.delete(
   *   'users',
   *   { status: 'inactive' },
   *   { multiple: true }
   * );
   */
  async delete(collection, filter, options = {}) {
    this._ensureConnected();

    try {
      const { multiple = false } = options;
      
      logger.info(`Deleting document(s) from collection: ${collection}`, { filter, multiple });
      
      let result;
      if (multiple) {
        result = await this.db.collection(collection).deleteMany(filter);
        logger.info(`Deleted ${result.deletedCount} documents from ${collection}`);
      } else {
        result = await this.db.collection(collection).deleteOne(filter);
        logger.info(`Deleted document from ${collection}`, { deletedCount: result.deletedCount });
      }
      
      return result;
    } catch (error) {
      logger.error(`Failed to delete from collection: ${collection}`, { error: error.message });
      throw error;
    }
  }

  /**
   * Count documents in a collection
   * @param {string} collection - Collection name
   * @param {Object} filter - Query filter
   * @returns {Promise<number>} Document count
   * 
   * @example
   * const count = await mongoHelper.count('users', { status: 'active' });
   */
  async count(collection, filter = {}) {
    this._ensureConnected();

    try {
      logger.info(`Counting documents in collection: ${collection}`, { filter });
      
      const count = await this.db.collection(collection).countDocuments(filter);
      
      logger.info(`Count result for ${collection}: ${count}`);
      return count;
    } catch (error) {
      logger.error(`Failed to count documents in collection: ${collection}`, { 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Ensure MongoDB is connected
   * @private
   * @throws {Error} If not connected
   */
  _ensureConnected() {
    if (!this.isConnected) {
      throw new Error('MongoDB is not connected. Call connect() first.');
    }
  }
}

module.exports = MongoHelper;
