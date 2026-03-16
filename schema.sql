-- Warehouse backend: checkins & checkin_items
-- Run this in your MySQL client to create the database and tables.

CREATE DATABASE IF NOT EXISTS warehouse_db;
USE warehouse_db;

-- Check-ins (орлого)
CREATE TABLE IF NOT EXISTS checkins (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(100) NOT NULL,
  date DATE NOT NULL,
  status ENUM('Draft', 'Completed', 'Pending') NOT NULL DEFAULT 'Draft',
  contact VARCHAR(255) NOT NULL,
  warehouse VARCHAR(255) NOT NULL,
  `user` VARCHAR(255) NOT NULL,
  details TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Check-in line items
CREATE TABLE IF NOT EXISTS checkin_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  checkin_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  code VARCHAR(100) NOT NULL,
  weight VARCHAR(50) NOT NULL,
  quantity VARCHAR(50) NOT NULL,
  CONSTRAINT fk_checkin_items_checkin
    FOREIGN KEY (checkin_id) REFERENCES checkins(id) ON DELETE CASCADE
);

CREATE INDEX idx_checkins_status ON checkins(status);
CREATE INDEX idx_checkins_created_at ON checkins(created_at);
CREATE INDEX idx_checkin_items_checkin_id ON checkin_items(checkin_id);
