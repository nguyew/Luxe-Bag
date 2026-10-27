# Demo script (≈ 10 minutes)

## Before the demo (at least 30 minutes ahead)

- [ ] Start **MongoDB**, then the backend: `cd Backend && npm run dev`. Open `http://<LAN IP>:5000/api/health` in the phone's browser; it should report the database as connected.
- [ ] `EXPO_PUBLIC_BACKEND_URL` in the root `.env` matches your computer's current LAN IP (it changes between networks). Then run `npx expo start -c`.
- [ ] Seed data: `npm run seed` and `npm run seed:feedbacks` (inside `Backend/`). Make sure the catalog has published products.
- [ ] Open the app once while online so the catalog is cached (the app still works offline with saved data if the demo-room network is weak).
- [ ] Prepare **2 devices / 2 windows**: one signed in as admin (`admin@luxebag.com` / `Admin@123`), one as the customer (or sign out and in as needed).
- [ ] In **Admin → Products**, make sure each product has `stock` ≥ 3, and set one product to `stock = 1` to show the stock limit (only one unit can be added to the cart). Set another to `0` to show the "Sold out" label.
- [ ] Create the coupon `SAVE10` (10%, minimum order $100) in **Admin → Discount codes**.
- [ ] Prepare one customer account that already has a **Delivered** order (so the review and return demos do not require waiting). `customer@luxebag.com` works if you move one of its orders to Delivered.
- [ ] Send one AI Stylist request yourself to confirm Gemini responds (`GEMINI_API_KEY` is set in `Backend/.env`).
- [ ] Charge the phone, turn off notifications, and raise the screen brightness.

## Demo flow

| # | Role | Action | Talking point |
|---|---|---|---|
| 1 | Customer | Open Home → tap a brand to filter; point out the % off label, gender icon, and descending price order | Meets Task 1; data comes from our own Express + MongoDB API |
| 2 | Customer | Search → filters (category + price range + sorting) | Advanced filtering with a live result count |
| 3 | Customer | Open Detail → read feedback grouped by stars → favorite the product (heart) | Favorites use AsyncStorage for guests and sync to the account after sign-in (Task 3) |
| 4 | Customer | Tap Add to bag while signed out → redirected to Login | Guests can browse freely; an account is needed to buy |
| 5 | Customer | Register → add 2 items to the cart → open Cart (badge shows the count) | The cart is per account and synced to the backend |
| 6 | Customer | Checkout: add an address, enter `SAVE10`, choose COD, Place order | Stock is checked when ordering, coupon applied, $15 shipping (free from $500) |
| 7 | Admin | Dashboard shows "Pending orders" increase → Orders → open the order → Confirm → Shipping → Delivered | Admin controls the order status |
| 8 | Customer | My orders shows the new status; once Confirmed, the Cancel button disappears | Data stays in sync through the API |
| 9 | Customer | Detail of the item just received → Write a review | Only customers who received the item can review it (enforced by the backend) |
| 10 | Admin | Review moderation → hide the review | The customer no longer sees it and the average rating changes |
| 11 | Customer | On the delivered order → Request a return | 7-day return process |
| 12 | Admin | Dashboard "Return requests" → approve (choose whether to restock) | Refund is simulated; stock is added back when restocking is chosen |
| 13 | Admin | Products → add a product as Draft → switch it to Published | Drafts are hidden from customers |
| 14 | Admin | Sales report → switch the period between 7 / 30 / 90 days | Revenue chart and top products |
| 15 | Customer | (if time allows) AI Stylist: "a red bag for a party" | Gemini picks from the real catalog (the app ignores any id that is not in it); the backend falls back to another model if one is overloaded |
| 16 | Both | Turn on airplane mode → reopen the app | Offline: previously loaded data is still browsable |

If you are short on time, skip steps 2, 10, 13, and 15.

## Frequently asked questions (project defense)

**Why a separate backend instead of a mock API?** Real authentication and server-side rules need a server. The Express API
hashes passwords with bcrypt, issues JWT tokens, checks roles, and enforces business rules (stock, coupons, who may review)
so they cannot be bypassed by editing the app. Data is stored in MongoDB.

**How are passwords and sessions secured?** Passwords are hashed with bcrypt on the server and never stored in plain text.
The app keeps a JWT and sends it as a bearer token; admin endpoints reject non-admin tokens.

**What happens if two people buy the last item at the same time?** Stock is reserved with an atomic conditional update
(`stock >= quantity`), so only one order can take the last unit and the other receives an out-of-stock response. If saving
an order fails, the reserved stock and coupon use are rolled back.

**Why does `percentOff` sometimes change the price and sometimes not?** `cost` is always the selling price. Admins can apply a
**real** discount (the price is lowered and the original price is kept) or a **display-only** discount (only the "% off"
label and original price are shown). Coupons give an extra discount at checkout.

**Where is the Gemini API key kept?** Only in `Backend/.env`. The app calls our backend, which calls Gemini, so the key is
never bundled into the app. If the main model is busy, the backend retries and uses fallback models.

**Is the payment real?** No. COD and the "demo card" only record a status. Refunds also only set the status to `refunded`.

**Does the app work offline?** Browsing does: the product list is saved on the device and shown immediately when the app
opens. Placing orders and other writes need a connection.

**How was quality checked?** Mainly by manual testing of the full flow above on a real device. The automated tests in
`tests/` were written for the earlier MockAPI version and need to be rewritten for the Express backend; we list this as a
known limitation.

## If something goes wrong during the demo

| Problem | Quick fix |
|---|---|
| App cannot connect / endless loading | Check that the backend is running and the phone is on the same Wi-Fi. Confirm `EXPO_PUBLIC_BACKEND_URL` has the computer's current IP, then restart with `npx expo start -c`. |
| No network | Explain this is offline mode; switch to browsing and favorites |
| Blank screen | Shake the device → Reload; if it persists, run `npx expo start -c` |
| An order does not show on the admin side | Pull down to refresh (admin data is cached for 15 seconds) |
| AI Stylist shows "not configured" | `GEMINI_API_KEY` is missing from `Backend/.env`; add it and restart the backend |
| AI Stylist shows "Gemini is having trouble" | Google is busy. Tap "Try again" once; if it still fails, skip this step and continue with the rest |
| Login fails for a seeded account | Run `npm run seed` again in `Backend/`, then retry |