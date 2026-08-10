# Gannamasti production flow

## Customer

1. A customer creates one account with an Indian mobile number, password, name, verified SMS code, and structured address.
2. Future login uses only mobile number and password. Forgot-password verifies a new SMS challenge before changing the password on the same Supabase user.
3. Menu and add-on prices displayed in the browser are informational. `/api/quote` reloads current menu, fees, discount, opening hours, and the 20 km PostGIS service radius on the server.
4. `/api/create-order` re-quotes the cart, snapshots every amount and address field, and uses a client UUID to prevent duplicate orders.
5. COD enters `awaiting_acceptance`. Online payment enters `awaiting_payment` and can advance only after Razorpay signature, captured status, amount, currency, and gateway order are verified.
6. Customers can cancel an entire order or individual quantities before cafe acceptance. Refund calls are idempotent and reconciliation is preserved if the gateway succeeds before a database finalization error.
7. Completed orders can be reviewed. Receipts are generated on the server from immutable order-item and fee snapshots.

## Cafe and delivery

`awaiting_acceptance → accepted → preparing → ready`

- Takeaway and dine-in: `ready → completed` after counter handover.
- Delivery: admin assigns one approved, on-duty driver; driver confirms pickup; customer reveals a six-digit encrypted handover code only after food arrives; driver enters the code; then `picked_up → delivered`.
- Drivers cannot self-assign, disable duty with an active job, update another driver’s location, or complete a delivery without the code.

## Release order

1. Create a verified database backup.
2. Run `supabase/migrations/20260809120000_production_foundation.sql` against the Gannamasti project.
3. Run `node tests/live-supabase-security.mjs`; every table must report `READY`.
4. Deploy a Vercel preview and test signup, password reset, COD, Razorpay test payment, customer cancellation, admin preparation, driver assignment/GPS/handover, review, and receipt.
5. Confirm the Razorpay webhook points to `/api/webhook` and subscribes to captured, failed, refund, and dispute events.
6. Promote the tested deployment to production, then monitor payment events and orders requiring reconciliation.

Never apply the migration to the live database before a recoverable backup. The migration changes order write permissions, so it must be coordinated with the new application deployment.
