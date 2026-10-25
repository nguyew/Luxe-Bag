const path = require('path');
const swaggerJSDoc = require('swagger-jsdoc');

const swaggerDefinition = {
  openapi: '3.0.3',
  info: {
    title: 'LuxeBag API',
    version: '1.0.0',
    description: 'Authentication and shopping API for LuxeBag.',
  },
  servers: [{ url: '/' }],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
    schemas: {
      RegisterRequest: {
        type: 'object',
        required: ['name', 'email', 'password'],
        properties: {
          name: { type: 'string', minLength: 2, maxLength: 100, example: 'Jane Doe' },
          email: { type: 'string', format: 'email', example: 'jane@example.com' },
          password: { type: 'string', format: 'password', minLength: 8, example: 'secret123' },
        },
      },
      LoginRequest: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email', example: 'jane@example.com' },
          password: { type: 'string', format: 'password', example: 'secret123' },
        },
      },
      AdminCustomerRequest: {
        type: 'object',
        required: ['name', 'email', 'password'],
        properties: {
          name: { type: 'string', minLength: 2, maxLength: 100 },
          email: { type: 'string', format: 'email' },
          password: { type: 'string', format: 'password', minLength: 8 },
          phone: { type: 'string' },
          avatarUrl: { type: 'string', format: 'uri' },
        },
      },
      AdminCustomerUpdateRequest: {
        type: 'object',
        properties: {
          name: { type: 'string', minLength: 2, maxLength: 100 },
          email: { type: 'string', format: 'email' },
          password: { type: 'string', format: 'password', minLength: 8 },
          phone: { type: 'string' },
          avatarUrl: { type: 'string', format: 'uri' },
        },
        minProperties: 1,
      },
      Product: {
        type: 'object',
        required: ['handbagName', 'brand', 'cost'],
        properties: {
          id: { type: 'string', readOnly: true, example: '6712f0c9e4b1f6a2d8c12345' },
          handbagName: { type: 'string', minLength: 2, maxLength: 160, example: 'Classic Leather Bag' },
          brand: { type: 'string', maxLength: 100, example: 'LuxeBag' },
          category: { type: 'string', maxLength: 100, example: 'Shoulder Bag' },
          cost: { type: 'number', format: 'double', minimum: 0, example: 199.99 },
          percentOff: { type: 'number', format: 'double', minimum: 0, maximum: 0.9, example: 0.1 },
          color: { type: 'array', items: { type: 'string' }, example: ['Black', 'Brown'] },
          gender: { type: 'boolean', example: true },
          stock: { type: 'integer', minimum: 0, example: 20 },
          status: { type: 'string', enum: ['draft', 'published', 'archived'], example: 'published' },
          uri: { type: 'string', format: 'uri', example: 'https://f005.backblazeb2.com/file/luxe-bag/products/example.jpeg' },
          imageKey: { type: 'string', example: 'products/example.jpeg' },
          createdAt: { type: 'string', format: 'date-time', readOnly: true },
          updatedAt: { type: 'string', format: 'date-time', readOnly: true },
        },
      },
      ProductCreateRequest: {
        type: 'object',
        required: ['handbagName', 'brand', 'cost'],
        properties: {
          handbagName: { type: 'string', minLength: 2, maxLength: 160 },
          brand: { type: 'string', maxLength: 100 },
          category: { type: 'string', maxLength: 100 },
          cost: { type: 'number', minimum: 0 },
          percentOff: { type: 'number', minimum: 0, maximum: 0.9 },
          color: { type: 'array', items: { type: 'string' } },
          gender: { type: 'boolean' },
          stock: { type: 'integer', minimum: 0 },
          status: { type: 'string', enum: ['draft', 'published', 'archived'] },
          uri: { type: 'string', format: 'uri' },
          imageKey: { type: 'string' },
        },
      },
      ProductUpdateRequest: {
        allOf: [{ $ref: '#/components/schemas/ProductCreateRequest' }],
        minProperties: 1,
      },
      ImageUploadRequest: {
        type: 'object',
        required: ['contentType'],
        properties: {
          contentType: { type: 'string', enum: ['image/jpeg', 'image/png', 'image/webp'] },
        },
      },
      ImageUploadResponse: {
        type: 'object',
        properties: {
          key: { type: 'string', example: 'products/uuid.jpeg' },
          url: { type: 'string', format: 'uri', description: 'Short-lived presigned B2 upload URL.' },
          publicUrl: { type: 'string', format: 'uri' },
          uri: { type: 'string', format: 'uri' },
        },
      },
    },
  },
};

module.exports = swaggerJSDoc({
  definition: swaggerDefinition,
  apis: [path.join(__dirname, '..', 'routes', '*.js').replace(/\\/g, '/')],
});
