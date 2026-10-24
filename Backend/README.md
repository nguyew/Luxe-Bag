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
