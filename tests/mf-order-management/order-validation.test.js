const { test, expect } = require('../../common/fixtures/test-fixtures');

test.describe('Order Validation', () => {
  test('should reject invalid scheme code format', async ({ api }) => {
    // Arrange
    const invalidOrderData = {
      investorId: 'inv-123',
      schemeCode: 'INVALID@123',  // Invalid format
      orderType: 'PURCHASE',
      amount: 10000.0,
      holdingType: 'SINGLE',
      transactionMode: 'PHYSICAL',
      euin: 'E123456789',
      remarks: 'Test order with invalid scheme code',
      sourceSystem: 'MOBILE_APP',
      idempotencyKey: 'test-invalid-scheme-001'
    };

    // Act
    const response = await api.post('/api/v1/orders', invalidOrderData);

    // Assert
    expect(response.status).toBe(400);
    expect(response.data.error).toBeDefined();
    expect(response.data.error).toMatch(/scheme code/i);
    expect(response.data.error).toMatch(/invalid|format/i);
  });

  test('should reject empty scheme code', async ({ api }) => {
    // Arrange
    const invalidOrderData = {
      investorId: 'inv-123',
      schemeCode: '',  // Empty scheme code
      orderType: 'PURCHASE',
      amount: 10000.0,
      holdingType: 'SINGLE',
      transactionMode: 'PHYSICAL',
      euin: 'E123456789',
      sourceSystem: 'MOBILE_APP',
      idempotencyKey: 'test-empty-scheme-001'
    };

    // Act
    const response = await api.post('/api/v1/orders', invalidOrderData);

    // Assert
    expect(response.status).toBe(400);
    expect(response.data.error).toBeDefined();
    expect(response.data.error).toMatch(/scheme code.*required/i);
  });

  test('should reject null scheme code', async ({ api }) => {
    // Arrange
    const invalidOrderData = {
      investorId: 'inv-123',
      schemeCode: null,  // Null scheme code
      orderType: 'PURCHASE',
      amount: 10000.0,
      holdingType: 'SINGLE',
      transactionMode: 'PHYSICAL',
      euin: 'E123456789',
      sourceSystem: 'MOBILE_APP',
      idempotencyKey: 'test-null-scheme-001'
    };

    // Act
    const response = await api.post('/api/v1/orders', invalidOrderData);

    // Assert
    expect(response.status).toBe(400);
    expect(response.data.error).toBeDefined();
    expect(response.data.error).toMatch(/scheme code.*required/i);
  });
});

  test('should reject invalid order type', async ({ api }) => {
    // Arrange
    const invalidOrderData = {
      investorId: 'inv-123',
      schemeCode: 'INF200K01RJ1',
      orderType: 'INVALID_TYPE',  // Invalid order type
      amount: 10000.0,
      holdingType: 'SINGLE',
      transactionMode: 'PHYSICAL',
      euin: 'E123456789',
      remarks: 'Test order with invalid type',
      sourceSystem: 'MOBILE_APP',
      idempotencyKey: 'test-invalid-type-001'
    };

    // Act
    const response = await api.post('/api/v1/orders', invalidOrderData);

    // Assert
    expect(response.status).toBe(400);
    expect(response.data.error).toBeDefined();
    expect(response.data.error).toMatch(/order type/i);
    expect(response.data.error).toMatch(/invalid|unsupported/i);
  });

  test('should reject null order type', async ({ api }) => {
    // Arrange
    const invalidOrderData = {
      investorId: 'inv-123',
      schemeCode: 'INF200K01RJ1',
      orderType: null,  // Null order type
      amount: 10000.0,
      holdingType: 'SINGLE',
      transactionMode: 'PHYSICAL',
      euin: 'E123456789',
      sourceSystem: 'MOBILE_APP',
      idempotencyKey: 'test-null-type-001'
    };

    // Act
    const response = await api.post('/api/v1/orders', invalidOrderData);

    // Assert
    expect(response.status).toBe(400);
    expect(response.data.error).toBeDefined();
    expect(response.data.error).toMatch(/order type.*required/i);
  });

  test('should reject empty order type', async ({ api }) => {
    // Arrange
    const invalidOrderData = {
      investorId: 'inv-123',
      schemeCode: 'INF200K01RJ1',
      orderType: '',  // Empty order type
      amount: 10000.0,
      holdingType: 'SINGLE',
      transactionMode: 'PHYSICAL',
      euin: 'E123456789',
      sourceSystem: 'MOBILE_APP',
      idempotencyKey: 'test-empty-type-001'
    };

    // Act
    const response = await api.post('/api/v1/orders', invalidOrderData);

    // Assert
    expect(response.status).toBe(400);
    expect(response.data.error).toBeDefined();
    expect(response.data.error).toMatch(/order type.*required/i);
  });