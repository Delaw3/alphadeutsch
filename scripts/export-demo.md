# Exporting an anonymized demo database

All steps run against your **local** MySQL only. Do not run on production.

## 1. Create the demo database
```sql
CREATE DATABASE IF NOT EXISTS alphadeutsch_demo CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

## 2. Dump the source database
```bash
mysqldump -u root -p --single-transaction --routines --triggers alphadeutsch > alphadeutsch_source.sql
```

## 3. Import into the demo database
```bash
mysql -u root -p alphadeutsch_demo < alphadeutsch_source.sql
```

## 4. Anonymize personal data
```bash
mysql -u root -p alphadeutsch_demo < scripts/anonymize-demo.sql
```

## 5. Verify
```sql
USE alphadeutsch_demo;
SELECT id, fullname, email, phone_no, place_of_birth, dob, ProfileImage, killer, reset_token FROM stud2022 LIMIT 5;
SELECT COUNT(*) AS stud_count FROM stud2022;
SELECT COUNT(*) AS reg_count FROM course_reg;
SELECT COUNT(*) AS result_count FROM results;
```

## 6. Export the anonymized demo (optional)
```bash
mysqldump -u root -p --single-transaction alphadeutsch_demo > alphadeutsch_demo_anonymized.sql
```

## Notes
- `reg_no`, `status`, scores, payments, courses and packages are left unchanged.
- Only person-identifying columns are rewritten.
- Keep `alphadeutsch_demo.sql` out of version control if it contains real data.
