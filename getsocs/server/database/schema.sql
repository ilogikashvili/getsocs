-- Getsocs MySQL 8+ schema
-- Creates a normalized persistence surface while retaining a JSON payload per row
-- for backward-compatible fields during the repository migration.
CREATE DATABASE IF NOT EXISTS `getsocs_db`
  CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
USE `getsocs_db`;

CREATE TABLE IF NOT EXISTS app_meta (
  id TINYINT UNSIGNED NOT NULL PRIMARY KEY,
  schema_version INT UNSIGNED NOT NULL DEFAULT 1,
  state_version BIGINT UNSIGNED NOT NULL DEFAULT 0,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB;
INSERT INTO app_meta (id) VALUES (1) ON DUPLICATE KEY UPDATE id=id;

CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  username VARCHAR(191) NULL,
  email VARCHAR(320) NULL,
  role VARCHAR(32) NULL,
  banned BOOLEAN NOT NULL DEFAULT FALSE,
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  buyer_verified BOOLEAN NOT NULL DEFAULT FALSE,
  token_version INT NOT NULL DEFAULT 0,
  created_at DATETIME(3) NULL,
  updated_at DATETIME(3) NULL,
  payload JSON NOT NULL,
  UNIQUE KEY uq_users_username (username),
  UNIQUE KEY uq_users_email (email),
  KEY idx_users_role (role),
  KEY idx_users_banned (banned)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  family_id VARCHAR(64) NOT NULL,
  parent_id VARCHAR(64) NULL,
  token_hash CHAR(64) NOT NULL,
  created_at DATETIME(3) NOT NULL,
  expires_at DATETIME(3) NOT NULL,
  used_at DATETIME(3) NULL,
  revoked_at DATETIME(3) NULL,
  UNIQUE KEY uq_refresh_tokens_hash (token_hash),
  KEY idx_refresh_tokens_user (user_id),
  KEY idx_refresh_tokens_family (family_id),
  KEY idx_refresh_tokens_expires (expires_at),
  CONSTRAINT fk_refresh_tokens_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS products (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  seller_id VARCHAR(64) NULL,
  code VARCHAR(128) NULL,
  platform VARCHAR(64) NULL,
  status VARCHAR(32) NULL,
  price DECIMAL(18,2) NULL,
  created_at DATETIME(3) NULL,
  payload JSON NOT NULL,
  UNIQUE KEY uq_products_code (code),
  KEY idx_products_seller (seller_id),
  KEY idx_products_status (status),
  KEY idx_products_platform_status (platform, status),
  CONSTRAINT fk_products_seller FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS comments (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  product_id VARCHAR(64) NULL,
  user_id VARCHAR(64) NULL,
  created_at DATETIME(3) NULL,
  payload JSON NOT NULL,
  KEY idx_comments_product (product_id),
  KEY idx_comments_user (user_id),
  CONSTRAINT fk_comments_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_comments_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS transactions (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  product_id VARCHAR(64) NULL,
  listing_id VARCHAR(64) NULL,
  buyer_id VARCHAR(64) NULL,
  seller_id VARCHAR(64) NULL,
  escrow_agent_id VARCHAR(64) NULL,
  status VARCHAR(32) NULL,
  stage VARCHAR(32) NULL,
  amount DECIMAL(18,2) NULL,
  created_at DATETIME(3) NULL,
  updated_at DATETIME(3) NULL,
  payload JSON NOT NULL,
  KEY idx_transactions_buyer (buyer_id),
  KEY idx_transactions_seller (seller_id),
  KEY idx_transactions_status (status),
  KEY idx_transactions_product (product_id),
  KEY idx_transactions_listing (listing_id),
  CONSTRAINT fk_transactions_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_transactions_buyer FOREIGN KEY (buyer_id) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_transactions_seller FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_transactions_escrow_agent FOREIGN KEY (escrow_agent_id) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS chats (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  transaction_id VARCHAR(64) NULL,
  chat_type VARCHAR(32) NULL,
  created_at DATETIME(3) NULL,
  payload JSON NOT NULL,
  KEY idx_chats_transaction (transaction_id),
  CONSTRAINT fk_chats_transaction FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS support_chats (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  user_id VARCHAR(64) NULL,
  assigned_to VARCHAR(64) NULL,
  status VARCHAR(32) NULL,
  created_at DATETIME(3) NULL,
  payload JSON NOT NULL,
  KEY idx_support_chats_user (user_id),
  KEY idx_support_chats_assigned (assigned_to),
  KEY idx_support_chats_status (status),
  CONSTRAINT fk_support_chats_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_support_chats_assigned FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS scanned_ids (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  user_id VARCHAR(64) NULL,
  status VARCHAR(32) NULL,
  created_at DATETIME(3) NULL,
  payload JSON NOT NULL,
  KEY idx_scanned_ids_user (user_id),
  KEY idx_scanned_ids_status (status),
  CONSTRAINT fk_scanned_ids_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS bids (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  listing_id VARCHAR(64) NULL,
  bidder_id VARCHAR(64) NULL,
  transaction_id VARCHAR(64) NULL,
  status VARCHAR(32) NULL,
  bid_amount DECIMAL(18,2) NULL,
  created_at DATETIME(3) NULL,
  payload JSON NOT NULL,
  KEY idx_bids_listing (listing_id),
  KEY idx_bids_bidder (bidder_id),
  KEY idx_bids_status (status),
  CONSTRAINT fk_bids_listing FOREIGN KEY (listing_id) REFERENCES products(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_bids_bidder FOREIGN KEY (bidder_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_bids_transaction FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS escrow (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  transaction_id VARCHAR(64) NOT NULL,
  status VARCHAR(32) NULL,
  started_at DATETIME(3) NULL,
  ends_at DATETIME(3) NULL,
  payload JSON NOT NULL,
  UNIQUE KEY uq_escrow_transaction (transaction_id),
  KEY idx_escrow_status (status),
  KEY idx_escrow_ends_at (ends_at),
  CONSTRAINT fk_escrow_transaction FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS notifications (
  id VARCHAR(128) NOT NULL PRIMARY KEY,
  user_id VARCHAR(64) NULL,
  unread BOOLEAN NOT NULL DEFAULT TRUE,
  notification_type VARCHAR(64) NULL,
  created_at DATETIME(3) NULL,
  payload JSON NOT NULL,
  KEY idx_notifications_user_unread (user_id, unread),
  CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS idempotency_keys (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  idem_key VARCHAR(191) NOT NULL,
  user_id VARCHAR(64) NULL,
  method VARCHAR(16) NULL,
  route VARCHAR(255) NULL,
  fingerprint CHAR(64) NULL,
  status_code SMALLINT UNSIGNED NULL,
  created_at DATETIME(3) NULL,
  expires_at DATETIME(3) NULL,
  payload JSON NOT NULL,
  UNIQUE KEY uq_idempotency_scope (idem_key, user_id, method, route),
  KEY idx_idempotency_expires (expires_at),
  CONSTRAINT fk_idempotency_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS reviews (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  target_id VARCHAR(64) NULL,
  author_id VARCHAR(64) NULL,
  transaction_id VARCHAR(64) NULL,
  review_type VARCHAR(32) NULL,
  rating TINYINT UNSIGNED NULL,
  created_at DATETIME(3) NULL,
  payload JSON NOT NULL,
  KEY idx_reviews_target (target_id, review_type),
  KEY idx_reviews_author (author_id),
  CONSTRAINT chk_reviews_rating CHECK (rating IS NULL OR (rating BETWEEN 1 AND 5)),
  CONSTRAINT fk_reviews_author FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_reviews_transaction FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS badges (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  name VARCHAR(191) NULL,
  payload JSON NOT NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS user_badges (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  badge_id VARCHAR(64) NOT NULL,
  earned_at DATETIME(3) NULL,
  visible BOOLEAN NOT NULL DEFAULT TRUE,
  payload JSON NOT NULL,
  UNIQUE KEY uq_user_badge (user_id, badge_id),
  KEY idx_user_badges_badge (badge_id),
  CONSTRAINT fk_user_badges_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_user_badges_badge FOREIGN KEY (badge_id) REFERENCES badges(id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS ad_spaces (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  created_by VARCHAR(64) NULL,
  position VARCHAR(64) NULL,
  price DECIMAL(18,2) NULL,
  created_at DATETIME(3) NULL,
  payload JSON NOT NULL,
  KEY idx_ad_spaces_position (position),
  CONSTRAINT fk_ad_spaces_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS banned_ips (
  ip VARCHAR(64) NOT NULL PRIMARY KEY,
  created_at DATETIME(3) NULL,
  payload JSON NOT NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS email_delete_blocks (
  email VARCHAR(320) NOT NULL PRIMARY KEY,
  blocked_until DATETIME(3) NULL,
  payload JSON NOT NULL,
  KEY idx_email_delete_blocks_until (blocked_until)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS memberships (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  name VARCHAR(191) NOT NULL,
  price DECIMAL(18,2) NOT NULL DEFAULT 0,
  platform_fee_reduction DECIMAL(8,6) NULL,
  payload JSON NOT NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS user_memberships (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  membership_tier_id VARCHAR(64) NOT NULL,
  status VARCHAR(32) NULL,
  start_date DATETIME(3) NULL,
  end_date DATETIME(3) NULL,
  amount DECIMAL(18,2) NULL,
  payload JSON NOT NULL,
  KEY idx_user_memberships_user_status (user_id, status),
  KEY idx_user_memberships_tier (membership_tier_id),
  CONSTRAINT fk_user_memberships_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_user_memberships_tier FOREIGN KEY (membership_tier_id) REFERENCES memberships(id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS addons (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  name VARCHAR(191) NOT NULL,
  price DECIMAL(18,2) NOT NULL DEFAULT 0,
  duration VARCHAR(64) NULL,
  payload JSON NOT NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS user_addons (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  addon_id VARCHAR(64) NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  purchased_at DATETIME(3) NULL,
  payload JSON NOT NULL,
  KEY idx_user_addons_user_active (user_id, active),
  CONSTRAINT fk_user_addons_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_user_addons_addon FOREIGN KEY (addon_id) REFERENCES addons(id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS analytics (
  id TINYINT UNSIGNED NOT NULL PRIMARY KEY,
  page_views BIGINT UNSIGNED NOT NULL DEFAULT 0,
  payload JSON NOT NULL
) ENGINE=InnoDB;
INSERT INTO analytics (id, page_views, payload) VALUES (1, 0, JSON_OBJECT('pageViews', 0))
  ON DUPLICATE KEY UPDATE id=id;
