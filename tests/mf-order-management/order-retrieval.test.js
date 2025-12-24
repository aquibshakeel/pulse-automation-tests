const { test, expect } = require('../../common/fixtures/test-fixtures');

test.describe('Order Retrieval', () => {
  test('should retrieve order by valid existing ID', async ({ api, mongo }) => {
    // Arrange - Create test order in database
    const testOrder = {
      orderId: 'order-test-123',
      orderNumber: 'ORD123456789',
      bseOrderId: 'BSE123456789',
      investorId: 'inv-123',
      clientCode: '12345678',
      folioNumber: 'F123456789',
      schemeCode: 'INF200K01RJ1',
      schemeName: 'SBI Blue Chip Fund - Direct Plan - Growth',
      orderType: 'PURCHASE',
      status: 'COMPLETE',
      statusDescription: 'Order completed successfully',
      amount: 10000.0,
      allottedUnits: 127.5432,
      nav: 78.4321,
      navDate: '2024-01-14',
      paymentTransactionId: 'TXN123456789',
      paymentStatus: 'SUCCESS',
      createdAt: new Date('2024-01-15T09:25:00Z'),
      updatedAt: new Date('2024-01-15T10:45:00Z')
    };
    
    await mongo.insertOne('orders', testOrder);

    // Act
    const response = await api.get(`/api/v1/orders/${testOrder.orderId}`);

    // Assert
    expect(response.status).toBe(200);
    expect(response.data).toBeDefined();
    expect(response.data.orderId).toBe(testOrder.orderId);
    expect(response.data.orderNumber).toBe(testOrder.orderNumber);
    expect(response.data.investorId).toBe(testOrder.investorId);
    expect(response.data.schemeCode).toBe(testOrder.schemeCode);
    expect(response.data.orderType).toBe(testOrder.orderType);
    expect(response.data.status).toBe(testOrder.status);
    expect(response.data.amount).toBe(testOrder.amount);
    expect(response.data.allottedUnits).toBe(testOrder.allottedUnits);
    
    // Cleanup
    await mongo.deleteOne('orders', { orderId: testOrder.orderId });
  });
});

  test('should return 404 for non-existent order', async ({ api }) => {
    // Arrange
    const nonExistentOrderId = 'order-nonexistent-123';

    // Act
    const response = await api.get(`/api/v1/orders/${nonExistentOrderId}`);

    // Assert
    expect(response.status).toBe(404);
    expect(response.data.error).toBeDefined();
    expect(response.data.error).toMatch(/order.*not found/i);
  });

  test('should return 400 for invalid UUID format', async ({ api }) => {
    // Arrange
    const invalidOrderId = 'invalid-uuid-format';

    // Act
    const response = await api.get(`/api/v1/orders/${invalidOrderId}`);

    // Assert
    expect(response.status).toBe(400);
    expect(response.data.error).toBeDefined();
    expect(response.data.error).toMatch(/invalid.*uuid|format/i);
  });

  test('should return 400 for malformed UUID', async ({ api }) => {
    // Arrange
    const malformedUuid = '123-456-789';

    // Act
    const response = await api.get(`/api/v1/orders/${malformedUuid}`);

    // Assert
    expect(response.status).toBe(400);
    expect(response.data.error).toBeDefined();
    expect(response.data.error).toMatch(/invalid.*uuid|format/i);
  });

  test('should return 400 for UUID with special characters', async ({ api }) => {
    // Arrange
    const invalidUuid = 'order@123#456$789';

    // Act
    const response = await api.get(`/api/v1/orders/${invalidUuid}`);

    // Assert
    expect(response.status).toBe(400);
    expect(response.data.error).toBeDefined();
    expect(response.data.error).toMatch(/invalid.*uuid|format/i);
  });

  test('should return 400 for empty UUID parameter', async ({ api }) => {
    // Arrange
    const emptyUuid = '';

    // Act
    const response = await api.get(`/api/v1/orders/${emptyUuid}`);

    // Assert
    expect(response.status).toBe(400);
    expect(response.data.error).toBeDefined();
    expect(response.data.error).toMatch(/invalid.*uuid|format|required/i);
    expect(response.data.error).toContain('UUID');
  });

  test('should return 400 for extremely long UUID string', async ({ api }) => {
    // Arrange
    const longUuid = 'a'.repeat(1000); // Extremely long string

    // Act
    const response = await api.get(`/api/v1/orders/${longUuid}`);

    // Assert
    expect(response.status).toBe(400);
    expect(response.data.error).toBeDefined();
    expect(response.data.error).toMatch(/invalid.*uuid|format/i);
    expect(response.data.error).toContain('UUID');
  });

  test('should return consistent error format for all invalid UUID types', async ({ api }) => {
    // Arrange - Test various invalid UUID formats
    const invalidUuids = [
      { id: 'invalid-uuid-format', description: 'invalid format' },
      { id: '123-456-789', description: 'malformed UUID' },
      { id: 'order@123#456$789', description: 'special characters' },
      { id: '', description: 'empty string' },
      { id: 'a'.repeat(1000), description: 'extremely long string' },
      { id: '   ', description: 'whitespace only' },
      { id: 'null', description: 'string null' },
      { id: 'undefined', description: 'string undefined' }
    ];

    for (const testCase of invalidUuids) {
      // Act
      const response = await api.get(`/api/v1/orders/${testCase.id}`);

      // Assert - Consistent error format
      expect(response.status).toBe(400);
      expect(response.data.error).toBeDefined();
      expect(response.data.error).toMatch(/invalid.*uuid|format/i);
      expect(response.data.error).toContain('UUID');
      
      // Verify response headers for error cases
      expect(response.headers['content-type']).toMatch(/application\/json/i);
      
      // Verify error response structure consistency
      expect(response.data).toHaveProperty('error');
      expect(typeof response.data.error).toBe('string');
      expect(response.data.error.length).toBeGreaterThan(0);
    }
  });

  test('should distinguish between invalid format and valid format non-existent ID', async ({ api }) => {
    // Arrange
    const validFormatNonExistentId = '550e8400-e29b-41d4-a716-446655440000'; // Valid UUID format but doesn't exist
    const invalidFormatId = 'not-a-uuid';

    // Act
    const validFormatResponse = await api.get(`/api/v1/orders/${validFormatNonExistentId}`);
    const invalidFormatResponse = await api.get(`/api/v1/orders/${invalidFormatId}`);

    // Assert - Different status codes for different error types
    expect(validFormatResponse.status).toBe(404); // Not found
    expect(invalidFormatResponse.status).toBe(400); // Bad request
    
    // Assert - Different error messages
    expect(validFormatResponse.data.error).toMatch(/order.*not found/i);
    expect(invalidFormatResponse.data.error).toMatch(/invalid.*uuid|format/i);
    
    // Verify response headers are properly set for both cases
    expect(validFormatResponse.headers['content-type']).toMatch(/application\/json/i);
    expect(invalidFormatResponse.headers['content-type']).toMatch(/application\/json/i);
  });