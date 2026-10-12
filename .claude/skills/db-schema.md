# DB Schema (ERD pointer)

Full ERD lives in /docs/erd.md (updated by db-migration agent).

## Domains
- Core: User, Role, Permission, School, Campus, Building, Room, Class, Section, Shift, PasswordResetOtp
- People: Student, Teacher, Staff, Guardian, Enrollment
- LMS: Subject, Assignment, Submission, Exam, Marks, Result, Resource, Attendance
- ERP: FeeStructure, Invoice, Payment, Salary, LibraryBook, BookIssue, BookSale
- CMS: Page, Block, Notice, Post, Media
- Messaging: MessagingFeatureToggle (category, smsEnabled), NotificationLog (optional, Phase 2)

## Rules
- All FKs indexed.
- Soft delete via deletedAt.
- Timestamps: createdAt, updatedAt.
- Money: integer (paisa) or Decimal — never float.
- PasswordResetOtp: stores channel used (email/sms), codeHash, expiresAt, attempts. Never store the raw OTP.
