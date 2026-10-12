import "../src/bootstrap-env";
import { PrismaClient, type ResourceKind, type RoleName, type InvoiceStatus, type Weekday } from "@prisma/client";
import bcrypt from "bcryptjs";
import { sanitizeHtml } from "../src/lib/sanitize";

/**
 * Demo data for local development. Idempotent: every row has a stable id /
 * unique key, so re-running refreshes the demo accounts instead of duplicating
 * anything.
 *
 *   npm run prisma:seed        # base data (school, super admin, permissions)
 *   npm run prisma:seed:demo   # this file
 *
 * EVERY demo account uses the password below. Never run this against a
 * production database.
 */
export const DEMO_PASSWORD = "Qwer4321";

type Db = PrismaClient;

// --- helpers ------------------------------------------------------------------

const DAY_MS = 86_400_000;
const daysAgo = (n: number) => new Date(Date.now() - n * DAY_MS);
const daysFromNow = (n: number) => new Date(Date.now() + n * DAY_MS);
const dateOnly = (d: Date) => new Date(d.toISOString().slice(0, 10) + "T00:00:00.000Z");

/** Deterministic pseudo-random in [0,1) so re-runs produce identical marks. */
const rand = (seed: number) => {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
};

/** The last `n` school days (Sun–Thu in Bangladesh), newest first, today excluded. */
function lastSchoolDays(n: number): Date[] {
  const out: Date[] = [];
  for (let i = 1; out.length < n && i < 60; i++) {
    const d = dateOnly(daysAgo(i));
    const dow = d.getUTCDay(); // 0 Sun … 6 Sat
    if (dow !== 5 && dow !== 6) out.push(d);
  }
  return out;
}

// --- reference data -----------------------------------------------------------

const SUBJECTS = ["English", "Mathematics", "Science", "Bangla", "Social Science"] as const;

const TEACHERS = [
  { name: "Rahim Uddin", subject: "English" },
  { name: "Nusrat Jahan", subject: "Mathematics" },
  { name: "Kamal Hossain", subject: "Science" },
  { name: "Farhana Akter", subject: "Bangla" },
  { name: "Imran Chowdhury", subject: "Social Science" },
];

const SECTIONS = [
  { id: "demo-sec-6a", cls: "6", name: "A", room: "demo-room-101" },
  { id: "demo-sec-6b", cls: "6", name: "B", room: "demo-room-102" },
  { id: "demo-sec-7a", cls: "7", name: "A", room: "demo-room-201" },
  { id: "demo-sec-8a", cls: "8", name: "A", room: "demo-room-lab" },
];

const CLASSES = [
  { key: "6", id: "default-class-6", name: "Class 6", tuition: 250000 },
  { key: "7", id: "demo-class-7", name: "Class 7", tuition: 280000 },
  { key: "8", id: "demo-class-8", name: "Class 8", tuition: 300000 },
];
const ADMISSION_FEE = 500000; // 5,000.00 BDT in paisa
const subjectId = (cls: string, i: number) =>
  cls === "6" && i === 1 ? "default-subject-math-6" : `demo-sub-${cls}-${i}`;
const classId = (key: string) => CLASSES.find((c) => c.key === key)!.id;

const PARENTS = ["Abdul Karim", "Salma Khatun", "Mizanur Rahman", "Rina Parvin"];

/** Students are "admitted" into a section with a guardian; a sibling pair shares parent 1. */
const STUDENTS = [
  { name: "Arif Karim", sec: "demo-sec-6a", roll: "01", parent: 0 },
  { name: "Tania Karim", sec: "demo-sec-8a", roll: "01", parent: 0 }, // sibling of Arif
  { name: "Sadia Islam", sec: "demo-sec-6a", roll: "02", parent: 1 },
  { name: "Nabil Hasan", sec: "demo-sec-6a", roll: "03", parent: 2 },
  { name: "Mim Akter", sec: "demo-sec-6b", roll: "01", parent: 3 },
  { name: "Rafi Ahmed", sec: "demo-sec-6b", roll: "02", parent: 1 },
  { name: "Jannat Ferdous", sec: "demo-sec-7a", roll: "01", parent: 2 },
  { name: "Shakib Rahman", sec: "demo-sec-7a", roll: "02", parent: 3 },
];

const email = (kind: string, n: number) => `${kind}${n}@demo.school`;

// --- main ---------------------------------------------------------------------

export async function runDemoSeed(prisma: Db, log: (m: string) => void = console.log) {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  // ---- school skeleton (matches seed.ts ids; safe if the base seed already ran)
  const school = await prisma.school.upsert({
    where: { id: "default-school" },
    update: {},
    create: { id: "default-school", name: process.env.SEED_SCHOOL_NAME ?? "Green Valley English Medium School" },
  });
  const shift = await prisma.shift.upsert({
    where: { id: "default-shift-morning" },
    update: {},
    create: { id: "default-shift-morning", name: "Morning", schoolId: school.id },
  });

  const campus = await prisma.campus.upsert({
    where: { id: "demo-campus" },
    update: {},
    create: { id: "demo-campus", name: school.name, schoolId: school.id },
  });
  const buildings = [
    { id: "demo-bld-main", name: "Main Building" },
    { id: "demo-bld-science", name: "Science Block" },
  ];
  for (const b of buildings) {
    await prisma.building.upsert({ where: { id: b.id }, update: { name: b.name }, create: { ...b, campusId: campus.id } });
  }
  const rooms = [
    { id: "demo-room-101", name: "101", buildingId: "demo-bld-main", capacity: 40 },
    { id: "demo-room-102", name: "102", buildingId: "demo-bld-main", capacity: 40 },
    { id: "demo-room-201", name: "201", buildingId: "demo-bld-main", capacity: 35 },
    { id: "demo-room-lab", name: "Science Lab", buildingId: "demo-bld-science", capacity: 30 },
  ];
  for (const r of rooms) await prisma.room.upsert({ where: { id: r.id }, update: {}, create: r });
  log(`✔ ${buildings.length} buildings, ${rooms.length} rooms`);

  // Bell schedule (same ids as seed.ts so running both is harmless)
  const periodDefs: Array<[string, string, string, boolean]> = [
    ["Period 1", "08:00", "08:45", false],
    ["Period 2", "08:45", "09:30", false],
    ["Period 3", "09:30", "10:15", false],
    ["Break", "10:15", "10:35", true],
    ["Period 4", "10:35", "11:20", false],
    ["Period 5", "11:20", "12:05", false],
  ];
  const teachingPeriodIds: string[] = [];
  for (const [i, [name, startTime, endTime, isBreak]] of periodDefs.entries()) {
    const id = `default-period-morning-${i + 1}`;
    await prisma.period.upsert({
      where: { id },
      update: {},
      create: { id, name, shiftId: shift.id, startTime, endTime, isBreak, sortOrder: i + 1 },
    });
    if (!isBreak) teachingPeriodIds.push(id);
  }

  // Classes, sections, subjects
  for (const c of CLASSES) {
    await prisma.class.upsert({
      where: { id: c.id },
      update: {},
      create: { id: c.id, name: c.name, schoolId: school.id, shiftId: shift.id },
    });
    for (const [i, name] of SUBJECTS.entries()) {
      const id = subjectId(c.key, i);
      await prisma.subject.upsert({ where: { id }, update: { name }, create: { id, name, classId: c.id } });
    }
  }
  for (const s of SECTIONS) {
    await prisma.section.upsert({
      where: { id: s.id },
      update: { roomId: s.room },
      create: { id: s.id, name: s.name, classId: classId(s.cls), roomId: s.room },
    });
  }
  log(`✔ ${CLASSES.length} classes, ${SECTIONS.length} sections, ${CLASSES.length * SUBJECTS.length} subjects`);

  // Academic year
  const yr = new Date().getFullYear();
  await prisma.academicYear.upsert({
    where: { id: "demo-year" },
    update: {},
    create: { id: "demo-year", name: String(yr), schoolId: school.id, startDate: new Date(`${yr}-01-01`), endDate: new Date(`${yr}-12-31`), isCurrent: true },
  });

  // ---- users -----------------------------------------------------------------
  async function upsertUser(id: string, name: string, mail: string, role: RoleName) {
    return prisma.user.upsert({
      where: { email: mail },
      update: { passwordHash, isActive: true, name, deletedAt: null },
      create: { id, name, email: mail, passwordHash, role, isActive: true },
    });
  }

  const staffUsers: Array<{ role: RoleName; kind: string; names: string[] }> = [
    { role: "super_admin", kind: "superadmin", names: ["Demo Super Admin"] },
    { role: "admin", kind: "admin", names: ["Tahmina Rahman", "Sajid Karim"] },
    { role: "coordinator", kind: "coordinator", names: ["Mahbub Alam"] },
    { role: "accountant", kind: "accountant", names: ["Shirin Sultana", "Jahid Hasan"] },
    { role: "librarian", kind: "librarian", names: ["Rokeya Begum"] },
  ];
  const created: Record<string, { id: string }> = {};
  for (const g of staffUsers) {
    for (const [i, name] of g.names.entries()) {
      const u = await upsertUser(`demo-user-${g.kind}-${i + 1}`, name, email(g.kind, i + 1), g.role);
      created[`${g.kind}${i + 1}`] = u;
      if (g.role !== "super_admin") {
        await prisma.staff.upsert({ where: { userId: u.id }, update: {}, create: { userId: u.id, designation: g.role } });
      }
    }
  }

  const teacherRows: Array<{ id: string; userId: string }> = [];
  for (const [i, t] of TEACHERS.entries()) {
    const u = await upsertUser(`demo-user-teacher-${i + 1}`, t.name, email("teacher", i + 1), "teacher");
    const row = await prisma.teacher.upsert({
      where: { userId: u.id },
      update: { subject: t.subject },
      create: { userId: u.id, subject: t.subject, phone: `0171000000${i + 1}` },
    });
    teacherRows.push({ id: row.id, userId: u.id });
  }

  const guardianRows: string[] = [];
  const parentUserIds: string[] = [];
  for (const [i, name] of PARENTS.entries()) {
    const u = await upsertUser(`demo-user-parent-${i + 1}`, name, email("parent", i + 1), "parent");
    const g = await prisma.guardian.upsert({
      where: { userId: u.id },
      update: {},
      create: { userId: u.id, phone: `0181000000${i + 1}` },
    });
    guardianRows.push(g.id);
    parentUserIds.push(u.id);
  }
  log(`✔ users: super admin, 2 admins, coordinator, 2 accountants, librarian, ${TEACHERS.length} teachers, ${PARENTS.length} parents`);

  // ---- teacher assignments + auto routine ---------------------------------------
  // Latin-square timetable: subject i meets section k in period (i - day - k) mod 5.
  // For a fixed day/period each subject (= each teacher) appears in at most one
  // section, so no teacher is ever double-booked, and every section has exactly
  // one subject per period.
  const days: Weekday[] = ["sun", "mon", "tue", "wed", "thu"];
  let assignmentCount = 0;
  for (const [k, sec] of SECTIONS.entries()) {
    for (let i = 0; i < SUBJECTS.length; i++) {
      const aId = `demo-ca-${sec.id}-${i}`;
      const data = {
        shiftId: shift.id,
        classId: classId(sec.cls),
        sectionId: sec.id,
        subjectId: subjectId(sec.cls, i),
        teacherId: teacherRows[i].id,
        // The English teacher is the section's "first teacher" (takes attendance).
        takesAttendance: i === 0,
      };
      await prisma.classAssignment.upsert({ where: { id: aId }, update: data, create: { id: aId, ...data } });
      assignmentCount++;
      for (const [d, day] of days.entries()) {
        const p = (((i - d - k) % 5) + 5) % 5;
        await prisma.routineSlot.upsert({
          where: { assignmentId_dayOfWeek_periodId: { assignmentId: aId, dayOfWeek: day, periodId: teachingPeriodIds[p] } },
          update: {},
          create: { assignmentId: aId, dayOfWeek: day, periodId: teachingPeriodIds[p] },
        });
      }
    }
  }
  log(`✔ ${assignmentCount} teacher assignments with a full Sun–Thu routine`);

  // ---- fees + admissions -----------------------------------------------------------
  for (const c of CLASSES) {
    const tuitionId = c.key === "6" ? "default-fee-tuition-6" : `demo-fee-tuition-${c.key}`;
    await prisma.feeStructure.upsert({
      where: { id: tuitionId },
      update: { kind: "monthly" },
      create: { id: tuitionId, name: "Monthly Tuition", classId: c.id, shiftId: shift.id, year: yr, amount: c.tuition, kind: "monthly" },
    });
    await prisma.feeStructure.upsert({
      where: { id: `demo-fee-admission-${c.key}` },
      update: { kind: "admission" },
      create: { id: `demo-fee-admission-${c.key}`, name: "Admission Fee", classId: c.id, shiftId: shift.id, year: yr, amount: ADMISSION_FEE, kind: "admission" },
    });
  }

  const studentRows: Array<{ id: string; userId: string; sectionId: string; cls: string }> = [];
  const months = [2, 1, 0].map((back) => {
    const d = new Date();
    d.setUTCDate(1);
    d.setUTCMonth(d.getUTCMonth() - back);
    return d;
  });

  for (const [i, s] of STUDENTS.entries()) {
    const sec = SECTIONS.find((x) => x.id === s.sec)!;
    const u = await upsertUser(`demo-user-student-${i + 1}`, s.name, email("student", i + 1), "student");
    const row = await prisma.student.upsert({
      where: { userId: u.id },
      update: { sectionId: s.sec, guardianId: guardianRows[s.parent], rollNumber: s.roll, studentCode: `${yr}-${String(i + 1).padStart(4, "0")}` },
      create: { userId: u.id, sectionId: s.sec, guardianId: guardianRows[s.parent], rollNumber: s.roll, studentCode: `${yr}-${String(i + 1).padStart(4, "0")}`, admittedAt: daysAgo(100 + i) },
    });
    studentRows.push({ id: row.id, userId: u.id, sectionId: s.sec, cls: sec.cls });

    // Admission invoice (raised at admission; mostly settled in cash)
    const admId = `demo-inv-${i}-admission`;
    const admPaid = i % 4 === 3 ? 0 : ADMISSION_FEE;
    await upsertInvoice(prisma, admId, row.id, `demo-fee-admission-${sec.cls}`, "Admission", ADMISSION_FEE, admPaid, daysAgo(95), "cash");

    // Monthly tuition for the last three months, with a realistic mix of statuses
    const tuition = CLASSES.find((c) => c.key === sec.cls)!.tuition;
    const feeId = sec.cls === "6" ? "default-fee-tuition-6" : `demo-fee-tuition-${sec.cls}`;
    for (const [m, month] of months.entries()) {
      const term = month.toISOString().slice(0, 7);
      const due = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), 10));
      // Older months are mostly paid; the current month is open. Student 3 is behind.
      let paid = tuition;
      if (m === 2) paid = i % 3 === 0 ? 0 : i % 3 === 1 ? Math.round(tuition / 2) : tuition;
      if (m === 1 && i === 3) paid = 0;
      await upsertInvoice(prisma, `demo-inv-${i}-${term}`, row.id, feeId, term, tuition, paid, due, i % 2 ? "bkash" : "cash");
    }
  }
  log(`✔ ${STUDENTS.length} students admitted to Class 6/7/8 with admission + monthly invoices`);

  // ---- attendance (last 12 school days, taken by each section's first teacher) ---------
  const schoolDays = lastSchoolDays(12);
  let attendanceRows = 0;
  for (const st of studentRows) {
    for (const [di, date] of schoolDays.entries()) {
      const r = rand(di * 31 + st.id.length * 7 + studentRows.indexOf(st) * 13);
      const status = r < 0.08 ? "absent" : r < 0.14 ? "late" : "present";
      await prisma.attendance.upsert({
        where: { studentId_date: { studentId: st.id, date } },
        update: { status },
        create: { studentId: st.id, sectionId: st.sectionId, date, status, takenById: teacherRows[0].id },
      });
      attendanceRows++;
    }
  }
  log(`✔ ${attendanceRows} attendance records`);

  // ---- exams + marks (performance data) ----------------------------------------------------
  // Each student has a base ability; scores drift up over the term for a visible trend.
  const exams = [
    { key: "ct1", name: "Class Test 1", type: "offline" as const, max: 25, daysBack: 56 },
    { key: "mid", name: "Midterm Exam", type: "offline" as const, max: 100, daysBack: 18 },
  ];
  let markCount = 0;
  for (const sec of SECTIONS) {
    const students = studentRows.filter((s) => s.sectionId === sec.id);
    for (let i = 0; i < SUBJECTS.length; i++) {
      for (const [ei, ex] of exams.entries()) {
        const examId = `demo-exam-${sec.id}-${i}-${ex.key}`;
        const data = {
          name: `${ex.name} — ${SUBJECTS[i]}`,
          type: ex.type,
          subjectId: subjectId(sec.cls, i),
          sectionId: sec.id,
          examDate: dateOnly(daysAgo(ex.daysBack)),
          maxMarks: ex.max,
          publishedAt: daysAgo(ex.daysBack - 3),
        };
        await prisma.exam.upsert({ where: { id: examId }, update: data, create: { id: examId, ...data } });
        for (const st of students) {
          const idx = studentRows.indexOf(st);
          const ability = 0.55 + rand(idx * 17 + 3) * 0.4; // 0.55 .. 0.95 per student
          const subjectBias = (rand(idx * 5 + i * 11) - 0.5) * 0.14; // stronger/weaker subjects
          const trend = ei * 0.04; // improvement from test 1 to midterm
          const noise = (rand(idx * 101 + i * 7 + ei * 3) - 0.5) * 0.08;
          const pct = Math.min(0.99, Math.max(0.3, ability + subjectBias + trend + noise));
          const marksObtained = Math.round(pct * ex.max * 2) / 2;
          await prisma.mark.upsert({
            where: { examId_studentId: { examId, studentId: st.id } },
            update: { marksObtained },
            create: { examId, studentId: st.id, marksObtained },
          });
          markCount++;
        }
      }
    }
  }
  log(`✔ ${SECTIONS.length * SUBJECTS.length * exams.length} published exams, ${markCount} marks`);

  // ---- teacher resources + homework -----------------------------------------------------------
  const resourceKinds: Array<{ kind: ResourceKind; title: (s: string) => string; url: string }> = [
    { kind: "pdf", title: (s) => `${s} — Past Exam Paper (Midterm)`, url: "https://example.com/demo/past-paper.pdf" },
    { kind: "slides", title: (s) => `${s} — Chapter 1 Slides`, url: "https://example.com/demo/chapter-1-slides.pdf" },
  ];
  let resourceCount = 0;
  for (const sec of SECTIONS) {
    for (let i = 0; i < SUBJECTS.length; i++) {
      for (const [ri, r] of resourceKinds.entries()) {
        // Keep the data set small: past papers for every subject, slides for the first two only.
        if (ri === 1 && i > 1) continue;
        const id = `demo-res-${sec.id}-${i}-${ri}`;
        const data = {
          title: r.title(SUBJECTS[i]),
          kind: r.kind,
          url: r.url,
          classId: classId(sec.cls),
          sectionId: sec.id,
          subjectId: subjectId(sec.cls, i),
          teacherId: teacherRows[i].id,
          publishedAt: daysAgo(10 + i),
        };
        await prisma.resource.upsert({ where: { id }, update: data, create: { id, ...data } });
        resourceCount++;
      }
    }
    // One upcoming live class and one recorded class per section
    const live = {
      title: "Live revision class — Mathematics",
      kind: "live_link" as ResourceKind,
      url: "https://meet.example.com/demo-revision",
      classId: classId(sec.cls),
      sectionId: sec.id,
      subjectId: subjectId(sec.cls, 1),
      teacherId: teacherRows[1].id,
      scheduledAt: daysFromNow(3),
      publishedAt: daysAgo(1),
    };
    await prisma.resource.upsert({ where: { id: `demo-res-${sec.id}-live` }, update: live, create: { id: `demo-res-${sec.id}-live`, ...live } });
    resourceCount++;
  }

  let hwCount = 0;
  for (const sec of SECTIONS) {
    for (const i of [0, 1, 2]) {
      const aId = `demo-hw-${sec.id}-${i}`;
      const data = {
        title: `${SUBJECTS[i]} homework — Week ${i + 1}`,
        description: `Complete the exercises for ${SUBJECTS[i]} and submit before the due date.`,
        subjectId: subjectId(sec.cls, i),
        sectionId: sec.id,
        teacherId: teacherRows[i].id,
        dueAt: i === 2 ? daysFromNow(4) : daysAgo(5 - i * 2),
      };
      await prisma.assignment.upsert({ where: { id: aId }, update: data, create: { id: aId, ...data } });
      hwCount++;
      if (i === 2) continue; // still open, no submissions yet
      for (const st of studentRows.filter((s) => s.sectionId === sec.id)) {
        const idx = studentRows.indexOf(st);
        if (rand(idx * 9 + i) < 0.15) continue; // a few missing submissions
        const grade = Math.round((6 + rand(idx * 3 + i * 5) * 4) * 2) / 2; // out of 10
        await prisma.submission.upsert({
          where: { assignmentId_studentId: { assignmentId: aId, studentId: st.id } },
          update: {},
          create: {
            assignmentId: aId,
            studentId: st.id,
            body: "Submitted — please see my answers.",
            grade,
            feedback: grade >= 8 ? "Great work!" : "Good effort — review the corrections.",
            gradePublishedAt: daysAgo(1),
          },
        });
      }
    }
  }
  log(`✔ ${resourceCount} teacher resources, ${hwCount} homework assignments with graded submissions`);

  // ---- library -------------------------------------------------------------------------------------
  const books = [
    { id: "demo-book-1", title: "Wings of Fire", author: "A. P. J. Abdul Kalam", isbn: "9788173711466", total: 4, price: 45000 },
    { id: "demo-book-2", title: "Oliver Twist", author: "Charles Dickens", isbn: "9780141439747", total: 3, price: null },
    { id: "demo-book-3", title: "Pather Panchali", author: "Bibhutibhushan Bandyopadhyay", isbn: "9788171674046", total: 3, price: 30000 },
    { id: "demo-book-4", title: "A Brief History of Time", author: "Stephen Hawking", isbn: "9780553380163", total: 2, price: 55000 },
    { id: "demo-book-5", title: "Charlie and the Chocolate Factory", author: "Roald Dahl", isbn: "9780142410318", total: 5, price: 35000 },
    { id: "demo-book-6", title: "Mathematics Olympiad Problems", author: "Various", isbn: null, total: 3, price: null },
    { id: "demo-book-7", title: "Oxford English Dictionary (Concise)", author: "Oxford", isbn: "9780199601080", total: 2, price: null },
    { id: "demo-book-8", title: "Sonar Kella", author: "Satyajit Ray", isbn: "9788172159627", total: 3, price: 25000 },
  ];
  // issued: bookId -> list of (borrower user id, days ago issued, days ago returned|null, fine)
  const issues = [
    { id: "demo-issue-1", book: "demo-book-1", borrower: studentRows[0].userId, issued: 10, returned: null as number | null, fine: null as number | null },
    { id: "demo-issue-2", book: "demo-book-2", borrower: studentRows[2].userId, issued: 30, returned: null, fine: null }, // overdue
    { id: "demo-issue-3", book: "demo-book-4", borrower: teacherRows[2].userId, issued: 8, returned: null, fine: null },
    { id: "demo-issue-4", book: "demo-book-5", borrower: studentRows[4].userId, issued: 40, returned: 20, fine: 3000 }, // returned late, fined
    { id: "demo-issue-5", book: "demo-book-3", borrower: studentRows[6].userId, issued: 12, returned: 5, fine: 0 },
  ];
  for (const b of books) {
    const out = issues.filter((x) => x.book === b.id && x.returned === null).length;
    await prisma.book.upsert({
      where: { id: b.id },
      update: { availableCopies: b.total - out },
      create: { id: b.id, title: b.title, author: b.author, isbn: b.isbn, totalCopies: b.total, availableCopies: b.total - out, priceForSale: b.price },
    });
  }
  for (const x of issues) {
    const data = {
      bookId: x.book,
      borrowerId: x.borrower,
      issuedAt: daysAgo(x.issued),
      dueAt: dateOnly(daysAgo(x.issued - 14)),
      returnedAt: x.returned === null ? null : daysAgo(x.returned),
      fineAmount: x.fine,
    };
    await prisma.bookIssue.upsert({ where: { id: x.id }, update: data, create: { id: x.id, ...data } });
  }
  await prisma.bookSale.upsert({
    where: { id: "demo-sale-1" },
    update: {},
    create: { id: "demo-sale-1", bookId: "demo-book-5", buyerId: parentUserIds[1], quantity: 1, amount: 35000, soldAt: daysAgo(6) },
  });
  log(`✔ library: ${books.length} books, ${issues.length} issues (1 overdue, 1 fined), 1 sale`);

  // ---- salary (previous month, teachers) ------------------------------------------------------------------
  const prev = new Date();
  prev.setUTCMonth(prev.getUTCMonth() - 1);
  for (const [i, t] of teacherRows.entries()) {
    const base = 3_500_000 + i * 250_000;
    await prisma.salary.upsert({
      where: { staffId_month_year: { staffId: t.userId, month: prev.getUTCMonth() + 1, year: prev.getUTCFullYear() } },
      update: {},
      create: { staffId: t.userId, month: prev.getUTCMonth() + 1, year: prev.getUTCFullYear(), baseAmount: base, deductions: 0, bonuses: 100_000, netAmount: base + 100_000, paidAt: daysAgo(3) },
    });
  }

  // ---- CMS: pages, notices, events -------------------------------------------------------------------------------
  const author = created["admin1"];
  const pages: Array<{ slug: string; title: string; html: string; status: "published" | "draft" }> = [
    {
      slug: "about",
      title: "About Our School",
      status: "published",
      html: `<h2>Welcome to ${school.name}</h2><p>We are an English-medium school committed to nurturing curious, confident and kind learners from Class 1 to Class 10.</p><h3>Our mission</h3><p>To give every child a strong academic foundation, a love of learning and the character to lead.</p><h3>Why families choose us</h3><ul><li>Experienced, caring teachers</li><li>Small class sizes with dedicated sections</li><li>Modern science lab and library</li><li>Regular progress updates for parents through the school portal</li></ul>`,
    },
    {
      slug: "admission",
      title: "Admission",
      status: "published",
      html: `<h2>Admission ${yr + 1}</h2><p>Admissions are open for Class 1 to Class 8. Please bring the following documents to the school office:</p><ol><li>Birth certificate (copy)</li><li>Two recent passport-size photographs</li><li>Previous school transfer certificate (for Class 2 and above)</li><li>Parent / guardian national ID (copy)</li></ol><h3>Process</h3><p>Collect the admission form, meet the coordinator, sit a short interview, and complete payment of the admission fee. You will receive portal login details by email.</p><p>Office hours: Sunday to Thursday, 9:00 AM – 3:00 PM.</p>`,
    },
    {
      slug: "contact",
      title: "Contact Us",
      status: "published",
      html: `<h2>Get in touch</h2><p><strong>Address:</strong> 12 School Road, Dhanmondi, Dhaka 1209</p><p><strong>Phone:</strong> +880 1700 000000</p><p><strong>Email:</strong> info@school.test</p><p>Office hours: Sunday to Thursday, 9:00 AM – 3:00 PM.</p>`,
    },
    {
      slug: "gallery",
      title: "Gallery",
      status: "published",
      html: `<h2>Life at school</h2><p>Photos from our annual sports day, science fair and cultural programme will appear here. Check back soon!</p>`,
    },
    {
      slug: "privacy-policy",
      title: "Privacy Policy",
      status: "draft",
      html: `<h2>Privacy Policy</h2><p>Draft — to be reviewed before publishing.</p>`,
    },
  ];
  for (const p of pages) {
    const data = {
      title: p.title,
      bodyHtml: sanitizeHtml(p.html),
      status: p.status,
      publishedAt: p.status === "published" ? daysAgo(20) : null,
      deletedAt: null,
    };
    await prisma.page.upsert({ where: { slug: p.slug }, update: data, create: { slug: p.slug, createdById: author.id, ...data } });
  }

  const notices = [
    { id: "demo-notice-1", title: "Midterm results published", audience: "all" as const, html: "<p>Midterm exam results are now available in the portal. Parents can view them under <strong>Results</strong>.</p>" },
    { id: "demo-notice-2", title: "Parent–teacher meeting", audience: "parents" as const, html: "<p>The parent–teacher meeting will be held next Thursday at 10:00 AM. Please attend with your child's diary.</p>" },
    { id: "demo-notice-3", title: "Staff meeting on Sunday", audience: "teachers" as const, html: "<p>All teachers are requested to attend the staff meeting in the library after Period 5.</p>" },
  ];
  for (const n of notices) {
    const data = { title: n.title, bodyHtml: sanitizeHtml(n.html), audience: n.audience, publishedAt: daysAgo(2), deletedAt: null };
    await prisma.notice.upsert({ where: { id: n.id }, update: data, create: { id: n.id, createdById: author.id, ...data } });
  }
  const events = [
    { id: "demo-event-1", title: "Annual Sports Day", startAt: daysFromNow(21), location: "School Ground", description: "Races, relay and a tug of war. Parents are welcome." },
    { id: "demo-event-2", title: "Science Fair", startAt: daysFromNow(35), location: "Science Block", description: "Student projects from Classes 6–8." },
    { id: "demo-event-3", title: "Winter Break begins", startAt: daysFromNow(70), location: null, description: null },
  ];
  for (const e of events) {
    await prisma.event.upsert({ where: { id: e.id }, update: { ...e, deletedAt: null }, create: e });
  }
  log(`✔ CMS: ${pages.length} pages (1 draft), ${notices.length} notices, ${events.length} events`);

  // ---- public website (Admin -> Website) -------------------------------------------------
  const siteSchool = await prisma.school.findFirst({ where: { deletedAt: null } });
  const siteValues = {
    general: {
      schoolName: siteSchool?.name ?? "Bright Future English Medium School",
      tagline: "Nurturing curious, confident learners",
      logoUrl: "",
      address: "House 12, Road 5, Dhanmondi, Dhaka 1205",
      phone: "+880 1700-000000",
      email: "info@demo.school",
      officeHours: "Sunday–Thursday, 9:00 AM – 3:00 PM",
      mapEmbedUrl: "",
      facebookUrl: "https://facebook.com",
      youtubeUrl: "",
      nav: [
        { key: "home", label: "Home", visible: true },
        { key: "about", label: "About", visible: true },
        { key: "admission", label: "Admission", visible: true },
        { key: "gallery", label: "Gallery", visible: true },
        { key: "contact", label: "Contact", visible: true },
      ],
    },
    home: {
      heroTitle: "Where every child is known by name",
      heroSubtitle: "An English-medium school in Dhaka with small classes, caring teachers and a community that grows together.",
      heroImageUrl: "",
      heroPrimaryLabel: "Apply for admission",
      aboutTitle: "A school that feels like family",
      aboutText: "We follow the English-medium curriculum from Class 1 to 8 with a strong focus on reading, mathematics and character.\nParents see attendance, results and homework the same day, and pay fees online.",
      features: [
        { title: "Live progress for parents", text: "Attendance, results and homework are visible to families the same day." },
        { title: "Clear class routines", text: "Students and teachers always know what is next. The timetable builds itself." },
        { title: "Easy fee payment", text: "See dues and pay with bKash, Nagad or card, with a receipt for every payment." },
        { title: "Learning materials anywhere", text: "Slides, past papers and recorded classes are one tap away." },
      ],
      showTeachers: true,
      showGallery: true,
      showNotices: true,
    },
    admission: { open: true, closedMessage: "Admissions are currently closed. Please check back soon.", intro: "Fill in the form below and our office will contact you within two working days." },
  };
  for (const [key, value] of Object.entries(siteValues)) {
    await prisma.siteSetting.upsert({ where: { key }, update: { value }, create: { key, value } });
  }
  const titles = ["Principal", "Head of Mathematics", "Science Teacher", "Bangla Teacher", "Social Science Teacher"];
  for (const [i, t] of teacherRows.entries()) {
    await prisma.teacher.update({
      where: { id: t.id },
      data: { showOnWebsite: i < 4, websiteOrder: i, designation: titles[i], bio: i < 4 ? "Passionate about helping every child love learning." : null },
    });
  }
  const gallery = ["Sports Day", "Science Fair", "Library Corner", "Morning Assembly"];
  for (const [i, caption] of gallery.entries()) {
    await prisma.galleryImage.upsert({
      where: { id: `demo-gallery-${i + 1}` },
      update: { url: `/demo/gallery-${i + 1}.svg`, caption, sortOrder: i, deletedAt: null },
      create: { id: `demo-gallery-${i + 1}`, url: `/demo/gallery-${i + 1}.svg`, caption, sortOrder: i },
    });
  }
  await prisma.admissionApplication.upsert({
    where: { id: "demo-application-1" },
    update: {},
    create: { id: "demo-application-1", studentName: "Tahmina Rahman", gender: "female", appliedClassId: CLASSES[0].id, previousSchool: "Little Stars Kindergarten", guardianName: "Mizanur Rahman", guardianPhone: "01711223344", guardianEmail: "mizan@example.com", address: "Mohammadpur, Dhaka", message: "We would like to visit the school this week." },
  });
  await prisma.contactMessage.upsert({
    where: { id: "demo-contact-1" },
    update: {},
    create: { id: "demo-contact-1", name: "Sultana Begum", email: "sultana@example.com", phone: "01855667788", message: "Do you offer a school bus service from Mirpur?" },
  });
  log("✔ website: settings, 4 teacher profiles, 4 gallery photos, 1 admission application, 1 contact message");

  return { password: DEMO_PASSWORD };
}

async function upsertInvoice(
  prisma: Db,
  id: string,
  studentId: string,
  feeStructureId: string,
  term: string,
  amountDue: number,
  amountPaid: number,
  dueDate: Date,
  method: "cash" | "bkash"
) {
  const overdue = dueDate.getTime() < Date.now();
  const status: InvoiceStatus =
    amountPaid >= amountDue ? "paid" : amountPaid > 0 ? "partial" : overdue ? "overdue" : "unpaid";
  const data = { studentId, feeStructureId, term, amountDue, amountPaid, status, dueDate: dateOnly(dueDate) };
  await prisma.invoice.upsert({ where: { id }, update: data, create: { id, ...data } });
  if (amountPaid > 0) {
    await prisma.payment.upsert({
      where: { id: `${id}-pay` },
      update: { amount: amountPaid },
      create: { id: `${id}-pay`, invoiceId: id, amount: amountPaid, method, transactionRef: method === "bkash" ? `DEMO${id.slice(-6)}` : null, paidAt: daysAgo(5) },
    });
  }
}

function printCredentials() {
  const rows = [
    ["Super Admin", email("superadmin", 1)],
    ["Admin", `${email("admin", 1)}, ${email("admin", 2)}`],
    ["Coordinator", email("coordinator", 1)],
    ["Accountant", `${email("accountant", 1)}, ${email("accountant", 2)}`],
    ["Librarian", email("librarian", 1)],
    ["Teacher", "teacher1@demo.school … teacher5@demo.school"],
    ["Parent", "parent1@demo.school … parent4@demo.school"],
    ["Student", "student1@demo.school … student8@demo.school"],
  ];
  console.log(`\nDemo logins — password for ALL: ${DEMO_PASSWORD}\n`);
  for (const [role, who] of rows) console.log(`  ${role.padEnd(12)} ${who}`);
  console.log("\n  Tip: parent1 has two children (student1 in 6A, student2 in 8A).\n");
}

if (require.main === module) {
  if (process.env.NODE_ENV === "production") {
    console.error("Refusing to seed demo data with NODE_ENV=production.");
    process.exit(1);
  }
  const prisma = new PrismaClient();
  runDemoSeed(prisma)
    .then(printCredentials)
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
