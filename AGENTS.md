# LuxeBag Project Guidelines

## Project Overview

LuxeBag is a mobile-first handbag browsing and shopping application built with
Expo and React Native. It is a plain JavaScript project using Expo SDK 57,
React 19, and React Native 0.86. The New Architecture is enabled in
`app.json`.

The product is planned for two roles:

- **Customer**: browse and search public products, manage an account,
  favourites, cart, orders, payments, reviews, and saved delivery addresses.
- **Admin**: use a protected administration area to manage customers, products,
  inventory, catalog metadata, orders, returns/refunds, reviews, promotions,
  sales reports, and account status.
- Admin: admin@luxebag.com / Admin@123
- Customer: customer@luxebag.com / Customer@123

Some customer and admin foundations already exist, but the roadmap below is
the source of truth for planned capabilities. Do not assume a listed feature
is complete merely because a related screen or service exists.

## Architecture

- `index.js` registers the root component; `App.js` provides the
  `NavigationContainer` and top-level `ErrorBoundary`.
- Navigation uses React Navigation, not Expo Router:
  `src/navigation/AppNavigator.js` owns the native stack, customer tabs,
  modal auth screens, search/detail screens, and the admin entry point.
- Screens belong in `src/screens/`; reusable UI belongs in `src/components/`;
  navigation configuration belongs in `src/navigation/`.
- Shared application logic belongs in `src/hooks/`, `src/services/`,
  `src/utils/`, and `src/constants/`. Keep route screens focused on
  presentation and orchestration.
- The API layer is in `src/services/api.js`. It reads
  `EXPO_PUBLIC_API_URL` and currently communicates with MockAPI resources.
  Preserve its explicit HTTP errors and request timeout behavior.
- Authentication is shared through `src/services/authStore.js` and
  `src/hooks/useAuth.js`. Keep customer/admin role checks centralized and
  never trust client-only role checks as real backend authorization.
- Favourites and profile data are account-scoped local data. Preserve
  ownership switching when users sign in, sign out, or change accounts.

## Expo and Native Development

Before using an Expo, EAS, or React Native API, check the installed major
version in `package.json` and consult the matching documentation:
`https://docs.expo.dev/versions/v57.0.0/`. Use
`https://docs.expo.dev/llms.txt` when the versioned documentation does not
answer the question.

This repository uses npm (`package-lock.json`), not Bun:

```bash
npm install
npx expo start
npx expo start --android
npx expo start --ios
npx expo start --web
npx expo-doctor
```

Use `npx expo install <package>` for Expo-compatible dependencies. Native
libraries require a development build; Expo Go alone may not include them.
The `ios/` and `android/` directories are generated and must not be created or
edited by hand. Configure native behavior in `app.json` or a config plugin.

There are currently no lint, test, or typecheck scripts configured in
`package.json`. Do not claim those checks passed unless tooling is added or a
working project command is available. For changes that affect runtime,
prefer the smallest available Expo validation and manually verify affected
flows when practical.

## Coding Conventions

- Use JavaScript consistent with the surrounding file; do not introduce
  TypeScript or a new state-management library without a clear requirement.
- Follow existing `StyleSheet.create()` and shared color conventions.
- Prioritize mobile performance: use `FlatList` for collections, stable keys,
  memoized/reusable components where useful, and avoid unnecessary renders.
- Preserve loading, empty, retry, and error states. Surface failures to users
  through the existing UI patterns rather than silently returning success-shaped
  fallback data.
- Validate and normalize user input at service boundaries. Do not store plain
  text passwords or expose private user fields to screens.
- Keep API and AsyncStorage data migrations backward-compatible when possible.
- Use accessible labels and states for interactive controls, and support both
  iOS and Android behavior.
- Keep user-facing copy consistent with the existing app language and
  localization approach.

## Environment

Set the API root in `.env` without a trailing resource path:

```env
EXPO_PUBLIC_API_URL=https://<your-project>.mockapi.io/api/v1
```

After changing `.env`, restart Metro with `npx expo start -c`. Never commit
credentials, tokens, or other secrets.

## Product Roadmap

### Customer (Khách hàng)

1. Register and sign in.
2. Edit their own personal profile.
3. View products that have been published.
4. Search and filter products.
5. Add and remove products from favourites.
6. Add products to the cart.
7. Place orders.
8. Complete payments.
9. View their own orders.
10. Cancel orders that are eligible for cancellation.
11. Review products they have purchased.
12. Manage saved delivery addresses.

### Administrator (Quản trị viên)

1. Sign in through a protected administration area.
2. Manage customer accounts.
3. Create, edit, publish, archive, and delete products.
4. Manage product images.
5. Manage selling prices and discounts.
6. Manage inventory quantities.
7. Manage brands and product categories.
8. View and update all orders.
9. Approve return and refund requests.
10. Moderate product reviews.
11. Create and manage promotions.
12. View sales reports.
13. Disable customer accounts.

When implementing roadmap features, preserve role separation, ownership
boundaries, server/API validation, and clear loading/error states across every
affected screen and service.
