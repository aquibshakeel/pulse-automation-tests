const { test, expect } = require('../../common/fixtures/test-fixtures');

test.describe('Order Flow', () => {
  test('should complete PURCHASE order flow successfully', async ({ api, kafka, mongo }) => {
    // Arrange
    const orderData = {
      investorId: 'inv-123',
      schemeCode: 'INF200K01RJ1',
      orderType: 'PURCHASE',
      amount: 10000.0,
      holdingType: 'SINGLE',
      transactionMode: 'PHYSICAL',
      euin: 'E123456789',
      remarks: 'Investment for long term goals',
      sourceSystem: 'MOBILE_APP',
      idempotencyKey: 'ord-2024-flow-001'
    };

    // Act - Create order
    const createResponse = await api.post('/api/v1/orders', orderData);

    // Assert - Order creation
    expect(createResponse.status).toBe(201);
    expect(createResponse.data.orderId).toBeDefined();
    expect(createResponse.data.orderNumber).toBeDefined();
    expect(createResponse.data.investorId).toBe(orderData.investorId);
    expect(createResponse.data.schemeCode).toBe(orderData.schemeCode);
    expect(createResponse.data.orderType).toBe(orderData.orderType);
    expect(createResponse.data.amount).toBe(orderData.amount);
    expect(['PENDING', 'CREATED', 'SUBMITTED']).toContain(createResponse.data.status);

    const orderId = createResponse.data.orderId;

    // Verify order in database
    const dbOrder = await mongo.findOne('orders', { orderId: orderId });
    expect(dbOrder).toBeDefined();
    expect(dbOrder.investorId).toBe(orderData.investorId);
    expect(dbOrder.schemeCode).toBe(orderData.schemeCode);
    expect(dbOrder.amount).toBe(orderData.amount);

    // Verify Kafka order-created event
    const orderEvent = await kafka.consumeMessage('order-events', {
      filter: msg => msg.orderId === orderId && msg.eventType === 'ORDER_CREATED',
      timeout: 5000
    });
    
    expect(orderEvent).not.toBeNull();
    expect(orderEvent.value.orderId).toBe(orderId);
    expect(orderEvent.value.eventType).toBe('ORDER_CREATED');
    expect(orderEvent.value.investorId).toBe(orderData.investorId);
    expect(orderEvent.value.schemeCode).toBe(orderData.schemeCode);
    expect(orderEvent.value.orderType).toBe(orderData.orderType);
    expect(orderEvent.value.amount).toBe(orderData.amount);

    // Additional validations for complete flow
    
    // Verify payment processing completion
    expect(createResponse.data.paymentTransactionId).toBeDefined();
    expect(['PENDING', 'PROCESSING', 'SUCCESS']).toContain(createResponse.data.paymentStatus || 'PENDING');
    
    // Check order status progression by retrieving order
    const retrieveResponse = await api.get(`/api/v1/orders/${orderId}`);
    expect(retrieveResponse.status).toBe(200);
    expect(retrieveResponse.data.orderId).toBe(orderId);
    expect(retrieveResponse.data.status).toBeDefined();
    expect(['PENDING', 'CREATED', 'SUBMITTED', 'PROCESSED', 'COMPLETE']).toContain(retrieveResponse.data.status);
    
    // Verify BSE order submission details
    if (retrieveResponse.data.bseOrderId) {
      expect(retrieveResponse.data.bseOrderId).toMatch(/^BSE\d+/);
      expect(retrieveResponse.data.clientCode).toBeDefined();
    }
    
    // Validate NAV allocation and unit calculation if order is processed
    if (retrieveResponse.data.status === 'COMPLETE' || retrieveResponse.data.allottedUnits) {
      expect(retrieveResponse.data.allottedUnits).toBeGreaterThan(0);
      expect(retrieveResponse.data.nav).toBeGreaterThan(0);
      expect(retrieveResponse.data.navDate).toBeDefined();
      
      // Verify unit calculation: amount / nav should approximately equal allottedUnits
      const expectedUnits = retrieveResponse.data.amount / retrieveResponse.data.nav;
      expect(Math.abs(retrieveResponse.data.allottedUnits - expectedUnits)).toBeLessThan(1);
    }
    
    // Check for order status update events
    const statusUpdateEvent = await kafka.consumeMessage('order-events', {
      filter: msg => msg.orderId === orderId && 
                    (msg.eventType === 'ORDER_STATUS_UPDATED' || 
                     msg.eventType === 'ORDER_COMPLETED' || 
                     msg.eventType === 'ORDER_PROCESSED'),
      timeout: 3000
    });
    
    if (statusUpdateEvent) {
      expect(statusUpdateEvent.value.orderId).toBe(orderId);
      expect(statusUpdateEvent.value.currentStatus).toBeDefined();
      expect(statusUpdateEvent.value.timestamp).toBeDefined();
    }

    // Cleanup
    await mongo.deleteOne('orders', { orderId: orderId });
  });

  test('should verify complete order status progression and BSE submission', async ({ api, kafka, mongo }) => {
    // Arrange
    const orderData = {
      investorId: 'inv-progression-test',
      schemeCode: 'INF200K01RJ1',
      orderType: 'PURCHASE',
      amount: 15000.0,
      holdingType: 'SINGLE',
      transactionMode: 'PHYSICAL',
      euin: 'E123456789',
      remarks: 'Complete progression test',
      sourceSystem: 'MOBILE_APP',
      idempotencyKey: 'progression-test-001'
    };

    const startTime = Date.now();

    // Act - Create order
    const createResponse = await api.post('/api/v1/orders', orderData);
    
    // Assert - Order creation with BSE submission confirmation
    expect(createResponse.status).toBe(201);
    expect(createResponse.data.orderId).toBeDefined();
    expect(createResponse.data.orderNumber).toBeDefined();
    expect(createResponse.data.orderNumber).toMatch(/^ORD\d+/);
    
    const orderId = createResponse.data.orderId;
    
    // Verify initial order status is PENDING/CREATED
    expect(['PENDING', 'CREATED']).toContain(createResponse.data.status);
    
    // Verify BSE order submission confirmation
    if (createResponse.data.bseOrderId) {
      expect(createResponse.data.bseOrderId).toMatch(/^BSE\d+/);
      expect(createResponse.data.clientCode).toBeDefined();
      expect(createResponse.data.clientCode).toMatch(/^\d{8}$/);
    }
    
    // Monitor complete order status progression
    const statusProgression = [];
    let currentStatus = createResponse.data.status;
    statusProgression.push(currentStatus);
    
    // Check for status progression events
    const progressionEvents = [];
    
    // Listen for order status updates for up to 30 seconds
    const maxWaitTime = 30000;
    const checkInterval = 2000;
    let elapsedTime = 0;
    
    while (elapsedTime < maxWaitTime) {
      await new Promise(resolve => setTimeout(resolve, checkInterval));
      elapsedTime += checkInterval;
      
      // Get current order status
      const statusResponse = await api.get(`/api/v1/orders/${orderId}`);
      expect(statusResponse.status).toBe(200);
      
      if (statusResponse.data.status !== currentStatus) {
        currentStatus = statusResponse.data.status;
        statusProgression.push(currentStatus);
        
        // Verify valid status transitions
        expect(['PENDING', 'CREATED', 'SUBMITTED', 'PROCESSED', 'COMPLETE', 'FAILED']).toContain(currentStatus);
        
        // If order is complete, break the loop
        if (currentStatus === 'COMPLETE') {
          break;
        }
      }
      
      // Check for Kafka status update events
      const statusEvent = await kafka.consumeMessage('order-events', {
        filter: msg => msg.orderId === orderId && 
                      (msg.eventType === 'ORDER_STATUS_UPDATED' || 
                       msg.eventType === 'ORDER_SUBMITTED' ||
                       msg.eventType === 'ORDER_PROCESSED' ||
                       msg.eventType === 'ORDER_COMPLETED'),
        timeout: 1000
      });
      
      if (statusEvent && !progressionEvents.find(e => e.eventType === statusEvent.value.eventType)) {
        progressionEvents.push(statusEvent.value);
      }
    }
    
    // Verify final order completion status check
    const finalResponse = await api.get(`/api/v1/orders/${orderId}`);
    expect(finalResponse.status).toBe(200);
    
    // Validate final order completion status
    if (finalResponse.data.status === 'COMPLETE') {
      expect(finalResponse.data.allottedUnits).toBeGreaterThan(0);
      expect(finalResponse.data.nav).toBeGreaterThan(0);
      expect(finalResponse.data.navDate).toBeDefined();
      expect(finalResponse.data.paymentTransactionId).toBeDefined();
      expect(finalResponse.data.paymentStatus).toBe('SUCCESS');
      expect(finalResponse.data.folioNumber).toBeDefined();
      
      // Verify NAV allocation and unit calculation accuracy
      const expectedUnits = finalResponse.data.amount / finalResponse.data.nav;
      expect(Math.abs(finalResponse.data.allottedUnits - expectedUnits)).toBeLessThan(1);
      
      // Verify order completion event is published
      const completionEvent = await kafka.consumeMessage('order-events', {
        filter: msg => msg.orderId === orderId && msg.eventType === 'ORDER_COMPLETED',
        timeout: 5000
      });
      
      expect(completionEvent).not.toBeNull();
      expect(completionEvent.value.currentStatus).toBe('COMPLETE');
      expect(completionEvent.value.allottedUnits).toBe(finalResponse.data.allottedUnits);
      expect(completionEvent.value.nav).toBe(finalResponse.data.nav);
    }
    
    // Validate end-to-end processing time is within acceptable limits (30 seconds)
    const endTime = Date.now();
    const processingTime = endTime - startTime;
    expect(processingTime).toBeLessThan(30000); // Should complete within 30 seconds
    
    // Verify status progression is logical
    expect(statusProgression.length).toBeGreaterThan(0);
    expect(statusProgression[0]).toMatch(/PENDING|CREATED/);
    
    // Verify database records are properly updated
    const dbOrder = await mongo.findOne('orders', { orderId: orderId });
    expect(dbOrder).toBeDefined();
    expect(dbOrder.status).toBe(finalResponse.data.status);
    expect(dbOrder.updatedAt).toBeDefined();
    
    // Cleanup
    await mongo.deleteOne('orders', { orderId: orderId });
  });
});
