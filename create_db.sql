CREATE DATABASE myForum;
USE myForum;

CREATE TABLE `userDetails` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `username` varchar(255) NOT NULL,
  `first` varchar(255) NOT NULL,
  `last` varchar(255) NOT NULL,
  `email` varchar(255) NOT NULL,
  `hashedPassword` varchar(255) NOT NULL,
  `joindate` datetime DEFAULT NULL,
  `lastlogin` datetime DEFAULT NULL,
  `role` varchar(50) NOT NULL DEFAULT 'user',
  `profileImage` varchar(255) DEFAULT NULL,
  `public_id` varchar(100) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `posts` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `title` varchar(255) NOT NULL,
  `content` text NOT NULL,
  `thumbnail` varchar(150) DEFAULT NULL,
  `public_id` varchar(150) DEFAULT NULL,
  `username` varchar(255) NOT NULL,
  `user_id` int(11) DEFAULT NULL,
  `tag` varchar(255) DEFAULT NULL,
  `edited` tinyint(1) DEFAULT 0,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `isDeleted` tinyint(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `fk_user_id` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `user_comments` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `post_id` int(11) NOT NULL,
  `comment` text DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `isDeleted` tinyint(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `post_id` (`post_id`),
  KEY `unique_vote` (`user_id`, `post_id`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `recent_activity` (
  `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` int(11) DEFAULT NULL,
  `action_type` varchar(255) NOT NULL,
  `reference_id` int(11) DEFAULT NULL,
  `timestamp` timestamp NOT NULL DEFAULT current_timestamp(),
  `isPublic` tinyint(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE USER 'appuser'@'localhost' IDENTIFIED WITH mysql_native_password BY 'app2024';
GRANT ALL PRIVILEGES ON myForum.* TO 'appuser'@'localhost';
FLUSH PRIVILEGES;

ALTER TABLE `user_comments`
ADD CONSTRAINT `user_comments_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `userDetails` (`id`) ON DELETE CASCADE,
ADD CONSTRAINT `user_comments_ibfk_2` FOREIGN KEY (`post_id`) REFERENCES `posts` (`id`) ON DELETE CASCADE;

ALTER TABLE userDetails
MODIFY profileImage VARCHAR(255) DEFAULT '/assets/primogem.png';