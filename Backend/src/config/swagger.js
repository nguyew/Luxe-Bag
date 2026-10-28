const path = require('path');
const swaggerJSDoc = require('swagger-jsdoc');

const swaggerDefinition = {
  openapi: '3.0.3',
  info: {
    title: 'LuxeBag API',
    version: '1.1.0',
    description: 'Authentication, catalog, shopping, and administration API for LuxeBag.',
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
      Error: {
        type: 'object',
        properties: {
          error: { type: 'string', example: 'Invalid input.' },
          code: { type: 'string', example: 'invalid_input' },
          details: { type: 'object', additionalProperties: true },
        },
      },
      Address: {
        type: 'object',
        required: ['fullName', 'phone', 'line1', 'city'],
        properties: {
          fullName: { type: 'string', example: 'Jane Doe' },
          phone: { type: 'string', example: '+1 555 0100' },
          line1: { type: 'string', example: '123 Main Street' },
          city: { type: 'string', example: 'New York' },
        },
      },
      OrderItem: {
        type: 'object',
        properties: {
          productId: { type: 'string' },
          handbagId: { type: 'string' },
          name: { type: 'string' },
          brand: { type: 'string' },
          uri: { type: 'string', format: 'uri' },
          unitPrice: { type: 'number', format: 'double' },
          qty: { type: 'integer', minimum: 1, maximum: 10 },
        },
      },
      Order: {
        type: 'object',
        properties: {
          id: { type: 'string', readOnly: true },
          status: { type: 'string', enum: ['pending', 'processing', 'shipped', 'delivered', 'cancelled', 'returned', 'refunded'] },
          items: { type: 'array', items: { $ref: '#/components/schemas/OrderItem' } },
          subtotal: { type: 'number', format: 'double' },
          discount: { type: 'number', format: 'double' },
          shipping: { type: 'number', format: 'double' },
          total: { type: 'number', format: 'double' },
          address: { $ref: '#/components/schemas/Address' },
          paymentMethod: { type: 'string', enum: ['cod', 'card'] },
          paymentStatus: { type: 'string', enum: ['unpaid', 'paid'] },
          couponCode: { type: 'string', nullable: true },
          returnRequest: { type: 'object', nullable: true, additionalProperties: true },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      Coupon: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'cp-summer26' },
          code: { type: 'string', example: 'SUMMER26' },
          type: { type: 'string', enum: ['percent', 'fixed'] },
          value: { type: 'number', format: 'double' },
          minSubtotal: { type: 'number', format: 'double', minimum: 0 },
          expiresAt: { type: 'string', format: 'date-time', nullable: true },
          active: { type: 'boolean' },
          usageLimit: { type: 'integer', minimum: 1, nullable: true },
          usedCount: { type: 'integer', minimum: 0, readOnly: true },
        },
      },
      Review: {
        type: 'object',
        properties: {
          id: { type: 'string', readOnly: true },
          productId: { type: 'string' },
          userId: { type: 'string' },
          author: { type: 'string' },
          rating: { type: 'integer', minimum: 1, maximum: 5 },
          comment: { type: 'string', maxLength: 500 },
          date: { type: 'string', format: 'date-time' },
          hidden: { type: 'boolean' },
        },
      },
      CartItem: {
        type: 'object',
        required: ['productId', 'qty'],
        properties: {
          productId: { type: 'string' },
          qty: { type: 'integer', minimum: 1, maximum: 10 },
        },
      },
      StylistRequest: {
        type: 'object',
        required: ['request', 'handbags'],
        properties: {
          request: { type: 'string', minLength: 1, maxLength: 1000 },
          handbags: { type: 'array', items: { type: 'object', additionalProperties: true } },
        },
      },
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
          slug: { type: 'string', readOnly: true, example: 'luxebag-classic-leather-bag-a1b2c3d4' },
          brand: { type: 'string', maxLength: 100, example: 'LuxeBag' },
          category: { type: 'string', maxLength: 100, example: 'Shoulder Bag' },
          cost: { type: 'number', format: 'double', minimum: 0, example: 199.99 },
          originalCost: { type: 'number', format: 'double', minimum: 0, example: 399.99 },
          percentOff: { type: 'number', format: 'double', minimum: 0, maximum: 0.9, example: 0.1 },
          discountMode: { type: 'string', enum: ['real', 'fake'], example: 'fake' },
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
          originalCost: { type: 'number', minimum: 0 },
          percentOff: { type: 'number', minimum: 0, maximum: 0.9 },
          discountMode: { type: 'string', enum: ['real', 'fake'] },
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
      PurchasedBag: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Product id', example: '6712f0c9e4b1f6a2d8c12345' },
          productId: { type: 'string', example: '6712f0c9e4b1f6a2d8c12345' },
          name: { type: 'string', example: 'Tabby Shoulder Bag 26' },
          brand: { type: 'string', example: 'Coach' },
          uri: { type: 'string', format: 'uri' },
          unitPrice: { type: 'number', description: 'Price paid per bag at the latest purchase', example: 8900000 },
          quantity: { type: 'integer', description: 'Total bags bought across delivered orders', example: 1 },
          ordersCount: { type: 'integer', example: 1 },
          totalSpent: { type: 'number', description: 'Sum of unitPrice x qty (before order-level discounts and shipping)', example: 8900000 },
          firstPurchasedAt: { type: 'string', format: 'date-time' },
          lastPurchasedAt: { type: 'string', format: 'date-time' },
          lastOrderId: { type: 'string' },
          orderIds: { type: 'array', items: { type: 'string' } },
          available: { type: 'boolean', description: 'Still published and in stock, so it can be bought again' },
          currentPrice: { type: 'number', nullable: true, description: 'Current catalog price, null if the product was removed' },
          myReview: {
            type: 'object',
            nullable: true,
            properties: {
              rating: { type: 'integer', minimum: 1, maximum: 5 },
              hidden: { type: 'boolean' },
            },
          },
        },
      },
      PurchasedBagsResponse: {
        type: 'object',
        properties: {
          summary: {
            type: 'object',
            properties: {
              bags: { type: 'integer', description: 'Distinct bags', example: 2 },
              items: { type: 'integer', description: 'Total quantity', example: 3 },
              totalSpent: { type: 'number', example: 16100000 },
            },
          },
          bags: { type: 'array', items: { $ref: '#/components/schemas/PurchasedBag' } },
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