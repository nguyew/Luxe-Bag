# LuxeBag

A branded handbag shopping app built with **React Native + Expo**, with **two roles**: customers and administrators.
The app talks to its own **Express + MongoDB backend** (in [`Backend/`](Backend)). Product images are stored on
Backblaze B2, and the AI Stylist calls Google Gemini **through the backend**, so no secret key ever ships inside the app.

```text
Expo app (React Native)  ──HTTP + JWT──▶  Express API (Backend/)  ──▶  MongoDB
                                               │
                                               ├──▶ Backblaze B2   (product images)
                                               └──▶ Google Gemini  (AI Stylist)
```

## Features

**Customers**: browse handbags by brand · advanced search, filtering, and sorting · product details with star ratings and
feedback · favorites (on-device for guests, synced to the account after sign-in) · sign up / sign in · shopping cart synced
to the account · shipping addresses · discount coupons · place orders (COD or demo card) · track and cancel orders ·
returns within 7 days of delivery · write reviews (only after receiving the item) · AI Stylist (Gemini) · profile and avatar.

**Administrators**: dashboard · product CRUD (draft / published / archived), inventory, image upload, bulk discounts ·
order management and status updates · approve / reject returns (optionally restocking) · customer management
(create / edit / disable / enable accounts) · review moderation · discount coupons · sales reports with charts ·
bulk renaming of brands / categories.

### Assignment Requirements Mapping

| Requirement | Implementation |
|---|---|
| Task 1 – UI & navigation: home screen organized by brand, `percentOff` displayed as a percentage, gender icon, descending price sort, Bottom Tabs | `HomeScreen`, `HandbagCard`, `AppNavigator` (floating tab bar) |
| Task 2 – Details & feedback: stars, comments, grouping by star rating | `DetailScreen`, `FeedbackSection`, `utils/feedback.js` |
| Task 3 – Favorites with AsyncStorage: add / remove / view / search | `services/favoriteService.js`, `FavouritesScreen`, `SearchScreen` |
| Task 4 – Advanced features: Gemini AI, Image Picker, administration, cart, orders | `StylistScreen`, `ProfileScreen`, `Admin*Screen`, `Checkout/Orders*` |
| Task 5 – Optimization & UX: fast screen transitions, offline support, error handling | `handbagStore` (shared cache), `RemoteImage`, `ErrorBoundary`, `freezeOnBlur` |

## Prerequisites

- Node.js 18+ and npm
- MongoDB (local `mongodb://127.0.0.1:27017` or MongoDB Atlas)
- Expo Go on a phone (or an Android / iOS emulator)
- Optional: a Backblaze B2 bucket (admin image upload) and a Gemini API key (AI Stylist)

## Setup

Set up the **backend first**, then the app.

### 1. Backend (`Backend/`)

```bash
cd Backend
npm install
cp .env.example .env        # Windows PowerShell: Copy-Item .env.example .env
```

Edit **`Backend/.env`** (this exact location; it is git-ignored, never commit it):

| Variable | Required | Purpose |
|---|---|---|
| `PORT` | no | API port (default `5000`) |
| `MONGODB_URI` | yes | MongoDB connection string, e.g. `mongodb://127.0.0.1:27017/luxebag` |
| `JWT_SECRET` | yes | Long random secret used to sign login tokens |
| `JWT_EXPIRES_IN` | no | Token lifetime (default `7d`) |
| `B2_APPLICATION_KEY_ID`, `B2_APPLICATION_KEY`, `B2_BUCKET_NAME`, `B2_ENDPOINT`, `B2_PUBLIC_URL` | for image upload | Backblaze B2 bucket used for product images |
| `GEMINI_API_KEY` | for AI Stylist | Gemini API key (server side only) |
| `GEMINI_MODEL` | no | Main Gemini model (default `gemini-3.8-flash`) |
| `GEMINI_FALLBACK_MODELS` | no | Comma-separated models tried when the main model is overloaded |

Generate a strong secret with:
`node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"`

Seed data, then start the API:

```bash
npm run seed                # creates the two development accounts (see below)
npm run seed:feedbacks      # optional: sample customer reviews for every published product
npm run dev                 # or: npm start
```

Verify it is running: open `http://localhost:5000/api/health` (database state) and `http://localhost:5000/api-docs`
(Swagger documentation).

Product catalog: create products in the app under **Admin → Products**, or run `node scripts/add-men-sports-office-bags.js`
to add extra men's, sports, and office sample bags.

Development accounts created by `npm run seed` (change these before deploying anywhere public):

| Role | Email | Password |
|---|---|---|
| Admin | `admin@luxebag.com` | `Admin@123` |
| Customer | `customer@luxebag.com` | `Customer@123` |

More backend details: [Backend/README.md](Backend/README.md).

### 2. Expo app (repository root)

```bash
npm install
npx expo install --check        # synchronize Expo library versions
```

Create `.env` in the repository root (copy `.env.example`) and set **one** variable:

```bash
EXPO_PUBLIC_BACKEND_URL=http://YOUR_COMPUTER_LAN_IP:5000
```

- In Expo Go, do **not** use `localhost`: it refers to the phone. Use the computer's LAN IPv4 address
  (for example `http://192.168.1.25:5000`) and keep the phone and computer on the same Wi-Fi network.
- Your IP changes when you switch networks, so update this value (and restart Expo) when the app cannot connect.
- On Windows, allow port `5000` through the firewall if the phone still cannot reach the backend.
- Any variable starting with `EXPO_PUBLIC_` is bundled into the app. **Never** put the Gemini key or any other secret there.
- `.env.example` may still list `EXPO_PUBLIC_API_URL` and `EXPO_PUBLIC_GEMINI_API_KEY`. They are leftovers from the old
  MockAPI version and are not used by the app; you can delete them.

Run the app (restart with `-c` whenever `.env` changes):

```bash
npx expo start -c
```

## AI Stylist

The app sends the shopper's request and a compact catalog to `POST /api/ai/stylist`. The backend asks Gemini (with a
structured JSON schema) to pick products from that catalog, and the app only displays picks whose ids exist in the real catalog.

If the main model is overloaded (HTTP 503), the backend retries once and then falls through the models listed in
`GEMINI_FALLBACK_MODELS`. The total wait stays under the app's 30 second timeout.

| Symptom | Likely cause and fix |
|---|---|
| "The AI Stylist is not configured on the Backend" | `GEMINI_API_KEY` is empty. It must be in `Backend/.env`; restart the backend after editing. |
| "The Backend could not authenticate with Gemini" | The key is wrong, revoked, or restricted. Create a new key. |
| "Gemini is having trouble right now" | Google is overloaded or the request failed. Check the backend terminal for a `Gemini API error ...` line, then try again. |
| Request limit message | Gemini quota reached. Wait, or use a key with a higher quota. |

## Project Structure

```text
src/
  screens/      screens (customer and Admin*)
  components/   reusable components (product cards, filters, charts, dialogs, etc.)
  navigation/   AppNavigator (based on login state), AdminTabs
  services/     API calls and business logic: api, userService, authStore, authToken, handbagStore, cartService,
                favoriteService, orderService, adminService, reviewService, promotionService, geminiService
  hooks/        useAuth, useHandbags, useCart, useFavorites, useAdminUsers
  utils/        pure utility functions: catalog (pricing/inventory), orders, coupons, filters, feedback,
                admin (reports), validation
Backend/
  src/          Express app: config, controllers, middleware, models (Mongoose), routes
  scripts/      seed-mongodb.js, seed-feedbacks.js, add-men-sports-office-bags.js
```

### Backend API at a glance

| Prefix | Purpose |
|---|---|
| `/api/auth` | register, login, current account |
| `/api/products` | published catalog (with reviews attached) |
| `/api/products/:productId/reviews` | list, write, and delete the signed-in customer's review |
| `/api/cart`, `/api/favorites` | per-account cart and favorites |
| `/api/orders` | create, list, cancel, and request a return for the signed-in customer's orders |
| `/api/coupons` | list the discount codes currently available to customers |
| `/api/ai/stylist` | AI Stylist (Gemini) |
| `/api/admin/*` | products, image upload, bulk discounts, orders, returns, customers, reviews, coupons (admin JWT required) |

## Design Decisions

- **Backend as the source of truth**: accounts, catalog, carts, favorites, orders, reviews, and coupons live in MongoDB.
  The app keeps a local cache (AsyncStorage) so content appears immediately and browsing still works offline.
- **Real authentication**: passwords are hashed with bcrypt on the server and sessions use JWT bearer tokens. Role checks
  (customer / admin) are enforced by the API, not only by the UI.
- **Shared data store** (`handbagStore` + `useSyncExternalStore`): all screens read the same product data; it refreshes in
  the background when returning to a screen.
- **Role-based navigation**: `AppNavigator` only registers screens the current user may access (guest / customer / admin).
  The interface updates automatically after login.
- **Account-specific data**: cart and favorites are synced per account; switching accounts switches to that account's data.
- **Safe checkout**: stock is reserved with an atomic conditional update, so concurrent orders cannot oversell an item;
  coupon usage is also incremented atomically, and both are rolled back if the order cannot be saved. Each order stores a
  **snapshot** of products and prices at purchase time. Shipping is $15, free from a $500 subtotal.
- **Pricing**: `cost` is always the current selling price. A bulk discount is either **real** (`cost` is lowered and the
  original price is kept in `originalCost`) or **display-only** (`cost` stays the same and only the "% off" label and
  struck-through price are shown). Coupons apply an additional discount at checkout.
- **Reviews**: only customers with a delivered order for the item can review it (one review per customer per product).
  Admins can hide or delete reviews; hidden reviews disappear for customers and are excluded from the average rating.

## Known Limitations

- Payments and refunds are **simulated**: only statuses are recorded and there is no payment gateway. Returns apply to the
  whole order; partial returns are not supported.
- Email verification is not enabled yet.
- The API currently allows any CORS origin (`*`). Restrict it before a public deployment.
- `Backend/scripts/seed-mongodb.js` predates the current models. Rely on it for the two development accounts only; it also
  writes sample documents in an older shape that the API does not use.
- Keep `Backend/.env` out of git and rotate any key that has ever been committed or shared.

## Testing

The files in `tests/` (`node tests/run.js`) were written for the earlier MockAPI version of the app and mock its services.
They have **not** been updated for the Express backend, and the logic tests currently fail. Treat them as legacy until
they are rewritten against the new services.

For now, verify changes manually using the flow in [DEMO.md](DEMO.md) on a real device, and use `/api-docs` or
`GET /api/health` to check the backend.

## Additional Documentation

- [DEMO.md](DEMO.md): demo script and frequently asked questions for the project defense.
- [Backend/README.md](Backend/README.md): backend structure, endpoints, and seeding.
