-- =============================================================
-- EazeeBooks / Invoice Parser — reference schema (structure only)
--
-- Generated from local dev DB via: npm run db:snapshot
--
-- WARNING: This file contains "DROP TABLE IF EXISTS" statements.
-- It is a REFERENCE / fresh-install snapshot only.
--   - DO NOT run this against the production database — it will
--     silently DELETE all existing tables and data.
--   - To evolve the PRODUCTION schema, add a new file under
--     migrations/ instead (see migrations/README.md) and let
--     `npm run migrate` (run automatically by scripts/deploy.sh)
--     apply it safely, without touching existing data.
-- =============================================================

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;
DROP TABLE IF EXISTS `audit_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `audit_logs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int DEFAULT NULL,
  `company_id` int DEFAULT NULL,
  `action` varchar(255) DEFAULT NULL,
  `description` text,
  `ip_address` varchar(50) DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `customer_id` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_audit_logs_customer_id` (`customer_id`),
  KEY `idx_audit_logs_user_created` (`user_id`,`created_at`),
  KEY `fk_audit_logs_company` (`company_id`),
  CONSTRAINT `audit_logs_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_audit_logs_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`),
  CONSTRAINT `fk_audit_logs_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `bank_statement_transactions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `bank_statement_transactions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `bank_statement_id` int NOT NULL,
  `transaction_date` date DEFAULT NULL,
  `description` text,
  `credit` decimal(14,2) NOT NULL DEFAULT '0.00',
  `debit` decimal(14,2) NOT NULL DEFAULT '0.00',
  `available_balance` decimal(14,2) DEFAULT NULL,
  `reference_no` varchar(100) DEFAULT NULL,
  `page_number` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_bank_statement_transaction_statement` (`bank_statement_id`),
  KEY `idx_bank_statement_transactions_date` (`bank_statement_id`,`transaction_date`),
  CONSTRAINT `fk_bank_statement_transaction_statement` FOREIGN KEY (`bank_statement_id`) REFERENCES `bank_statements` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `bank_statements`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `bank_statements` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `company_id` int NOT NULL,
  `customer_id` int DEFAULT NULL,
  `original_filename` varchar(255) DEFAULT NULL,
  `image_path` text,
  `status` enum('PENDING','PROCESSED','FAILED') DEFAULT 'PROCESSED',
  `page_count` int DEFAULT NULL,
  `bank_name` varchar(255) DEFAULT NULL,
  `account_title` varchar(255) DEFAULT NULL,
  `account_number` varchar(100) DEFAULT NULL,
  `iban` varchar(50) DEFAULT NULL,
  `currency` varchar(20) DEFAULT NULL,
  `from_date` date DEFAULT NULL,
  `to_date` date DEFAULT NULL,
  `opening_balance` decimal(14,2) DEFAULT NULL,
  `closing_balance` decimal(14,2) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_bank_statement_user` (`user_id`),
  KEY `fk_bank_statement_client` (`customer_id`),
  KEY `idx_bank_statements_user_created` (`user_id`,`created_at`),
  KEY `fk_bank_statements_company` (`company_id`),
  CONSTRAINT `fk_bank_statement_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_bank_statement_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_bank_statements_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `companies`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `companies` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `legal_name` varchar(255) DEFAULT NULL,
  `owner_user_id` int NOT NULL,
  `status` enum('ACTIVE','INACTIVE') NOT NULL DEFAULT 'ACTIVE',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `address` text,
  `phone` varchar(30) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `trn` varchar(100) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_company_owner` (`owner_user_id`),
  CONSTRAINT `fk_company_owner` FOREIGN KEY (`owner_user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `company_memberships`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `company_memberships` (
  `id` int NOT NULL AUTO_INCREMENT,
  `company_id` int NOT NULL,
  `user_id` int NOT NULL,
  `role` enum('OWNER','FREELANCER','STAFF') NOT NULL DEFAULT 'STAFF',
  `status` enum('INVITED','ACTIVE','SUSPENDED','REMOVED') NOT NULL DEFAULT 'INVITED',
  `permissions` json DEFAULT NULL,
  `invited_by` int DEFAULT NULL,
  `invited_at` datetime DEFAULT NULL,
  `accepted_at` datetime DEFAULT NULL,
  `removed_at` datetime DEFAULT NULL,
  `last_active_at` datetime DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_company_membership` (`company_id`,`user_id`),
  KEY `fk_membership_user` (`user_id`),
  KEY `fk_membership_invited_by` (`invited_by`),
  CONSTRAINT `fk_membership_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_membership_invited_by` FOREIGN KEY (`invited_by`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_membership_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `customers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `customers` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `company_id` int NOT NULL,
  `company_name` varchar(255) NOT NULL,
  `contact_person` varchar(150) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `phone` varchar(30) DEFAULT NULL,
  `trn` varchar(100) DEFAULT NULL,
  `address` text,
  `country` varchar(100) DEFAULT NULL,
  `city` varchar(100) DEFAULT NULL,
  `notes` text,
  `status` enum('ACTIVE','INACTIVE') DEFAULT 'ACTIVE',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `salutation` varchar(20) DEFAULT NULL,
  `primary_contact_first_name` varchar(150) DEFAULT NULL,
  `primary_contact_last_name` varchar(150) DEFAULT NULL,
  `display_name` varchar(255) DEFAULT NULL,
  `customer_type` varchar(50) DEFAULT NULL,
  `mobile` varchar(30) DEFAULT NULL,
  `website` varchar(255) DEFAULT NULL,
  `department` varchar(150) DEFAULT NULL,
  `designation` varchar(150) DEFAULT NULL,
  `tax_treatment` varchar(50) DEFAULT NULL,
  `place_of_supply` varchar(100) DEFAULT NULL,
  `currency` varchar(20) DEFAULT NULL,
  `payment_terms` varchar(50) DEFAULT NULL,
  `opening_balance` decimal(14,2) DEFAULT NULL,
  `opening_balance_date` date DEFAULT NULL,
  `billing_attention` varchar(150) DEFAULT NULL,
  `billing_country` varchar(100) DEFAULT NULL,
  `billing_address_line1` varchar(255) DEFAULT NULL,
  `billing_address_line2` varchar(255) DEFAULT NULL,
  `billing_city` varchar(100) DEFAULT NULL,
  `billing_state` varchar(100) DEFAULT NULL,
  `billing_postal_code` varchar(20) DEFAULT NULL,
  `billing_phone` varchar(30) DEFAULT NULL,
  `shipping_attention` varchar(150) DEFAULT NULL,
  `shipping_country` varchar(100) DEFAULT NULL,
  `shipping_address_line1` varchar(255) DEFAULT NULL,
  `shipping_address_line2` varchar(255) DEFAULT NULL,
  `shipping_city` varchar(100) DEFAULT NULL,
  `shipping_state` varchar(100) DEFAULT NULL,
  `shipping_postal_code` varchar(20) DEFAULT NULL,
  `shipping_phone` varchar(30) DEFAULT NULL,
  `customer_category` varchar(100) DEFAULT NULL,
  `customer_segment` varchar(100) DEFAULT NULL,
  `risk` varchar(50) DEFAULT NULL,
  `approval_status` varchar(50) DEFAULT NULL,
  `portal_access` tinyint(1) DEFAULT NULL,
  `portal_language` varchar(50) DEFAULT NULL,
  `salesperson` varchar(150) DEFAULT NULL,
  `account_manager` varchar(150) DEFAULT NULL,
  `cost_centre` varchar(100) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_customer_user` (`user_id`),
  KEY `fk_customers_company` (`company_id`),
  CONSTRAINT `fk_customer_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_customers_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `invoice_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `invoice_items` (
  `id` int NOT NULL AUTO_INCREMENT,
  `invoice_id` int NOT NULL,
  `description` text,
  `quantity` decimal(10,2) DEFAULT NULL,
  `unit_price` decimal(12,2) DEFAULT NULL,
  `total_price` decimal(12,2) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_item_invoice` (`invoice_id`),
  CONSTRAINT `fk_item_invoice` FOREIGN KEY (`invoice_id`) REFERENCES `invoices` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `invoices`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `invoices` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `company_id` int NOT NULL,
  `customer_id` int DEFAULT NULL,
  `invoice_type` varchar(100) DEFAULT NULL,
  `document_type` enum('supplier_invoice','bill') DEFAULT NULL,
  `invoice_no` varchar(100) DEFAULT NULL,
  `client_name` varchar(255) DEFAULT NULL,
  `seller_name` varchar(255) DEFAULT NULL,
  `buyer_name` varchar(255) DEFAULT NULL,
  `invoice_date` date DEFAULT NULL,
  `due_date` date DEFAULT NULL,
  `phone_number` varchar(50) DEFAULT NULL,
  `location` text,
  `description` text,
  `subtotal` decimal(12,2) DEFAULT NULL,
  `vat_rate` decimal(5,2) DEFAULT NULL,
  `vat_amount` decimal(12,2) DEFAULT NULL,
  `total_amount` decimal(12,2) DEFAULT NULL,
  `currency` varchar(20) DEFAULT NULL,
  `trn` varchar(100) DEFAULT NULL,
  `image_path` text,
  `status` enum('PENDING','PROCESSED','FAILED') DEFAULT 'PROCESSED',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_invoices_user_document_type` (`user_id`,`document_type`),
  KEY `fk_invoice_customer` (`customer_id`),
  KEY `fk_invoices_company` (`company_id`),
  CONSTRAINT `fk_invoice_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_invoice_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_invoices_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `login_history`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `login_history` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `ip_address` varchar(50) DEFAULT NULL,
  `browser` varchar(255) DEFAULT NULL,
  `device` varchar(255) DEFAULT NULL,
  `login_time` datetime DEFAULT NULL,
  `logout_time` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `login_history_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `plans`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `plans` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `slug` varchar(50) NOT NULL,
  `monthly_price` decimal(10,2) DEFAULT '0.00',
  `yearly_price` decimal(10,2) DEFAULT '0.00',
  `invoice_limit` int DEFAULT '0',
  `customer_limit` int DEFAULT '0',
  `user_limit` int DEFAULT '1',
  `storage_limit` int DEFAULT '1024',
  `ocr_limit` int DEFAULT '0',
  `api_access` tinyint(1) DEFAULT '0',
  `priority_support` tinyint(1) DEFAULT '0',
  `active` tinyint(1) DEFAULT '1',
  `featured` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `stripe_product_id` varchar(255) DEFAULT NULL,
  `stripe_price_id_monthly` varchar(255) DEFAULT NULL,
  `stripe_price_id_yearly` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `slug` (`slug`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `schema_migrations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `schema_migrations` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `applied_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `stripe_webhook_events`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `stripe_webhook_events` (
  `id` int NOT NULL AUTO_INCREMENT,
  `stripe_event_id` varchar(255) NOT NULL,
  `type` varchar(100) NOT NULL,
  `processed_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_stripe_webhook_events_event_id` (`stripe_event_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `subscriptions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `subscriptions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `company_id` int NOT NULL,
  `plan_id` int NOT NULL,
  `status` enum('trial','active','expired','cancelled','suspended') DEFAULT NULL,
  `billing_cycle` enum('monthly','yearly') DEFAULT NULL,
  `price` decimal(10,2) DEFAULT NULL,
  `starts_at` datetime DEFAULT NULL,
  `expires_at` datetime DEFAULT NULL,
  `next_billing` datetime DEFAULT NULL,
  `cancelled_at` datetime DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `stripe_subscription_id` varchar(255) DEFAULT NULL,
  `stripe_customer_id` varchar(255) DEFAULT NULL,
  `stripe_price_id` varchar(255) DEFAULT NULL,
  `stripe_status` varchar(50) DEFAULT NULL,
  `cancel_at_period_end` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_subscriptions_stripe_subscription_id` (`stripe_subscription_id`),
  KEY `user_id` (`user_id`),
  KEY `plan_id` (`plan_id`),
  KEY `fk_subscriptions_company` (`company_id`),
  CONSTRAINT `fk_subscriptions_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`),
  CONSTRAINT `subscriptions_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`),
  CONSTRAINT `subscriptions_ibfk_2` FOREIGN KEY (`plan_id`) REFERENCES `plans` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `suppliers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `suppliers` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `company_id` int NOT NULL,
  `vendor_type` varchar(50) DEFAULT NULL,
  `salutation` varchar(20) DEFAULT NULL,
  `primary_contact_first_name` varchar(150) DEFAULT NULL,
  `primary_contact_last_name` varchar(150) DEFAULT NULL,
  `company_name` varchar(255) NOT NULL,
  `display_name` varchar(255) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `phone` varchar(30) DEFAULT NULL,
  `mobile` varchar(30) DEFAULT NULL,
  `website` varchar(255) DEFAULT NULL,
  `department` varchar(150) DEFAULT NULL,
  `designation` varchar(150) DEFAULT NULL,
  `tax_treatment` varchar(50) DEFAULT NULL,
  `trn` varchar(100) DEFAULT NULL,
  `place_of_supply` varchar(100) DEFAULT NULL,
  `currency` varchar(20) DEFAULT NULL,
  `payment_terms` varchar(50) DEFAULT NULL,
  `opening_balance` decimal(14,2) DEFAULT NULL,
  `opening_balance_date` date DEFAULT NULL,
  `billing_attention` varchar(150) DEFAULT NULL,
  `billing_country` varchar(100) DEFAULT NULL,
  `billing_address_line1` varchar(255) DEFAULT NULL,
  `billing_address_line2` varchar(255) DEFAULT NULL,
  `billing_city` varchar(100) DEFAULT NULL,
  `billing_state` varchar(100) DEFAULT NULL,
  `billing_postal_code` varchar(20) DEFAULT NULL,
  `billing_phone` varchar(30) DEFAULT NULL,
  `shipping_attention` varchar(150) DEFAULT NULL,
  `shipping_country` varchar(100) DEFAULT NULL,
  `shipping_address_line1` varchar(255) DEFAULT NULL,
  `shipping_address_line2` varchar(255) DEFAULT NULL,
  `shipping_city` varchar(100) DEFAULT NULL,
  `shipping_state` varchar(100) DEFAULT NULL,
  `shipping_postal_code` varchar(20) DEFAULT NULL,
  `shipping_phone` varchar(30) DEFAULT NULL,
  `vendor_category` varchar(100) DEFAULT NULL,
  `vendor_classification` varchar(100) DEFAULT NULL,
  `procurement_category` varchar(100) DEFAULT NULL,
  `default_expense_account` varchar(150) DEFAULT NULL,
  `notes` text,
  `status` enum('ACTIVE','INACTIVE') DEFAULT 'ACTIVE',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_supplier_user` (`user_id`),
  KEY `fk_suppliers_company` (`company_id`),
  CONSTRAINT `fk_supplier_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_suppliers_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `usage_stats`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `usage_stats` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `company_id` int DEFAULT NULL,
  `invoices_used` int DEFAULT '0',
  `bank_statements_used` int DEFAULT '0',
  `customers_used` int DEFAULT '0',
  `ocr_pages_used` int DEFAULT '0',
  `storage_used` bigint DEFAULT '0',
  `api_calls_used` int DEFAULT '0',
  `team_members_used` int DEFAULT '1',
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_usage_stats_company_id` (`company_id`),
  KEY `fk_usage_stats_company` (`company_id`),
  KEY `idx_usage_stats_user_id` (`user_id`),
  CONSTRAINT `fk_usage_stats_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`),
  CONSTRAINT `usage_stats_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(150) NOT NULL,
  `company_name` varchar(200) DEFAULT NULL,
  `email` varchar(255) NOT NULL,
  `password` varchar(255) NOT NULL,
  `phone` varchar(30) DEFAULT NULL,
  `country` varchar(100) DEFAULT NULL,
  `country_code` varchar(10) DEFAULT NULL,
  `mobile_number` varchar(20) DEFAULT NULL,
  `plan` enum('FREE','STARTER','PRO','BUSINESS') DEFAULT 'FREE',
  `status` enum('ACTIVE','INACTIVE') DEFAULT 'ACTIVE',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `role` varchar(20) NOT NULL DEFAULT 'customer',
  `account_type` enum('COMPANY','FREELANCER') DEFAULT NULL,
  `subscription_plan` varchar(50) DEFAULT 'Free',
  `email_verified` tinyint(1) DEFAULT '0',
  `last_login` datetime DEFAULT NULL,
  `avatar` varchar(255) DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `deleted_at` datetime DEFAULT NULL,
  `plan_id` int DEFAULT NULL,
  `reset_token_hash` varchar(64) DEFAULT NULL,
  `reset_token_expires` datetime DEFAULT NULL,
  `stripe_customer_id` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`),
  UNIQUE KEY `uq_users_stripe_customer_id` (`stripe_customer_id`),
  UNIQUE KEY `uq_users_country_code_mobile` (`country_code`,`mobile_number`),
  KEY `fk_user_plan` (`plan_id`),
  KEY `idx_users_reset_token_hash` (`reset_token_hash`),
  CONSTRAINT `fk_user_plan` FOREIGN KEY (`plan_id`) REFERENCES `plans` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

