-- Demo database only. Never run on the real database.
-- Documented demo student (has a paid course and a result):
--   reg_no: 2026/AD/10001
--   dob:    1995-05-10
--   email:  student1@example.com

CREATE TABLE IF NOT EXISTS `stud2022` (
  `id` int NOT NULL AUTO_INCREMENT,
  `fullname` varchar(100) NOT NULL,
  `email` varchar(100) NOT NULL,
  `killer` varchar(100) DEFAULT NULL,
  `reg_no` varchar(100) NOT NULL,
  `phone_no` varchar(100) NOT NULL,
  `place_of_birth` varchar(100) NOT NULL,
  `dob` varchar(100) NOT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'Active',
  `ProfileImage` text NOT NULL,
  `super` varchar(10) NOT NULL DEFAULT '0',
  `reset_token` text,
  `time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `adminlevel` varchar(200) NOT NULL DEFAULT 'No',
  PRIMARY KEY (`id`),
  UNIQUE KEY `phone_no` (`phone_no`),
  UNIQUE KEY `email` (`email`),
  UNIQUE KEY `reg_no` (`reg_no`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

CREATE TABLE IF NOT EXISTS `course_reg` (
  `id` int NOT NULL AUTO_INCREMENT,
  `student_reg_no` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `student_email` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `course_id` int NOT NULL,
  `payment_status` enum('Yes','No') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT 'No',
  `ProfileImage` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
  `course_score` int DEFAULT NULL,
  `course_amount` decimal(10,2) DEFAULT NULL,
  `date` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `results` (
  `id` int NOT NULL AUTO_INCREMENT,
  `reg_no` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `fullname` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `email` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `place_birth` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `phone` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `dos` date DEFAULT NULL,
  `course_id` int DEFAULT NULL,
  `horen` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `horen_score` float DEFAULT NULL,
  `horen_grade` varchar(1000) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `lesen` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `lesen_score` float DEFAULT NULL,
  `lesen_grade` varchar(1000) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `schreiben` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `schreiben_score` float DEFAULT NULL,
  `schreiben_grade` varchar(1000) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `sprechen` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `sprechen_score` float DEFAULT NULL,
  `sprechen_grade` varchar(1000) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `total` float DEFAULT NULL,
  `sittings` int NOT NULL DEFAULT '1',
  `time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `courses` (
  `id` int NOT NULL AUTO_INCREMENT,
  `title` varchar(255) NOT NULL,
  `display` varchar(100) NOT NULL,
  `description` text NOT NULL,
  `price` decimal(10,2) NOT NULL,
  `image` varchar(255) DEFAULT NULL,
  `is_open` tinyint(1) DEFAULT '1',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3;

CREATE TABLE IF NOT EXISTS `packages` (
  `id` int NOT NULL AUTO_INCREMENT,
  `package_name` varchar(100) NOT NULL,
  `amount` varchar(100) NOT NULL,
  `initial` text NOT NULL,
  `time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

-- courses
INSERT INTO courses (id, title, display, description, price, image, is_open) VALUES
(1, 'A1 Elementary', 'On-Site', 'A1 on-site course.', 70000.00, NULL, 1),
(2, 'A1 Elementary', 'Online', 'A1 online course.', 60000.00, NULL, 1),
(3, 'A2 Elementary', 'On-Site', 'A2 on-site course.', 70000.00, NULL, 1),
(4, 'B1 Independent', 'On-Site', 'B1 on-site course.', 70000.00, NULL, 1),
(5, 'B2 Independent', 'On-Site', 'B2 on-site course.', 70000.00, NULL, 1),
(6, 'C1 Autonomous', 'On-Site', 'C1 on-site course.', 70000.00, NULL, 1),
(7, 'Family Reunion', 'Private', 'Family reunion private course.', 90000.00, NULL, 1),
(8, 'A1 Elementary', 'Online Private', 'A1 online private course.', 80000.00, NULL, 1);

-- packages
INSERT INTO packages (id, package_name, amount, initial) VALUES
(1, 'A1 Elementary', '60000', 'a1'),
(2, 'A2 Elementary', '70000', 'a2'),
(3, 'B1 Independent', '40000', 'b1'),
(4, 'B2 Independent', '30000', 'b2'),
(5, 'C1 Autonomous', '200000', 'c1');

-- stud2022 (10 fake students)
INSERT INTO stud2022 (id, fullname, email, killer, reg_no, phone_no, place_of_birth, dob, status, ProfileImage, super, reset_token, adminlevel) VALUES
(1, 'Demo Student 1', 'student1@example.com', 'demo-killer-1', '2026/AD/10001', '08000000001', 'Awka', '1995-05-10', 'Active', '', '0', 'demo-reset-1', 'No'),
(2, 'Demo Student 2', 'student2@example.com', 'demo-killer-2', '2026/AD/10002', '08000000002', 'Lagos', '1996-06-11', 'Active', '', '0', 'demo-reset-2', 'No'),
(3, 'Demo Student 3', 'student3@example.com', 'demo-killer-3', '2026/AD/10003', '08000000003', 'Abuja', '1997-07-12', 'Active', '', '0', 'demo-reset-3', 'No'),
(4, 'Demo Student 4', 'student4@example.com', 'demo-killer-4', '2026/AD/10004', '08000000004', 'Enugu', '1998-08-13', 'Active', '', '0', 'demo-reset-4', 'No'),
(5, 'Demo Student 5', 'student5@example.com', 'demo-killer-5', '2026/AD/10005', '08000000005', 'Onitsha', '1999-09-14', 'Active', '', '0', 'demo-reset-5', 'No'),
(6, 'Demo Student 6', 'student6@example.com', 'demo-killer-6', '2026/AD/10006', '08000000006', 'Kano', '2000-10-15', 'Active', '', '0', 'demo-reset-6', 'No'),
(7, 'Demo Student 7', 'student7@example.com', 'demo-killer-7', '2026/AD/10007', '08000000007', 'Awka', '2001-11-16', 'Active', '', '0', 'demo-reset-7', 'No'),
(8, 'Demo Student 8', 'student8@example.com', 'demo-killer-8', '2026/AD/10008', '08000000008', 'Lagos', '2002-12-17', 'Active', '', '0', 'demo-reset-8', 'No'),
(9, 'Demo Student 9', 'student9@example.com', 'demo-killer-9', '2026/AD/10009', '08000000009', 'Abuja', '2003-01-18', 'Active', '', '0', 'demo-reset-9', 'No'),
(10, 'Demo Student 10', 'student10@example.com', 'demo-killer-10', '2026/AD/10010', '08000000010', 'Enugu', '2004-02-19', 'Active', '', '0', 'demo-reset-10', 'No');

-- course_reg (12 registrations)
INSERT INTO course_reg (id, student_reg_no, student_email, course_id, payment_status, ProfileImage, course_amount) VALUES
(1, '2026/AD/10001', 'student1@example.com', 1, 'Yes', NULL, 70000.00),
(2, '2026/AD/10002', 'student2@example.com', 2, 'Yes', NULL, 60000.00),
(3, '2026/AD/10003', 'student3@example.com', 3, 'Yes', NULL, 70000.00),
(4, '2026/AD/10004', 'student4@example.com', 4, 'Yes', NULL, 70000.00),
(5, '2026/AD/10005', 'student5@example.com', 5, 'Yes', NULL, 70000.00),
(6, '2026/AD/10006', 'student6@example.com', 6, 'Yes', NULL, 70000.00),
(7, '2026/AD/10007', 'student7@example.com', 7, 'Yes', NULL, 90000.00),
(8, '2026/AD/10008', 'student8@example.com', 8, 'Yes', NULL, 80000.00),
(9, '2026/AD/10009', 'student9@example.com', 1, 'No', NULL, 70000.00),
(10, '2026/AD/10010', 'student10@example.com', 2, 'No', NULL, 60000.00),
(11, '2026/AD/10001', 'student1@example.com', 3, 'No', NULL, 70000.00),
(12, '2026/AD/10002', 'student2@example.com', 4, 'No', NULL, 70000.00);

-- results (8 results for paid registrations)
INSERT INTO results (id, reg_no, fullname, email, place_birth, phone, dos, course_id, horen, horen_score, horen_grade, lesen, lesen_score, lesen_grade, schreiben, schreiben_score, schreiben_grade, sprechen, sprechen_score, sprechen_grade, total, sittings) VALUES
(1, '2026/AD/10001', 'Demo Student 1', 'student1@example.com', 'Awka', '08000000001', '2026-06-15', 1, 'Hören', 82.5, 'B', 'Lesen', 78.0, 'B', 'Schreiben', 85.0, 'A', 'Sprechen', 88.0, 'A', 333.5, 1),
(2, '2026/AD/10002', 'Demo Student 2', 'student2@example.com', 'Lagos', '08000000002', '2026-06-15', 2, 'Hören', 75.0, 'B', 'Lesen', 70.0, 'C', 'Schreiben', 72.0, 'C', 'Sprechen', 76.0, 'B', 293.0, 1),
(3, '2026/AD/10003', 'Demo Student 3', 'student3@example.com', 'Abuja', '08000000003', '2026-06-15', 3, 'Hören', 90.0, 'A', 'Lesen', 88.0, 'A', 'Schreiben', 84.0, 'B', 'Sprechen', 91.0, 'A', 353.0, 1),
(4, '2026/AD/10004', 'Demo Student 4', 'student4@example.com', 'Enugu', '08000000004', '2026-06-15', 4, 'Hören', 68.0, 'C', 'Lesen', 72.0, 'C', 'Schreiben', 70.0, 'C', 'Sprechen', 74.0, 'B', 284.0, 1),
(5, '2026/AD/10005', 'Demo Student 5', 'student5@example.com', 'Onitsha', '08000000005', '2026-06-15', 5, 'Hören', 80.0, 'B', 'Lesen', 82.0, 'B', 'Schreiben', 79.0, 'B', 'Sprechen', 83.0, 'B', 324.0, 1),
(6, '2026/AD/10006', 'Demo Student 6', 'student6@example.com', 'Kano', '08000000006', '2026-06-15', 6, 'Hören', 87.0, 'A', 'Lesen', 85.0, 'A', 'Schreiben', 88.0, 'A', 'Sprechen', 90.0, 'A', 350.0, 1),
(7, '2026/AD/10007', 'Demo Student 7', 'student7@example.com', 'Awka', '08000000007', '2026-06-15', 7, 'Hören', 73.0, 'C', 'Lesen', 75.0, 'B', 'Schreiben', 71.0, 'C', 'Sprechen', 77.0, 'B', 296.0, 1),
(8, '2026/AD/10008', 'Demo Student 8', 'student8@example.com', 'Lagos', '08000000008', '2026-06-15', 8, 'Hören', 79.0, 'B', 'Lesen', 81.0, 'B', 'Schreiben', 76.0, 'B', 'Sprechen', 82.0, 'B', 318.0, 1);
