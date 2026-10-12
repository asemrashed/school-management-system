# LMS Domain Rules

- Attendance: assignable taker (default first-class teacher), delegated by admin.
- Assignment → Submission → Grade → Publish.
- Exam → Marks entry → Result compute → Publish → notify parent via notification service (see `messaging-domain`, category `result_published`).
- Resource belongs to (class, section, subject, teacher).
- Rule: no resource visible to parent until published.
