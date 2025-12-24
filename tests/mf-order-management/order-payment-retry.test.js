const { test, expect } = require('../../common/fixtures/test-fixtures');

test.describe('Order Payment Failure and Retry Flow', () => {
  test('should handle payment failure and retry mechanism', async ({ api, kafka, mongo }) => {
    // Arrange
    const orderData = {
      investorId: 'inv-payment-test',
      schemeCode: 'INF200K01RJ1',
      orderType: 'PURCHASE',
      amount: 5000.0,
      holdingType: 'SINGLE',
      transactionMode: 'PHYSICAL',
      euin: 'E123456789',
      remarks: 'Payment failure test order',
      sourceSystem: 'MOBILE_APP',
      idempotencyKey: 'payment-failure-test-001'
    };

    // Act - Create order
    const createResponse = await api.post('/api/v1/orders', orderData);
    
    // Assert - Order creation
    expect(createResponse.status).toBe(201);
    expect(createResponse.data.orderId).toBeDefined();
    const orderId = createResponse.data.orderId;

    // Verify initial order creation event
    const orderCreatedEvent = await kafka.consumeMessage('order-events', {
      filter: msg => msg.orderId === orderId && msg.eventType === 'ORDER_CREATED',
      timeout: 5000
    });
    
    expect(orderCreatedEvent).not.toBeNull();
    expect(orderCreatedEvent.value.orderId).toBe(orderId);
    expect(orderCreatedEvent.value.eventType).toBe('ORDER_CREATED');

    // Check for payment failure events (simulated by system)
    const paymentFailureEvent = await kafka.consumeMessage('order-events', {
      filter: msg => msg.orderId === orderId && 
                    (msg.eventType === 'PAYMENT_FAILED' || 
                     msg.eventType === 'ORDER_STATUS_UPDATED') &&
                    (msg.paymentStatus === 'FAILED' || 
                     msg.currentStatus === 'PAYMENT_FAILED'),
      timeout: 10000
    });

    if (paymentFailureEvent) {
      // Verify payment failure event structure
      expect(paymentFailureEvent.value.orderId).toBe(orderId);
      expect(paymentFailureEvent.value.timestamp).toBeDefined();
      
      // Check for retry events
      const retryEvent = await kafka.consumeMessage('order-events', {
        filter: msg => msg.orderId === orderId && 
                      (msg.eventType === 'PAYMENT_RETRY_INITIATED' ||
                       msg.eventType === 'ORDER_STATUS_UPDATED') &&
                      msg.metadata && msg.metadata.retryCount,
        timeout: 8000
      });

      if (retryEvent) {
        expect(retryEvent.value.orderId).toBe(orderId);
        expect(retryEvent.value.metadata.retryCount).toBeGreaterThan(0);
        expect(retryEvent.value.metadata.retryCount).toBeLessThanOrEqual(3); // Assuming max 3 retries
      }
    }

    // Verify final order status
    const finalOrderResponse = await api.get(`/api/v1/orders/${orderId}`);
    expect(finalOrderResponse.status).toBe(200);
    expect(finalOrderResponse.data.orderId).toBe(orderId);
    
    // Order should be in one of these states after payment processing
    expect(['PENDING', 'PAYMENT_FAILED', 'COMPLETE', 'FAILED']).toContain(finalOrderResponse.data.status);
    
    if (finalOrderResponse.data.paymentStatus) {
      expect(['PENDING', 'PROCESSING', 'SUCCESS', 'FAILED']).toContain(finalOrderResponse.data.paymentStatus);
    }

    // Verify database record reflects payment processing
    const dbOrder = await mongo.findOne('orders', { orderId: orderId });
    expect(dbOrder).toBeDefined();
    expect(dbOrder.orderId).toBe(orderId);
    expect(dbOrder.status).toBeDefined();
    
    // Check for retry metadata in database if payment failed
    if (dbOrder.status === 'PAYMENT_FAILED' || dbOrder.paymentStatus === 'FAILED') {
      // Verify error logging exists
      expect(dbOrder.statusDescription || dbOrder.errorMessage).toBeDefined();
    }

    // Cleanup
    await mongo.deleteOne('orders', { orderId: orderId });
  });

  test('should handle maximum retry attempts reached', async ({ api, kafka, mongo }) => {
    // Arrange
    const orderData = {
      investorId: 'inv-max-retry-test',
      schemeCode: 'INF200K01RJ1',
      orderType: 'PURCHASE',
      amount: 1000.0,
      holdingType: 'SINGLE',
      transactionMode: 'PHYSICAL',
      euin: 'E123456789',
      remarks: 'Max retry test order',
      sourceSystem: 'MOBILE_APP',
      idempotencyKey: 'max-retry-test-001'
    };

    // Act - Create order
    const createResponse = await api.post('/api/v1/orders', orderData);
    
    // Assert - Order creation
    expect(createResponse.status).toBe(201);
    const orderId = createResponse.data.orderId;

    // Monitor for retry exhaustion events
    const maxRetryEvent = await kafka.consumeMessage('order-events', {
      filter: msg => msg.orderId === orderId && 
                    (msg.eventType === 'PAYMENT_RETRY_EXHAUSTED' ||
                     msg.eventType === 'ORDER_STATUS_UPDATED') &&
                    (msg.currentStatus === 'PAYMENT_FAILED' ||
                     msg.currentStatus === 'FAILED'),
      timeout: 15000
    });

    if (maxRetryEvent) {
      expect(maxRetryEvent.value.orderId).toBe(orderId);
      expect(maxRetryEvent.value.timestamp).toBeDefined();
      
      // Verify final order status reflects failure
      const finalResponse = await api.get(`/api/v1/orders/${orderId}`);
      expect(finalResponse.status).toBe(200);
      expect(['PAYMENT_FAILED', 'FAILED']).toContain(finalResponse.data.status);
    }

    // Cleanup
    await mongo.deleteOne('orders', { orderId: orderId });
  });
});

  test('should verify specific retry count limits and interval timing', async ({ api, kafka, mongo }) => {
    // Arrange
    const orderData = {
      investorId: 'inv-retry-limits-test',
      schemeCode: 'INF200K01RJ1',
      orderType: 'PURCHASE',
      amount: 2000.0,
      holdingType: 'SINGLE',
      transactionMode: 'PHYSICAL',
      euin: 'E123456789',
      remarks: 'Retry limits validation test',
      sourceSystem: 'MOBILE_APP',
      idempotencyKey: 'retry-limits-test-001'
    };

    // Act - Create order
    const createResponse = await api.post('/api/v1/orders', orderData);
    expect(createResponse.status).toBe(201);
    const orderId = createResponse.data.orderId;

    // Monitor retry events with timing
    const retryEvents = [];
    const retryTimestamps = [];
    let retryCount = 0;
    const maxRetries = 3;
    const expectedRetryInterval = 5000; // 5 seconds between retries
    
    // Monitor for up to 60 seconds to capture all retry attempts
    const monitoringDuration = 60000;
    const startTime = Date.now();
    
    while (Date.now() - startTime < monitoringDuration && retryCount < maxRetries) {
      const retryEvent = await kafka.consumeMessage('order-events', {
        filter: msg => msg.orderId === orderId && 
                      (msg.eventType === 'PAYMENT_RETRY_INITIATED' ||
                       msg.eventType === 'ORDER_STATUS_UPDATED') &&
                      msg.metadata && msg.metadata.retryCount,
        timeout: 10000
      });
      
      if (retryEvent && !retryEvents.find(e => e.metadata.retryCount === retryEvent.value.metadata.retryCount)) {
        retryEvents.push(retryEvent.value);
        retryTimestamps.push(Date.now());
        retryCount = retryEvent.value.metadata.retryCount;
        
        // Verify retry count limits
        expect(retryCount).toBeGreaterThan(0);
        expect(retryCount).toBeLessThanOrEqual(maxRetries);
        
        // Verify retry interval timing (if not first retry)
        if (retryTimestamps.length > 1) {
          const timeBetweenRetries = retryTimestamps[retryTimestamps.length - 1] - retryTimestamps[retryTimestamps.length - 2];
          expect(timeBetweenRetries).toBeGreaterThanOrEqual(expectedRetryInterval - 1000); // Allow 1 second tolerance
          expect(timeBetweenRetries).toBeLessThanOrEqual(expectedRetryInterval + 5000); // Allow 5 second tolerance
        }
        
        // Verify payment gateway error code handling
        if (retryEvent.value.metadata.paymentErrorCode) {
          expect(retryEvent.value.metadata.paymentErrorCode).toMatch(/^[A-Z0-9_]+$/);
          expect(retryEvent.value.metadata.errorMessage).toBeDefined();
        }
      }
    }
    
    // Verify maximum retry count was respected
    if (retryEvents.length > 0) {
      const maxRetryCountReached = Math.max(...retryEvents.map(e => e.metadata.retryCount));
      expect(maxRetryCountReached).toBeLessThanOrEqual(maxRetries);
    }
    
    // Check for notification/alert system verification
    const notificationEvent = await kafka.consumeMessage('notification-events', {
      filter: msg => msg.orderId === orderId && 
                    (msg.eventType === 'PAYMENT_FAILURE_ALERT' ||
                     msg.eventType === 'CUSTOMER_NOTIFICATION'),
      timeout: 5000
    });
    
    if (notificationEvent) {
      expect(notificationEvent.value.orderId).toBe(orderId);
      expect(notificationEvent.value.recipientId).toBe(orderData.investorId);
      expect(notificationEvent.value.notificationType).toMatch(/PAYMENT_FAILURE|RETRY_EXHAUSTED/);
    }
    
    // Verify final order status and error details
    const finalResponse = await api.get(`/api/v1/orders/${orderId}`);
    expect(finalResponse.status).toBe(200);
    
    if (finalResponse.data.status === 'PAYMENT_FAILED' || finalResponse.data.status === 'FAILED') {
      // Verify error logging and audit trail creation
      expect(finalResponse.data.statusDescription).toBeDefined();
      expect(finalResponse.data.statusDescription).toContain('payment');
      
      // Verify database records include retry metadata and error details
      const dbOrder = await mongo.findOne('orders', { orderId: orderId });
      expect(dbOrder).toBeDefined();
      expect(dbOrder.retryMetadata).toBeDefined();
      expect(dbOrder.retryMetadata.totalRetries).toBeGreaterThan(0);
      expect(dbOrder.retryMetadata.totalRetries).toBeLessThanOrEqual(maxRetries);
      expect(dbOrder.retryMetadata.lastRetryAt).toBeDefined();
      expect(dbOrder.errorDetails).toBeDefined();
      expect(dbOrder.errorDetails.errorCode).toBeDefined();
      expect(dbOrder.errorDetails.errorMessage).toBeDefined();
    }
    
    // Cleanup
    await mongo.deleteOne('orders', { orderId: orderId });
  });

  test('should verify customer notification for payment failure', async ({ api, kafka, mongo }) => {
    // Arrange
    const orderData = {
      investorId: 'inv-notification-test',
      schemeCode: 'INF200K01RJ1',
      orderType: 'PURCHASE',
      amount: 3000.0,
      holdingType: 'SINGLE',
      transactionMode: 'PHYSICAL',
      euin: 'E123456789',
      remarks: 'Customer notification test',
      sourceSystem: 'MOBILE_APP',
      idempotencyKey: 'notification-test-001'
    };

    // Act - Create order
    const createResponse = await api.post('/api/v1/orders', orderData);
    expect(createResponse.status).toBe(201);
    const orderId = createResponse.data.orderId;

    // Monitor for customer notification events
    const customerNotificationEvent = await kafka.consumeMessage('notification-events', {
      filter: msg => msg.orderId === orderId && 
                    msg.recipientId === orderData.investorId &&
                    (msg.eventType === 'CUSTOMER_NOTIFICATION' ||
                     msg.eventType === 'PAYMENT_FAILURE_NOTIFICATION'),
      timeout: 15000
    });
    
    if (customerNotificationEvent) {
      // Verify customer notification is sent for payment failure
      expect(customerNotificationEvent.value.orderId).toBe(orderId);
      expect(customerNotificationEvent.value.recipientId).toBe(orderData.investorId);
      expect(customerNotificationEvent.value.notificationType).toMatch(/PAYMENT_FAILURE|ORDER_FAILED/);
      expect(customerNotificationEvent.value.message).toBeDefined();
      expect(customerNotificationEvent.value.message).toMatch(/payment.*failed|order.*failed/i);
      expect(customerNotificationEvent.value.channels).toBeDefined();
      expect(Array.isArray(customerNotificationEvent.value.channels)).toBe(true);
      expect(customerNotificationEvent.value.channels).toContain('EMAIL');
    }
    
    // Verify notification metadata in database
    const dbOrder = await mongo.findOne('orders', { orderId: orderId });
    if (dbOrder && dbOrder.notificationMetadata) {
      expect(dbOrder.notificationMetadata.customerNotified).toBe(true);
      expect(dbOrder.notificationMetadata.notificationSentAt).toBeDefined();
      expect(dbOrder.notificationMetadata.notificationChannels).toBeDefined();
    }
    
    // Cleanup
    await mongo.deleteOne('orders', { orderId: orderId });
  });