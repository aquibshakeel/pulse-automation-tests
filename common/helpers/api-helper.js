const logger = require('../utils/logger');

class ApiHelper {
  /**
   * Creates an instance of ApiHelper
   * @param {import('@playwright/test').APIRequestContext} requestContext - Playwright request context
   */
  constructor(requestContext) {
    this.request = requestContext;
  }

  async get(endpoint, options = {}) {
    try {
      logger.info(`GET ${endpoint}`, { queryParams: options.queryParams });
      
      const response = await this.request.get(endpoint, {
        headers: options.headers,
        params: options.queryParams,
      });

      const data = await this._parseResponse(response);
      
      logger.info(`GET ${endpoint} - Status: ${response.status()}`);
      
      return {
        status: response.status(),
        data,
        headers: response.headers(),
      };
    } catch (error) {
      logger.error(`GET ${endpoint} failed`, { error: error.message });
      throw error;
    }
  }

  async post(endpoint, body = {}, options = {}) {
    try {
      logger.info(`POST ${endpoint}`, { body });
      
      const response = await this.request.post(endpoint, {
        data: body,
        headers: options.headers,
      });

      const data = await this._parseResponse(response);
      
      logger.info(`POST ${endpoint} - Status: ${response.status()}`);
      
      return {
        status: response.status(),
        data,
        headers: response.headers(),
      };
    } catch (error) {
      logger.error(`POST ${endpoint} failed`, { error: error.message });
      throw error;
    }
  }

  async put(endpoint, body = {}, options = {}) {
    try {
      logger.info(`PUT ${endpoint}`, { body });
      
      const response = await this.request.put(endpoint, {
        data: body,
        headers: options.headers,
      });

      const data = await this._parseResponse(response);
      
      logger.info(`PUT ${endpoint} - Status: ${response.status()}`);
      
      return {
        status: response.status(),
        data,
        headers: response.headers(),
      };
    } catch (error) {
      logger.error(`PUT ${endpoint} failed`, { error: error.message });
      throw error;
    }
  }

  async delete(endpoint, options = {}) {
    try {
      logger.info(`DELETE ${endpoint}`);
      
      const response = await this.request.delete(endpoint, {
        headers: options.headers,
      });

      const data = await this._parseResponse(response);
      
      logger.info(`DELETE ${endpoint} - Status: ${response.status()}`);
      
      return {
        status: response.status(),
        data,
        headers: response.headers(),
      };
    } catch (error) {
      logger.error(`DELETE ${endpoint} failed`, { error: error.message });
      throw error;
    }
  }

  async _parseResponse(response) {
    const contentType = response.headers()['content-type'] || '';
    
    if (contentType.includes('application/json')) {
      try {
        return await response.json();
      } catch (error) {
        logger.warn('Failed to parse JSON response', { error: error.message });
        return await response.text();
      }
    }
    
    return await response.text();
  }
}

module.exports = ApiHelper;
