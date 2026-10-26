# LuxeBag

A branded handbag shopping app built with **React Native + Expo**, with **two roles**: customers and administrators.
There is no dedicated server: data is stored on [MockAPI](https://mockapi.io), while the cart, favorites, and login session are stored locally using AsyncStorage.

## Features

**Customers**: browse handbags by brand · advanced search, filtering, and sorting · product details with star ratings ·
favorites (stored locally and separated by account) · sign up / sign in · shopping cart · shipping addresses · discount coupons · place orders ·
track and cancel orders · returns within 7 days · write reviews (only after receiving an order) · AI Stylist (Gemini) · profile and avatar.

**Administrators**: dashboard · product CRUD (draft / published / archived), inventory, bulk discounts · order management and status updates ·
approve / reject returns · customer management (lock / unlock accounts) · review moderation · discount coupons · sales reports with charts ·
bulk renaming of brands / categories.

### Assignment Requirements Mapping

| Requirement | Implementation |
|---|---|
| Task 1 – UI & navigation: home screen organized by brand, `percentOff` displayed as a percentage, gender icon, descending price sort, Bottom Tabs | `HomeScreen`, `HandbagCard`, `AppNavigator` (floating tab bar) |
| Task 2 – Details & feedback: stars, comments, grouping by star rating | `DetailScreen`, `FeedbackSection`, `utils/feedback.js` |
| Task 3 – Favorites with AsyncStorage: add / remove / view / search | `services/favoriteService.js`, `FavouritesScreen`, `SearchScreen` |
| Task 4 – Advanced features: Gemini AI, Image Picker, administration, cart, orders | `StylistScreen`, `ProfileScreen`, `Admin*Screen`, `Checkout/Orders*` |
| Task 5 – Optimization & UX: fast screen transitions, offline support, error handling | `handbagStore` (shared cache), `RemoteImage`, `ErrorBoundary`, `freezeOnBlur` |

## Setup

Requires Node.js 18+ and Expo Go (or an emulator).

1. **Install dependencies**
   ```bash
   npm install
   npx expo install --check        # synchronize Expo library versions
   ```
   Libraries used by the source code: `@react-navigation/{native,native-stack,bottom-tabs}`, `react-native-screens`,
   `react-native-safe-area-context`, `@react-native-async-storage/async-storage`, `@expo/vector-icons`,
   `expo-image`, `expo-image-picker`, `expo-haptics`, `expo-linear-gradient`, `expo-crypto`, `expo-file-system`.
   If any are missing, run `npx expo install <package-name>`.

2. **Create MockAPI** (free plan, 2 resources): create `handbags` and `users` with the fields specified in [docs/mockapi-schema.md](docs/mockapi-schema.md),
   then import the 14 sample handbags from the assignment into `handbags`.

3. **Configure `.env`**: copy `.env.example` to `.env` and set `EXPO_PUBLIC_API_URL` (and `EXPO_PUBLIC_GEMINI_API_KEY` if using AI Stylist).
   Add `.env` to `.gitignore`.
   When running in Expo Go, do not use `localhost` for the backend URL:
   `localhost` refers to the phone. Use the computer's LAN IPv4 address,
   such as `http://192.168.1.25:5000`, and keep the phone and computer on the
   same Wi-Fi network. Ensure the backend is running and allow port `5000`
   through the Windows firewall if the phone still cannot connect.

4. **Seed initial data**
   ```bash
   node scripts/seed-stock.js                                       # inventory and product statuses
   node scripts/seed-feedbacks.js                                   # sample reviews (optional)
   node scripts/seed-admin.js admin@luxebag.com Admin@123 "Store Admin"   # admin account
   ```

5. **Check the configuration**: run `node scripts/check-setup.js` (read-only; reports ✓ / ! / ✗ along with suggested fixes).

6. **Run the app**: `npx expo start -c`

Demo account: admin `admin@luxebag.com` / `Admin@123`; customers can register in the app.

## Project Structure

```text
src/
  screens/      screens (customer and Admin*)
  components/   reusable components (product cards, filters, charts, dialogs, etc.)
  navigation/   AppNavigator (based on login state), AdminTabs
  services/     API calls and business logic: api, userService, authStore, handbagStore, cartService,
                favoriteService, orderService, adminService, reviewService, promotionService, geminiService
  hooks/        useAuth, useHandbags, useCart, useFavorites, useAdminUsers
  utils/        pure utility functions: catalog (pricing/inventory), orders, coupons, filters, feedback,
                admin (reports), validation
scripts/        seed-*.js, check-setup.js
tests/          logic and UI tests (node tests/run.js)
docs/           mockapi-schema.md, phases/ (notes and checklists for each development phase)
```

## Design Decisions

- **Shared data store** (`handbagStore` + `useSyncExternalStore`): all screens use the same data source, with a local cache so content appears immediately when the app opens and remains available offline; data refreshes in the background when returning to a screen.
- **Role-based navigation**: `AppNavigator` only registers screens the current user is allowed to access (guest / customer / admin). The interface updates automatically after login.
- **Account-specific data**: the cart, favorites, and avatar are stored locally and separately for each account; switching accounts switches to that account's data.
- **Only 2 resources**: orders, addresses, reviews, and discount coupons are nested in arrays within `users` / `handbags`. Every write operation fetches the latest record before writing it back.
- **As-safe-as-possible checkout**: re-check the latest inventory and price → deduct stock → save the order; if saving the order fails, restore the stock. Each order stores a **snapshot** of the products and prices at the time of purchase.
- **Pricing**: `cost` is the selling price; `percentOff` is only a display label (as specified by the assignment data). Actual discounts are applied through discount coupons. To change this behavior, update `unitPrice()` in `utils/catalog.js` **and** any places that display `cost` directly.

## Known Limitations (Recommended for the Report)

- MockAPI **does not provide real authentication**: login, password verification, and role checks run on the app side (passwords are hashed using SHA-256 with a salt). Anyone who knows the API URL can read and write the data.
- **No transactions**: if two users buy the last item at the same time, or a customer and an admin edit the same account, the last write wins; discount coupon usage may exceed the one-use limit.
- Payments and refunds are **simulated** (only statuses are recorded; there is no payment gateway). Returns apply to the entire order; partial returns are not supported.
- `EXPO_PUBLIC_GEMINI_API_KEY` is bundled into the app and therefore cannot be kept secret: set usage limits for the key and do not commit `.env`.
- AI Stylist uses the Gemini Interactions API (currently in beta). If Google changes the model name, set `EXPO_PUBLIC_GEMINI_MODEL` in `.env`.

## Testing

```bash
npm i -D esbuild react-test-renderer@<matching-react-version>
node tests/run.js          # logic + UI tests (a few seconds; no network required)
```

The test suite includes 4 logic test groups (login, purchasing, administration, and reviews / returns / discount coupons / reports) and 82 UI checks
(rendering each screen and simulating interactions with a mocked MockAPI). These tests do not replace testing the app on a physical device.
Add `tests/.out` to `.gitignore`.

## Additional Documentation

- [DEMO.md](DEMO.md): demo script and frequently asked questions for the project defense.
- [docs/mockapi-schema.md](docs/mockapi-schema.md): data schema.
- [docs/phases/](docs/phases): notes and checklists for each development phase.
