import "../src/bootstrap-env";
import { PrismaClient, RoleName, MessageCategory } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// Mirrors the SMS-eligible categories in messaging-domain.md. Categories not
// listed here are SMTP-only and never get a toggle row.
const SMS_ELIGIBLE_CATEGORIES: MessageCategory[] = [
  "absence_alert",
  "fee_due",
  "exam_schedule",
  "result_published",
  "general_notice",
  "password_reset",
];

// Minimal starter matrix — expand as modules are built (auth-rbac-matrix.md).
const DEFAULT_PERMISSIONS: Array<{ role: RoleName; module: string; action: "read" | "write" }> = [
  { role: "super_admin", module: "students", action: "read" },
  { role: "super_admin", module: "students", action: "write" },
  { role: "super_admin", module: "fees", action: "read" },
  { role: "super_admin", module: "fees", action: "write" },
  { role: "super_admin", module: "messaging.settings", action: "write" },
  { role: "super_admin", module: "attendance", action: "read" },
  { role: "super_admin", module: "attendance", action: "write" },
  { role: "super_admin", module: "notices", action: "write" },
  { role: "admin", module: "students", action: "read" },
  { role: "admin", module: "students", action: "write" },
  { role: "admin", module: "fees", action: "read" },
  { role: "admin", module: "fees", action: "write" },
  { role: "admin", module: "attendance", action: "read" },
  { role: "admin", module: "notices", action: "write" },
  { role: "coordinator", module: "students", action: "read" },
  { role: "coordinator", module: "students", action: "write" },
  { role: "coordinator", module: "attendance", action: "read" },
  { role: "teacher", module: "students", action: "read" },
  { role: "teacher", module: "attendance", action: "write" },
  { role: "accountant", module: "fees", action: "read" },
  { role: "accountant", module: "fees", action: "write" },
  { role: "librarian", module: "library", action: "read" },
  { role: "librarian", module: "library", action: "write" },
  { role: "parent", module: "fees", action: "read" },
  { role: "parent", module: "students", action: "read" },
  { role: "parent", module: "notices", action: "read" },
  { role: "student", module: "students", action: "read" },
  { role: "student", module: "notices", action: "read" },
  { role: "student", module: "assignments", action: "read" },
  { role: "student", module: "resources", action: "read" },
  { role: "student", module: "exams", action: "read" },
  { role: "teacher", module: "assignments", action: "write" },
  { role: "teacher", module: "resources", action: "write" },
  { role: "teacher", module: "exams", action: "write" },
  { role: "coordinator", module: "exams", action: "write" },
  { role: "admin", module: "exams", action: "write" },
  { role: "parent", module: "assignments", action: "read" },
  { role: "parent", module: "resources", action: "read" },
  { role: "parent", module: "exams", action: "read" },
  { role: "super_admin", module: "salary", action: "write" },
  { role: "super_admin", module: "reports", action: "read" },
  { role: "super_admin", module: "device", action: "write" },
  { role: "super_admin", module: "cms", action: "write" },
  { role: "admin", module: "salary", action: "write" },
  { role: "admin", module: "reports", action: "read" },
  { role: "admin", module: "cms", action: "write" },
  { role: "accountant", module: "salary", action: "write" },
  { role: "accountant", module: "reports", action: "read" },
];

async function main() {
  const school = await prisma.school.upsert({
    where: { id: "default-school" },
    update: {},
    create: {
      id: "default-school",
      name: process.env.SEED_SCHOOL_NAME ?? "Green Valley English Medium School",
    },
  });

  const morningShift = await prisma.shift.upsert({
    where: { id: "default-shift-morning" },
    update: {},
    create: { id: "default-shift-morning", name: "Morning", schoolId: school.id },
  });

  await prisma.class.upsert({
    where: { id: "default-class-6" },
    update: {},
    create: { id: "default-class-6", name: "Class 6", schoolId: school.id, shiftId: morningShift.id },
  });

  // Default bell schedule for the Morning shift (admin can edit under
  // Academic Setup -> Bell Schedule). Stable ids keep re-seeding idempotent.
  const defaultPeriods: Array<[string, string, string, boolean]> = [
    ["Period 1", "08:00", "08:45", false],
    ["Period 2", "08:45", "09:30", false],
    ["Period 3", "09:30", "10:15", false],
    ["Break", "10:15", "10:35", true],
    ["Period 4", "10:35", "11:20", false],
    ["Period 5", "11:20", "12:05", false],
  ];
  for (const [i, [name, startTime, endTime, isBreak]] of defaultPeriods.entries()) {
    await prisma.period.upsert({
      where: { id: `default-period-morning-${i + 1}` },
      update: {},
      create: { id: `default-period-morning-${i + 1}`, name, shiftId: morningShift.id, startTime, endTime, isBreak, sortOrder: i + 1 },
    });
  }

  await prisma.subject.upsert({
    where: { id: "default-subject-math-6" },
    update: {},
    create: { id: "default-subject-math-6", name: "Mathematics", classId: "default-class-6" },
  });

  await prisma.feeStructure.upsert({
    where: { id: "default-fee-tuition-6" },
    update: {},
    create: {
      id: "default-fee-tuition-6",
      name: "Monthly Tuition",
      classId: "default-class-6",
      shiftId: morningShift.id,
      year: new Date().getFullYear(),
      amount: 250000, // 2,500.00 BDT in paisa
    },
  });

  const superAdminEmail = process.env.SEED_SUPER_ADMIN_EMAIL ?? "admin@school.test";
  const superAdminPassword = process.env.SEED_SUPER_ADMIN_PASSWORD ?? "ChangeMe123!";
  const passwordHash = await bcrypt.hash(superAdminPassword, 12);

  await prisma.user.upsert({
    where: { email: superAdminEmail },
    update: {},
    create: {
      name: "Super Admin",
      email: superAdminEmail,
      passwordHash,
      role: "super_admin",
      isActive: true,
    },
  });

  for (const category of SMS_ELIGIBLE_CATEGORIES) {
    await prisma.messagingFeatureToggle.upsert({
      where: { category },
      update: {},
      create: { category, smsEnabled: false },
    });
  }

  for (const perm of DEFAULT_PERMISSIONS) {
    await prisma.permission.upsert({
      where: { role_module_action: { role: perm.role, module: perm.module, action: perm.action } },
      update: { allowed: true },
      create: { ...perm, allowed: true },
    });
  }

  // eslint-disable-next-line no-console
  console.log(`Seed complete. Super Admin login: ${superAdminEmail} / ${superAdminPassword}`);
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
