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
    },
  },
};

module.exports = swaggerJSDoc({
  definition: swaggerDefinition,
  apis: [path.join(__dirname, '..', 'routes', '*.js').replace(/\\/g, '/')],
});
