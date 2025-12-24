# AI Test Generation Guide

This guide provides patterns and examples for AI tools to generate tests that follow the framework's standards and best practices.

## Core Principles

1. **Use test fixtures** - Import from `test-fixtures.js`, not individual helpers
2. **Follow AAA pattern** - Arrange, Act, Assert
3. **Only include needed fixtures** - Use `({ api })` or `({ api, kafka, mongo })`
4. **Descriptive test names** - Use `should` statements
5. **Inline documentation** - Comment complex test logic

## Test Structure Template

```javascript
const { test, expect } = require('../../common/fixtures/test-fixtures');

test.describe('Feature Name', () => {
  test('should do something specific', async ({ api, kafka, mongo }) => {
    // Arrange - Setup test data
    const testData = { key: 'value' };
    
    // Act - Execute the action
    const response = await api.post('/endpoint', testData);
    
    // Assert - Verify results
    expect(response.status).toBe(201);
    expect(response.data.key).toBe('value');
  });
});
```

## Available Fixtures

The framework provides these fixtures in test parameters:

- **`api`** - API helper (automatically initialized with request context)
- **`kafka`** - Kafka helper (auto-connects and disconnects)
- **`mongo`** - MongoDB helper (auto-connects and disconnects)
- **`file`** - File helper for SFTP/S3 operations

**Only include the fixtures you need!**

## Helper Usage Patterns

### API Helper

**✅ DO THIS:**
```javascript
const { test, expect } = require('../../common/fixtures/test-fixtures');

test('should fetch users', async ({ api }) => {
  const response = await api.get('/users');
  expect(response.status).toBe(200);
});

test('should create user', async ({ api }) => {
  const user = await api.post('/users', { name: 'John' });
  expect(user.status).toBe(201);
});

// With query parameters
test('should filter users', async ({ api }) => {
  const response = await api.get('/users', {
    queryParams: { page: 1, limit: 10 }
  });
  expect(response.data.length).toBeLessThanOrEqual(10);
});

// With custom headers
test('should authenticate', async ({ api }) => {
  const response = await api.get('/users', {
    headers: { 'Authorization': 'Bearer token123' }
  });
  expect(response.status).toBe(200);
});
```

**❌ DON'T DO THIS:**
```javascript
// Never import helpers directly
const ApiHelper = require('../../common/helpers/api-helper');
const apiHelper = new ApiHelper(request);

// Never use external HTTP libraries
const axios = require('axios');
const response = await axios.get('http://example.com/users');
```

### Kafka Helper

**✅ DO THIS:**
```javascript
test('should produce and consume message', async ({ kafka }) => {
  // Produce message
  await kafka.produceMessage('topic-name', {
    eventType: 'USER_CREATED',
    userId: '123'
  });

  // Consume with filter
  const message = await kafka.consumeMessage('topic-name', {
    filter: msg => msg.userId === '123',
    timeout: 5000
  });

  expect(message).not.toBeNull();
  expect(message.value.eventType).toBe('USER_CREATED');
});

// Consume multiple messages
test('should consume multiple messages', async ({ kafka }) => {
  const messages = await kafka.consumeMessages('topic-name', {
    maxMessages: 10,
    filter: msg => msg.status === 'pending'
  });

  expect(messages.length).toBeGreaterThan(0);
});
```

**❌ DON'T DO THIS:**
```javascript
// Never import or initialize manually
const KafkaHelper = require('../../common/helpers/kafka-helper');
const kafkaHelper = new KafkaHelper();
await kafkaHelper.connect();
```

### MongoDB Helper

**✅ DO THIS:**
```javascript
test('should query documents', async ({ mongo }) => {
  const users = await mongo.query('users', { status: 'active' });
  expect(users.length).toBeGreaterThan(0);
});

test('should insert document', async ({ mongo }) => {
  const result = await mongo.insert('users', { name: 'John' });
  expect(result.insertedId).toBeDefined();
  
  // Cleanup
  await mongo.delete('users', { _id: result.insertedId });
});

test('should update document', async ({ mongo }) => {
  await mongo.update('users', 
    { email: 'test@example.com' },
    { $set: { status: 'inactive' } }
  );
});

test('should count documents', async ({ mongo }) => {
  const count = await mongo.count('users', { status: 'active' });
  expect(count).toBeGreaterThan(0);
});
```

**❌ DON'T DO THIS:**
```javascript
// Never import MongoDB driver directly
const { MongoClient } = require('mongodb');
const client = new MongoClient('mongodb://localhost:27017');
```

### File Helper

**✅ DO THIS:**
```javascript
test('should upload to SFTP', async ({ file }) => {
  await file.uploadFile('./local/file.txt', '/remote/file.txt', 'sftp');
});

test('should download from S3', async ({ file }) => {
  await file.downloadFile('s3-key/file.txt', './local/file.txt', 's3');
});

test('should list SFTP files', async ({ file }) => {
  const files = await file.listSftpFiles('/data/exports');
  expect(files.length).toBeGreaterThan(0);
});
```

**❌ DON'T DO THIS:**
```javascript
// Never use storage libraries directly
const SftpClient = require('ssh2-sftp-client');
const { S3Client } = require('@aws-sdk/client-s3');
```

## Common Test Patterns

### Pattern 1: API Only Test
```javascript
test('should fetch and validate user data', async ({ api }) => {
  const response = await api.get('/users/123');
  
  expect(response.status).toBe(200);
  expect(response.data.id).toBe('123');
  expect(response.data.name).toBeDefined();
});
```

### Pattern 2: API + Kafka Test
```javascript
test('should create order and verify event', async ({ api, kafka }) => {
  // Create order via API
  const order = await api.post('/orders', {
    customerId: 'cust-123',
    total: 99.99
  });
  
  // Verify Kafka event
  const event = await kafka.consumeMessage('order-events', {
    filter: msg => msg.orderId === order.data.id,
    timeout: 5000
  });
  
  expect(event).not.toBeNull();
  expect(event.value.eventType).toBe('ORDER_CREATED');
});
```

### Pattern 3: API + MongoDB Test
```javascript
test('should create user and verify in database', async ({ api, mongo }) => {
  // Create via API
  const response = await api.post('/users', {
    name: 'John Doe',
    email: 'john@example.com'
  });
  
  // Verify in database
  const dbUser = await mongo.findOne('users', {
    email: 'john@example.com'
  });
  
  expect(dbUser).not.toBeNull();
  expect(dbUser.name).toBe('John Doe');
});
```

### Pattern 4: Complete Integration Test
```javascript
test('should complete end-to-end flow', async ({ api, kafka, mongo }) => {
  // Step 1: Create via API
  const response = await api.post('/orders', orderData);
  const orderId = response.data.id;
  
  // Step 2: Verify Kafka event
  const event = await kafka.consumeMessage('order-events', {
    filter: msg => msg.orderId === orderId
  });
  expect(event).not.toBeNull();
  
  // Step 3: Verify in database
  const dbOrder = await mongo.findOne('orders', { orderId });
  expect(dbOrder.status).toBe('pending');
  
  // Step 4: Update status
  await api.put(`/orders/${orderId}`, { status: 'confirmed' });
  
  // Step 5: Verify update
  const updatedOrder = await mongo.findOne('orders', { orderId });
  expect(updatedOrder.status).toBe('confirmed');
});
```

## Naming Conventions

### Test Files
- Use descriptive names: `user-management.test.js`
- Use kebab-case: `order-processing.test.js`
- Add `.test.js` suffix

### Test Descriptions
- Start with `should`: `should create user successfully`
- Be specific: `should return 404 when user not found`
- Avoid generic names: ❌ `test user` ✅ `should fetch user by id`

### Variables
- Use camelCase: `testData`, `apiResponse`
- Be descriptive: `createdOrder`, `consumedMessage`
- Avoid single letters: ❌ `r`, `d` ✅ `response`, `data`

## Test Tags

Use tags to categorize tests:

```javascript
test.describe('User API @smoke @api', () => {
  test('should fetch users @critical', async ({ api }) => {
    // test code
  });
  
  test('should create user @regression', async ({ api }) => {
    // test code
  });
});
```

Common tags:
- `@smoke` - Critical smoke tests
- `@regression` - Full regression suite
- `@api` - API tests
- `@kafka` - Kafka tests
- `@critical` - High-priority tests
- `@slow` - Tests that take longer to execute

## Error Handling

Always handle errors appropriately:

```javascript
test('should handle API errors gracefully', async ({ api }) => {
  const response = await api.get('/users/invalid-id');
  expect(response.status).toBe(404);
  expect(response.data.error).toBeDefined();
});

test('should timeout if Kafka message not received', async ({ kafka }) => {
  const message = await kafka.consumeMessage('topic', {
    filter: msg => msg.id === 'non-existent',
    timeout: 2000
  });
  
  expect(message).toBeNull(); // Timeout returns null
});
```

## Test Data Management

### Create Realistic Test Data
```javascript
const testUser = {
  name: 'Test User',
  email: `test-${Date.now()}@example.com`, // Unique email
  status: 'active',
  createdAt: new Date().toISOString()
};
```

### Clean Up After Tests
```javascript
test('should create and clean up test data', async ({ mongo }) => {
  // Create
  const result = await mongo.insert('users', testUser);
  
  // Test logic
  // ...
  
  // Clean up
  await mongo.delete('users', { _id: result.insertedId });
});
```

## Assertions Best Practices

### Be Specific
```javascript
// ❌ Generic
expect(response.data).toBeDefined();

// ✅ Specific
expect(response.status).toBe(200);
expect(response.data.id).toBe('123');
expect(response.data.name).toBe('John Doe');
```

### Check Error Cases
```javascript
test('should handle validation errors', async ({ api }) => {
  const response = await api.post('/users', { /* invalid data */ });
  
  expect(response.status).toBe(400);
  expect(response.data.errors).toBeDefined();
  expect(response.data.errors.length).toBeGreaterThan(0);
});
```

## Quick Reference

### Must-Use Import
```javascript
const { test, expect } = require('../../common/fixtures/test-fixtures');
```

### Fixture Usage
```javascript
// Use only what you need
test('api only', async ({ api }) => { /* ... */ });
test('api + kafka', async ({ api, kafka }) => { /* ... */ });
test('all helpers', async ({ api, kafka, mongo, file }) => { /* ... */ });
```

### Must-Follow Pattern
```javascript
test('should do something', async ({ api }) => {
  // Arrange
  
  // Act
  
  // Assert
});
```

## ESLint Will Catch

The framework's ESLint configuration will catch these mistakes:

- ❌ Direct imports of helper classes
- ❌ Direct imports of `axios`, `kafkajs`, `mongodb`, `ssh2-sftp-client`, `@aws-sdk/*`
- ❌ Console.log statements (use logger in helpers instead)
- ❌ Unused variables
- ❌ Formatting issues (Prettier will auto-fix)

## Summary Checklist

When generating tests, ensure:

- [ ] Uses fixtures from `common/fixtures/test-fixtures.js`
- [ ] Only includes needed fixtures in test parameters
- [ ] No manual helper initialization or cleanup
- [ ] Follows AAA pattern (Arrange, Act, Assert)
- [ ] Uses descriptive test names starting with "should"
- [ ] Includes proper assertions
- [ ] Has inline comments for complex logic
- [ ] Handles errors appropriately
- [ ] Uses proper naming conventions
- [ ] Cleans up test data when needed

## Example: Complete Test File

```javascript
const { test, expect } = require('../../common/fixtures/test-fixtures');

test.describe('Order Processing @api @kafka', () => {
  test('should create order and publish event @smoke', async ({ api, kafka }) => {
    // Arrange
    const orderData = {
      customerId: 'cust-123',
      items: [{ productId: 'prod-456', quantity: 2 }],
      total: 199.98
    };

    // Act
    const response = await api.post('/orders', orderData);
    const orderId = response.data.id;

    // Assert API response
    expect(response.status).toBe(201);
    expect(response.data.customerId).toBe(orderData.customerId);

    // Assert Kafka event
    const event = await kafka.consumeMessage('order-events', {
      filter: msg => msg.orderId === orderId,
      timeout: 5000
    });

    expect(event).not.toBeNull();
    expect(event.value.eventType).toBe('ORDER_CREATED');
    expect(event.value.total).toBe(orderData.total);
  });
});
```

This guide ensures all AI-generated tests follow the framework's standards and integrate seamlessly with existing code.
