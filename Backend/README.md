# LuxeBag backend

This folder contains the Express API for LuxeBag.

## Structure

```text
src/
  config/       Environment and MongoDB configuration
  controllers/  Request handlers
  middleware/   Shared request and error middleware
  routes/       Express route modules
  app.js        Express application
  server.js     HTTP server entry point
```

## Getting started

1. Copy `.env.example` to `.env` and set `MONGODB_URI` when MongoDB is available.
2. Install dependencies with `npm install`.
3. Start the API with `npm run dev` or `npm start`.

The API starts without MongoDB so the HTTP layer can be developed independently. Check `GET /api/health` to see the current database connection state.

## Authentication and API docs

Authentication endpoints use bcrypt password hashes and JWT bearer tokens:

- `POST /api/auth/register` — create a customer account
- `POST /api/auth/login` — sign in and receive a token
- `GET /api/auth/me` — return the authenticated account (`Authorization: Bearer <token>`)

Email verification is intentionally not enabled yet and can be added before
activating an account in a future iteration. Open `/api-docs` in a browser for
the interactive OpenAPI/Swagger documentation.

Administrators can manage customer accounts with a JWT for an admin user:

- `POST /api/admin/customers` — create a customer
- `GET /api/admin/customers` — list customers with pagination, search, and status filters
- `GET /api/admin/customers/:id` — view a customer
- `PATCH /api/admin/customers/:id` — update customer profile or password
- `PATCH /api/admin/customers/:id/disable` — disable a customer account
- `PATCH /api/admin/customers/:id/enable` — enable a disabled customer account

Administrators can manage handbag products:

- `GET /api/products` — list published products
- `GET /api/admin/products` — list all products
- `POST /api/admin/products` — create a product
- `GET /api/admin/products/:id` — view a product
- `PATCH /api/admin/products/:id` — update a product
- `POST /api/admin/products/bulk-discount` — apply or clear a real/display-only discount for all products, a product name, brand, or category
- `DELETE /api/admin/products/:id` — permanently delete a product
- `POST /api/admin/products/image-upload` — create a short-lived Backblaze B2 upload URL
- `POST /api/admin/products/image-upload/proxy` — upload an image through the API (avoids browser-to-B2 CORS)

Configure the `B2_*` variables in `.env` for image uploads. The bucket may be
public for product delivery, but B2 application keys must only exist on the
backend. The mobile app uploads directly to B2 using the presigned URL.

## Seed MongoDB

The idempotent seed script at `scripts/seed-mongodb.js` creates the Mongoose
schemas and inserts/upserts representative data for the customer and admin
flows: users, addresses, brands, categories, products, favorites, carts,
orders, payments, reviews, promotions, and return requests.

```bash
npm run seed
```

The script reads `MONGODB_URI` from `Backend/.env` (or the process environment).
It uses deterministic IDs, so running it again updates the sample records
without duplicating them. Development credentials are printed by the command:
`admin@luxebag.com / Admin@123` and `customer@luxebag.com / Customer@123`.
