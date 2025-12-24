const { test, expect } = require('../../common/fixtures/test-fixtures');

test.describe('Service A - Complete Flow', () => {
  test('should successfully fetch users from API', async ({ api }) => {
    const response = await api.get('/users');

    expect(response.status).toBe(200);
    expect(response.data).toBeDefined();
    expect(Array.isArray(response.data)).toBe(true);
  });

  test('should create a new user via API', async ({ api }) => {
    const newUser = {
      name: 'John Doe',
      email: 'john.doe@example.com',
      status: 'active',
    };

    const response = await api.post('/users', newUser);

    expect(response.status).toBe(201);
    expect(response.data.name).toBe(newUser.name);
    expect(response.data.email).toBe(newUser.email);
    expect(response.data.id).toBeDefined();
  });

  test('should produce and consume Kafka message', async ({ kafka }) => {
    const testMessage = {
      eventType: 'USER_CREATED',
      userId: '12345',
      timestamp: new Date().toISOString(),
    };

    await kafka.produceMessage('user-events', testMessage);

    const consumedMessage = await kafka.consumeMessage('user-events', {
      filter: msg => msg.userId === '12345',
      timeout: 5000,
    });

    expect(consumedMessage).not.toBeNull();
    expect(consumedMessage.value.eventType).toBe('USER_CREATED');
    expect(consumedMessage.value.userId).toBe('12345');
  });

  test('should insert and query documents in MongoDB', async ({ mongo }) => {
    const testDocument = {
      name: 'Test Product',
      price: 99.99,
      category: 'electronics',
      createdAt: new Date(),
    };

    const insertResult = await mongo.insert('products', testDocument);
    expect(insertResult.insertedId).toBeDefined();

    const foundDocuments = await mongo.query('products', {
      name: 'Test Product',
    });

    expect(foundDocuments.length).toBeGreaterThan(0);
    expect(foundDocuments[0].name).toBe(testDocument.name);
    expect(foundDocuments[0].price).toBe(testDocument.price);

    await mongo.delete('products', { _id: insertResult.insertedId });
  });

  test('should complete full order processing flow', async ({ api, kafka, mongo }) => {
    const orderData = {
      customerId: 'cust-123',
      items: [{ productId: 'prod-456', quantity: 2 }],
      total: 199.98,
    };

    const createResponse = await api.post('/orders', orderData);
    expect(createResponse.status).toBe(201);
    const orderId = createResponse.data.id;

    const orderEvent = await kafka.consumeMessage('order-events', {
      filter: msg => msg.orderId === orderId && msg.eventType === 'ORDER_CREATED',
      timeout: 5000,
    });

    expect(orderEvent).not.toBeNull();
    expect(orderEvent.value.orderId).toBe(orderId);
    expect(orderEvent.value.customerId).toBe(orderData.customerId);

    const dbOrder = await mongo.findOne('orders', { orderId });

    expect(dbOrder).not.toBeNull();
    expect(dbOrder.customerId).toBe(orderData.customerId);
    expect(dbOrder.total).toBe(orderData.total);
    expect(dbOrder.status).toBe('pending');

    const updateResponse = await api.put(`/orders/${orderId}`, {
      status: 'confirmed',
    });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.data.status).toBe('confirmed');
  });

  test.skip('should upload and download file from storage', async ({ file }) => {
    const testFilePath = './test-data/sample.txt';
    const remoteFilePath = '/test-uploads/sample.txt';

    await file.uploadFile(testFilePath, remoteFilePath, 'sftp');

    const downloadPath = './downloads/sample.txt';
    await file.downloadFile(remoteFilePath, downloadPath, 'sftp');

    const fs = require('fs');
    expect(fs.existsSync(downloadPath)).toBe(true);
  });
});
