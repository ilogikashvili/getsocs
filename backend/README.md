# Backend Server Documentation

## Overview

This backend is a Node.js + Express server for a marketplace platform. It uses a JSON file as storage (`db.json`) and exposes a collection of REST APIs under the `/api` prefix.

Key features:
- User authentication and registration
- Product listing and approval workflow
- Transactions, escrow flow, and chat support
- Membership tiers, add-ons, badges, and bidding
- Admin and escrow role controls
- Swagger UI documentation at `/api-docs`
- Uploaded images saved to `backend/server/uploads`

## Quick Start

```bash
cd backend/server
npm install
npm start
```

Or for development with auto-reload:

```bash
npm run dev
```

Then open:

- `http://localhost:3001/api-docs` for Swagger UI (local development)
- `http://localhost:3001/api/...` for API calls (local development)
- `https://getsocs.com/api-docs` for Swagger UI (production)
- `https://getsocs.com/api/...` for API calls (production)

## Environment

Supported environment variables:

- `PORT` — server port (default `3001`)
- `JWT_SECRET` — JWT signing secret (default `change-me-please`)

## Server Entry Point

- `server/server.js` is the application entry point.
- Static frontend files are served from `../client/build` when present.
- API routes are mounted under `/api/*`.
- Swagger UI is mounted at `/api-docs`.
- A default admin account is created when the DB is empty:
  - `username: admin`
  - `password: admin123`

## Data Store

Persistent data is stored in `backend/server/db.json` through:

- `backend/server/config/db.js`

The DB schema includes arrays such as:

- `users`
- `products`
- `comments`
- `transactions`
- `chats`
- `supportChats`
- `scanned_ids`
- `analytics`
- `memberships`
- `user_memberships`
- `addons`
- `user_addons`
- `badges`
- `user_badges`
- `escrow`

## Important Directories

- `server/` — backend application root
- `server/config/` — database and Swagger config
- `server/routes/` — Express route definitions
- `server/controllers/` — business logic handlers
- `server/services/` — shared services for membership, escrow, badges
- `server/middleware/` — auth and upload middleware
- `server/utils/` — OCR and profanity helpers
- `server/uploads/` — stored image uploads

## Middleware

### `authMiddleware.js`

- `auth` verifies JWT from `Authorization: Bearer <token>`
- `requireRole(...roles)` checks user role from DB

### `uploadMiddleware.js`

- Uses Multer to store uploaded images in `uploads/`
- Accepts only image MIME types
- Max file size: 25 MB

## Swagger

- Configuration file: `server/config/swagger.js`
- Swagger UI endpoint: `/api-docs`
- Route JSDoc comments are loaded from `server/routes/*.js`

## API Endpoints

### Authentication

Base path: `/api/auth`

- `POST /api/auth/register`
  - multipart/form-data
  - fields: `username`, `mobile`, `name`, `lastname`, `dateOfBirth`, `email`, `personalNo`, `password`
  - optional file: `idImage`
- `POST /api/auth/login`
  - application/json
  - fields: `username`, `password`
- `GET /api/auth/me`
  - requires auth

### Products

Base path: `/api/products`

- `GET /api/products`
  - public
- `GET /api/products/pending`
  - auth + role `escrow` or `admin`
- `GET /api/products/:id`
  - public
- `POST /api/products`
  - auth
  - multipart/form-data with at least 3 images in `images`
  - fields: `title`, `description`, `price`, `platform`, `followers`, `avgViews`, `topic`, `monetized`, `uploadSessionCode`
- `POST /api/products/:id/comment`
  - auth
  - body: `{ text }`
- `POST /api/products/:id/approve`
  - auth + role `escrow` or `admin`
  - body: `{ code }`
- `DELETE /api/products/:id`
  - auth + role `escrow` or `admin`

### Transactions

Base path: `/api/transactions`

- `POST /api/transactions/products/:id/buy`
  - auth
- `GET /api/transactions`
  - auth
- `GET /api/transactions/pending`
  - auth + role `escrow` or `admin`
- `GET /api/transactions/:id`
  - auth
- `POST /api/transactions/:id/confirm`
  - auth + role `escrow` or `admin`

### Chats

Base path: `/api/chats`

#### Direct chats

- `GET /api/chats/direct`
  - auth
- `GET /api/chats/direct/chat/:chatId`
  - auth
- `POST /api/chats/direct/chat/:chatId/message`
  - auth
  - body: `{ text }`
- `POST /api/chats/direct/:userId`
  - auth

#### Transaction chats

- `GET /api/chats/:txId`
  - auth
- `POST /api/chats/:txId/message`
  - auth
  - body: `{ text }`

#### Support chats

- `GET /api/chats/support/list/all`
  - auth
- `POST /api/chats/support/create`
  - auth
- `GET /api/chats/support/:chatId/get`
  - auth
- `POST /api/chats/support/:chatId/message`
  - auth
  - body: `{ text }`
- `POST /api/chats/support/:chatId/ban`
  - auth

### Admin

Base path: `/api/admin`

- `POST /api/admin/ban/:id`
  - auth + role `escrow` or `admin`
- `POST /api/admin/unban/:id`
  - auth + role `admin`
- `POST /api/admin/make-escrow/:id`
  - auth + role `admin`
- `POST /api/admin/remove-escrow/:id`
  - auth + role `admin`
- `POST /api/admin/ban-escrow/:id`
  - auth + role `admin`
- `GET /api/admin/users`
  - auth + role `admin` or `escrow`
- `GET /api/admin/escrows`
  - auth + role `admin`
- `GET /api/admin/stats`
  - auth + role `admin` or `escrow`
- `GET /api/admin/products`
  - auth + role `admin` or `escrow`
- `GET /api/admin/chats`
  - auth + role `admin` or `escrow`

### Meta

Base path: `/api/meta`

- `GET /api/meta/platforms`
  - public
  - returns: `platforms`, `tiers`, `topics`

### Escrow

Base path: `/api/escrow`

- `POST /api/escrow/initiate`
  - auth
  - body: `{ transactionId, buyerConfirmed, sellerConfirmed }`
- `GET /api/escrow/status/:transactionId`
  - auth
- `POST /api/escrow/buyer-release/:transactionId`
  - auth
- `POST /api/escrow/seller-release/:transactionId`
  - auth
- `POST /api/escrow/dispute/:transactionId`
  - auth
  - body: `{ reason }`

#### Escrow admin routes

- `POST /api/escrow/admin/complete/:transactionId`
  - auth + role `admin`
  - body: `{ adminNotes }`
- `POST /api/escrow/admin/refund/:transactionId`
  - auth + role `admin`
  - body: `{ reason }`
- `GET /api/escrow/admin/disputes`
  - auth + role `admin`
- `GET /api/escrow/admin/all`
  - auth + role `admin`
  - optional query: `?status=active|completed|disputed|refunded`

### Badges

Base path: `/api/badges`

- `GET /api/badges/all`
  - public
- `GET /api/badges/user/:userId`
  - public
- `GET /api/badges/stats/:userId`
  - public
- `GET /api/badges/leaderboard`
  - public
- `GET /api/badges/my-badges`
  - auth
- `POST /api/badges/check-awards`
  - auth
- `POST /api/badges/admin/award`
  - auth + role `admin`
  - body: `{ userId, badgeId }`

### Membership

Base path: `/api/membership`

- `GET /api/membership/tiers`
  - public
- `GET /api/membership/addons`
  - public
- `GET /api/membership/my-membership`
  - auth
- `GET /api/membership/membership/:userId`
  - auth
- `POST /api/membership/subscribe`
  - auth
  - body: `{ tierId, billingCycle }`
- `POST /api/membership/cancel`
  - auth
- `GET /api/membership/fee`
  - auth
- `POST /api/membership/addon/purchase`
  - auth
  - body: `{ addonId, value }`
- `GET /api/membership/addon/my-addons`
  - auth
- `GET /api/membership/addon/:userId`
  - auth
- `GET /api/membership/addon/color/:userId`
  - auth
- `GET /api/membership/admin/subscriptions`
  - auth + role `admin`
- `GET /api/membership/admin/revenue`
  - auth + role `admin`

### Bids

Base path: `/api/bids`

- `POST /api/bids/place`
  - auth
  - body: `{ listingId, bidAmount, message }`
- `GET /api/bids/listing/:listingId`
  - auth
- `GET /api/bids/my-bids`
  - auth
- `GET /api/bids/user/:userId`
  - auth
- `POST /api/bids/accept/:bidId`
  - auth
  - body: `{ sellerMessage }`
- `POST /api/bids/reject/:bidId`
  - auth
  - body: `{ reason }`
- `POST /api/bids/cancel/:bidId`
  - auth

## Notes

- All authenticated routes require `Authorization: Bearer <token>`.
- User roles used in the backend:
  - `user`
  - `escrow`
  - `admin`
- The server reads and writes `db.json` on every request.
- File uploads for products and ID scan images are stored in `backend/server/uploads`.
- If `client/build` exists, the backend serves frontend assets and falls back to `index.html` for non-API routes.

## How to extend

- Add route definitions in `server/routes/*.js`
- Add business logic in `server/controllers/*.js`
- Add shared logic in `server/services/*.js`
- Add data helpers in `server/config/db.js`
- Add middleware in `server/middleware/*.js`
- Add Swagger docs by adding JSDoc comments to routes and updating `server/config/swagger.js`
