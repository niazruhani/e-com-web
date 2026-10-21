# Dhaka Form

Dhaka Form is a Next.js 16 / React 19 storefront and an in-progress e-commerce foundation. It includes a server-rendered catalog, Better Auth, PostgreSQL/Prisma models, protected staff routes, COD and hosted SSLCommerz order flows, and local-storage guest cart/wishlist UX. It is **not yet ready to accept live orders**: product upload, customer address management, returns/refunds, coupons, content administration, operational notifications, and production end-to-end coverage remain incomplete.

## Technology

- Next.js App Router, React 19, TypeScript, Zod
- PostgreSQL with Prisma 6
- Better Auth for customer sessions and email verification/password reset
- Hosted SSLCommerz checkout with server-side transaction validation
- Resend-compatible email adapter for auth messages
- Vitest, ESLint, and TypeScript checks

Money values are integer paisa. The browser cart is for convenience/display only; the server reloads current product prices and stock before creating an order. Do not treat demo merchandising, descriptions, ratings, Unsplash photos, delivery charges, tax, or policy text as verified business facts.

## Local setup

Requirements: Node.js 20.9 or newer and npm.

```bash
npm ci
cp .env.example .env.local
npm run dev
```

The storefront can run without secrets. In development, when there is no configured database, it shows sample products. Sample products and Unsplash images must not be used in a production catalog.

To use the database-backed features, configure `DATABASE_URL` for PostgreSQL and `AUTH_SECRET` (at least 32 characters), then run:

```bash
npm run db:generate
npm run db:migrate
```

`db:migrate` is for development. Production/staging releases should apply reviewed migrations with `npm run db:deploy`. The development-only seed is run with `npm run db:seed`; it must never be used to populate production. To provision staff access, first create and verify the user's account, then run `npm run admin:role -- user@example.com admin`. Review `scripts/set-role.ts` before use; roles are checked on the server and there is no default admin account.

## Environment configuration

See [.env.example](./.env.example). Important settings:

- `DATABASE_URL`, `AUTH_SECRET`, and canonical `AUTH_URL` enable persisted auth and checkout.
- `NEXT_PUBLIC_SITE_URL` is the public canonical origin used for metadata and sitemap links.
- Checkout remains disabled until delivery fees, free-delivery threshold, tax basis points, support contact, and reviewed policies are configured (`BUSINESS_POLICIES_CONFIRMED=true`). Amounts are integer paisa; tax is basis points. Confirm these values with the business and legal owner; do not infer or copy demo values.
- For SSLCommerz, set `SSLCOMMERZ_MODE=sandbox` first, plus merchant credentials. Only switch to `production` after merchant approval and a successful sandbox/IPN validation. Callback URLs must be publicly reachable over HTTPS.
- `EMAIL_API_KEY` and `EMAIL_FROM` configure the Resend-compatible auth email sender. Auth verification and password-reset messages fail explicitly if email is not configured. Order/shipping/return email notifications and a durable delivery queue are not implemented.
- Set `CRON_SECRET` and schedule `POST /api/operations/release-reservations` to release expired stock reservations. The endpoint requires a bearer token. Configure `CLIENT_IP_HEADER` only for a header that the trusted ingress proxy overwrites; never trust a client-supplied IP header.
- `S3_*` settings are placeholders only; no S3 upload adapter or image-upload UI is implemented. Product images currently use URLs and a configured allowed host.

Never expose server secrets with a `NEXT_PUBLIC_` prefix or commit credentials. Use separate secret stores, databases, payment credentials, and origins for development, staging, and production.

## Available flows

- Server-rendered product/category/search pages query active database catalog records. With no database in development, sample catalog content is shown; production queries exclude demo products.
- Guest cart, wishlist, and recently viewed items are stored in the browser. Their product snapshots are display-only and do not authorize a price or stock level.
- Better Auth-backed sign-up/sign-in, email verification, password reset, and customer-owned order history/detail pages.
- Staff dashboard, catalog/inventory mutations, order status updates, audit records, and role/permission checks.
- COD orders and a hosted SSLCommerz flow. Prices, totals, delivery, and tax are calculated server-side; inventory reservations and order creation are transactional. Browser redirects are not considered payment proof. SSLCommerz callbacks are validated server-to-server.
- Checkout and online payment intentionally fail closed if required database, merchant, delivery, contact, or policy configuration is missing.

## Not implemented / launch blockers

- Address book/profile CRUD, persistent server-side cart, cross-device sync, and guest-cart merge on sign-in.
- Product editing/archive, complete variant management, S3-compatible image uploads, category administration, and full catalog filtering/pagination.
- Coupon validation/management, returns/refunds processing, shipment/carrier integration, review submission/moderation, content/policy CMS, contact form, newsletter consent/double opt-in, and order lifecycle email notifications.
- A durable notification/job queue, analytics consent controls, customer data export/deletion, and a complete operational admin/RBAC management UI.
- PostgreSQL-backed integration tests, payment-provider sandbox tests, browser E2E/accessibility coverage, and deployment-specific backup/restore/rollback verification.
- Verified legal policies, delivery/tax/refund rules, support contact, real catalog/images, and merchant-approved checkout configuration.

Do not launch live sales until owners have supplied and reviewed those business rules, the remaining workflows are implemented, backups/restore and monitoring are exercised, and production credentials are configured. This repository does not claim that an unimplemented flow has succeeded.

## Validation

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm audit --audit-level=high
```

Current unit tests cover permission/order-state rules and integer-paisa pricing. They do not replace database, provider, or browser integration tests.
# e-com-web
