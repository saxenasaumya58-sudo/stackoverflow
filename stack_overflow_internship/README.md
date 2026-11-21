# Commons — Community Q&A and Social Platform

Commons is a web app where people can ask questions, share posts, help other members, and earn reputation for useful contributions.

## Project summary

Members can create an account, join discussions, answer questions, vote, and track their reputation. The app also includes account security tools, language selection, subscriptions, and moderation features.

### Technology used

- Next.js App Router and React
- Tailwind CSS
- Node.js
- MongoDB with Mongoose
- SMTP email and Twilio SMS integrations
- Razorpay payments and Cloudinary image uploads

### Main features

- Community feed, questions, answers, comments, and votes
- Reputation points, privilege levels, transfers, and activity history
- Login device history, active sessions, and session revocation
- Language selection with OTP verification
- Optional paid subscriptions, image uploads, and admin moderation

## Requirements

- Node.js 20.19 or newer (or a supported current LTS release)
- npm
- MongoDB Atlas or another MongoDB replica set for account and community data
- SMTP credentials for email OTP and account emails
- Optional: Twilio for real SMS, Razorpay for payments, and Cloudinary for image uploads

## Run locally

1. Install Node.js 20.19 or newer and npm.
2. Install project packages: `npm ci`.
3. Copy the environment template: `Copy-Item .env.example .env.local` (PowerShell).
4. Add a MongoDB connection string and a private `JWT_SECRET` of at least 32 characters. Configure SMTP if you want to test email OTP.
5. Start the app with `npm run dev` and open the local URL printed by Next.js.
6. Check the production build with `npm run build`; run it locally with `npm start`.

For a fast Turbopack development server, run `npm run dev:fast`. If the development cache becomes stale, stop the server, run `npm run clean:next`, and restart it.

An unset MongoDB URI leaves the public interface and sample feed available, but database-backed endpoints return a configuration error. The sample feed is presentation-only; actions require a registered account and a configured database.

Unrecognized devices always require an emailed OTP, including in development. Configure SMTP before testing device verification; missing or failed email delivery blocks the login rather than exposing a test code.

## Environment and integrations

See `.env.example` for the complete key list. Never commit `.env`/`.env.local` or put private keys in `NEXT_PUBLIC_*` variables. `JWT_SECRET` signs the HttpOnly, SameSite=Lax session cookie. Sessions slide forward on authenticated activity and expire after the configured `SESSION_INACTIVITY_MS` window (defaults to 30 minutes; set to `60000` for a one-minute local test). Device verification uses `DEVICE_OTP_TTL_MS`, `DEVICE_CHALLENGE_TTL_MS`, and `DEVICE_OTP_MAX_ATTEMPTS`; remembered-device cookies use `TRUSTED_DEVICE_TTL_SECONDS`. Configured duration and attempt values must be positive integers. Set `TRUSTED_PROXY_IP_HEADER=true` only when your trusted reverse proxy sanitizes and sets `X-Forwarded-For`.

Razorpay orders are created in INR and verified server-side using the HMAC signature and a captured-payment lookup. On verification, the paid plan is activated for 30 days, a unique `INV-...` PDF invoice is stored, and a confirmation email with the plan, invoice, and renewal date is attempted. Test checkout with Razorpay test keys before switching to live keys.

## How to Test Payment

Use Razorpay test keys and this test card for payment testing only:

- Card: `5267 3181 8797 5449`
- Expiry: `12/30`
- CVV: `123`

Real cards and the `4242` card will fail because international payments are disabled without Razorpay approval.

Image uploads use a signed Cloudinary upload request. Configure an upload preset restricted to images and set an appropriate maximum file size in the Cloudinary dashboard.

## Task 4 — Language selection and OTP

Language changes require a signed-in account. The app offers English, Spanish, Hindi, Portuguese, Chinese, and French.

- **SMS OTP is in DEMO MODE for this project demonstration.** Sending real SMS can incur charges, so the demo does not rely on paid SMS delivery. Real SMS delivery can be configured with Twilio credentials.
- **French uses email OTP, not SMS.** When French is selected, the code is sent to the account's registered email through SMTP. With Gmail SMTP configured, it arrives in that Gmail inbox.
- The other five language options use the mobile OTP flow. A verified mobile number is required for this flow.

OTP codes expire and have limited verification attempts. Set up SMTP in `.env.local` to test French email verification. The Twilio variables in `.env.example` are only needed if real SMS delivery is intentionally configured.

## Development test OTP

The registration form includes a no-SMS test flow using `POST /api/send-otp` with `{ "mobile": "9876543210" }` and `POST /api/verify-otp` with the mobile number and four-digit code. The send endpoint returns the generated code in its `otp` response field for local testing. MongoDB stores only a bcrypt hash, and codes expire after five minutes, allow at most five attempts, and are consumed after successful verification. These test endpoints are disabled in production; mobile OTP verification is optional at signup, but a valid ten-digit mobile is required.

## Routes and features

- `/feed`: Mongo-backed server-rendered feed with paginated infinite loading, trending by likes and comments, hashtag filters, posts, image/code content, comments/replies, likes, follows, bookmarks, shares, and reports.
- `/questions` and `/questions/[id]`: browsable questions, answers, up/down votes, answer acceptance, and close-vote controls.
- `/subscription` and `/dashboard/subscription`: Free, Bronze, Silver, and Gold plan details, Razorpay checkout, active plan, renewal date, receipts, and invoice download.
- `/forgot-password`: once-per-24-hour reset limit and an 8-letter temporary password sent to the registered mobile; legacy accounts without a mobile number can add one during recovery.
- `/settings/language`: English, Spanish, Hindi, Portuguese, Chinese, and French; French changes use email OTP and the other languages use mobile OTP, with updates stored after successful verification.
- `/security/devices`: active session details and remote revocation. Unrecognized devices require email OTP in production; demo mode displays the code on the verification screen without sending email. Sign-in history is available at `/admin/security`.
- `/profile/[id]`: public reputation balance, activity and transfer history, privilege thresholds, and profile completion. Members with more than 50 points can transfer up to 50 points per transaction and 100 per rolling 24 hours.
- `/admin/reports`: moderation queue, content removal, repeat-offender suspension, and reputation deductions.
- `/login` and `/register`: account creation, bcrypt password hashes, trusted-device preference, and device verification.
- `/search`: basic search for all members and type/date filters for Bronze and higher.
- `/discover` and `/people`: trending tags/posts from engagement and a signed-in member directory with reputation and follow controls.
- `/api/questions`, `/api/questions/[id]`, `/api/questions/[id]/answers`, `/api/questions/[id]/accept`, `/api/vote`, and `/api/questions/[id]/close-vote`: question listing, answer/acceptance awards, vote deductions and milestones, and 250-point close-vote privilege.

## Reputation rules

Reputation events are written to `ReputationLog` and applied to the `User` balance: +5 for an answer, +10 for an accepted answer, +5 at five answer upvotes, +2 at ten question upvotes, +10 once for a complete profile (including its required mobile number), -2 per received downvote, -5 for deleting an answer, and -10 when a moderator removes a violating post. Unique event references make reward retries idempotent.

Commenting requires 50 reputation, editing one's own community posts requires 100, close votes require 250, and reporting inappropriate content requires 500. These thresholds are enforced by the API as well as exposed in the UI. Deleting a community post remains limited to its author. Admin pages and moderator actions require `User.role: "admin"`.

Reputation transfers require a balance above 50, are limited to 50 points per transaction and 100 points in a rolling 24-hour window, and store sender, receiver, amount, reason, status, and timestamps. MongoDB transactions are used when supported; standalone local MongoDB uses the same idempotent staged transfer and recovery flow without transaction sessions.

The automated Task 6 checks use fake in-memory users and do not connect to MongoDB. Run them with:

```powershell
node --test tests\task6-reputation-policy.test.mjs tests\task6-transfer-mock.test.mjs
```

The transfer mock demonstrates a 100/100 balance changing to 50/150 and records fake sender/receiver history. It is not evidence of a live MongoDB transfer.

## Admin setup

Register the first account, then promote its document in a trusted MongoDB shell:

```javascript
db.users.updateOne({ email: "admin@example.com" }, { $set: { role: "admin" } })
```

Admin APIs verify the role on every request. Do not expose an admin-role editor to public clients.

## Login security checks

Successful trusted-device sign-ins and new-device OTP verifications create `LoginLog` records with parsed browser, operating system, device type, IP, available request-geolocation fields, and timestamp. New devices require an emailed OTP; the optional remember-device choice is applied only after successful verification. Session JWTs are HttpOnly and SameSite=Lax, and each server-validated request must also present the device secret matching the server-side session hash. The active-session API lists and revokes only the signed-in user's sessions; admin login activity requires the admin role.

Run the database-free Task 5 checks with `node --test tests\\task5-mock.test.js tests\\task5-advanced-security-mock.test.mjs`. They use fake users and sessions only; they do not prove SMTP delivery or a live database integration.

## Deploy to Vercel

**Security gate (resolved):** the previous Next.js 14.2.35 dependency was in the vulnerable range reported by `npm audit --omit=dev`. This project now uses patched Next.js 16.4.6, with a matching ESLint config and refreshed lockfile. Both `npm audit --omit=dev` and `npm audit` reported zero vulnerabilities after the upgrade. Use Node.js 20.19.0 or newer, as required by the current toolchain. Next.js 16 still warns that React 18 and the `middleware.js` convention are deprecated; plan a React 19 and `proxy.js` migration before moving to Next.js 17, but these warnings did not block the current production build.

### Production deployment checklist

- [ ] Re-run `npm audit --omit=dev` and `npm audit` against the deployment lockfile and confirm both remain clear.
- [ ] Push the reviewed branch and import the project into the intended Vercel account/project.
- [ ] Add production variables in Vercel Project Settings using `.env.example` as the key list. Do not upload `.env.local` or commit real credentials.
- [ ] Set `MONGODB_URI` to the intended production MongoDB replica set; use TLS, a least-privilege database user, network allowlisting, and verified backups. Confirm the target database name before enabling production traffic.
- [ ] Generate a unique `JWT_SECRET` of at least 32 characters and a separate high-entropy `CRON_SECRET`. Never reuse development secrets.
- [ ] Set `DEMO_MODE=false`, `ALLOW_MOCK_DELIVERY=false`, and `TRUSTED_PROXY_IP_HEADER=false` unless a trusted proxy is configured to replace the relevant incoming header.
- [ ] Configure production SMTP for email OTP. Add Twilio credentials only if enabling real, potentially billable SMS delivery.
- [ ] Configure Cloudinary credentials and a restricted image-only upload preset; test upload authorization and size limits.
- [ ] Configure Razorpay test credentials and `RAZORPAY_WEBHOOK_SECRET` in staging; verify signed webhook handling, captured payments, invoice generation, and email delivery. Switch to live credentials only after acceptance.
- [ ] Configure the scheduled calls to `/api/cron/expire-subscriptions` and `/api/cron/reconcile-reputation-transfers` with `Authorization: Bearer <CRON_SECRET>`.
- [ ] Run focused tests (`node --test tests\\task6-reputation-policy.test.mjs tests\\task6-transfer-mock.test.mjs`), `npm run lint`, and `npm run build`; separately validate MongoDB transactions/recovery and end-to-end account flows in a disposable staging database.
- [ ] After deployment, smoke-test login/logout, OTP delivery, profile/reputation history, transfer limits/history, admin moderation, payments/webhooks, and cron authentication. Monitor application and provider logs.

The build command uses the Node.js runtime for MongoDB, Razorpay, mail, and cryptographic handlers. A mock transfer test is not a substitute for staging-database verification.

## Operational notes

- Cloudinary receives image files only from authenticated users; enforce upload limits and review policies in Cloudinary.
- Login history uses the request IP and User-Agent plus platform-provided geolocation when available. Missing values are recorded as `Unknown`; no third-party IP lookup is performed.
- SMS language OTP is in demo mode for this project demonstration. Real SMS delivery requires intentionally configuring Twilio and may incur charges; French language OTP uses SMTP email.
- Admin bootstrap, email/SMS provider credentials, and Razorpay live keys are deployment responsibilities and are intentionally not committed.
