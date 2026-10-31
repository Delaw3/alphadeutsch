USE alphadeutsch_demo;

-- Anonymize personal data in stud2022 (structure and reg_no/status preserved)
UPDATE stud2022
SET
  fullname = CONCAT('Demo Student ', id),
  email = CONCAT('student', id, '@example.com'),
  phone_no = CONCAT('080', LPAD(id, 7, '0')),
  place_of_birth = ELT(1 + (id % 6), 'Awka', 'Lagos', 'Abuja', 'Enugu', 'Onitsha', 'Kano'),
  dob = DATE_FORMAT(DATE_ADD(STR_TO_DATE(dob, '%Y-%m-%d'), INTERVAL 365 DAY), '%Y-%m-%d'),
  ProfileImage = '',
  killer = NULL,
  reset_token = NULL;

-- Anonymize person-identifying columns in course_reg (reg_no and structure preserved)
UPDATE course_reg
SET
  student_email = CONCAT('student_', id, '@example.com'),
  ProfileImage = NULL;

-- Anonymize person-identifying columns in results (reg_no and scores preserved)
UPDATE results
SET
  fullname = CONCAT('Demo Student ', id),
  email = CONCAT('student_', id, '@example.com'),
  place_birth = ELT(1 + (id % 6), 'Awka', 'Lagos', 'Abuja', 'Enugu', 'Onitsha', 'Kano'),
  phone = CONCAT('080', LPAD(id, 7, '0'));
