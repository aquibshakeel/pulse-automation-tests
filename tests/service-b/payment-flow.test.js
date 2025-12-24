const { test, expect } = require('../../common/fixtures/test-fixtures');

test.describe('Service B - Payment Flow', () => {
  test('should process payment successfully', async ({ api }) => {
    const paymentData = {
      amount: 99.99,
      currency: 'USD',
      customerId: 'cust-123',
    };

    const response = await api.post('/payments', paymentData);

    expect(response.status).toBe(201);
    expect(response.data.status).toBe('success');
  });
});
