# ERP Domain Rules

- Fee: structure per (class, shift, year). Invoice per student per term.
- Payment: partial allowed. Receipt generated. Due reminder via notification service (see `messaging-domain`, category `fee_due`).
- Salary: monthly, deductions, bonuses. Payslip generated.
- Library: issue/return, fine calc, stock in/out, book sales.
- Money stored as integer paisa.
