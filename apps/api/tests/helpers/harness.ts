import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import bcrypt from "bcryptjs";

const g = globalThis as any;
export const db = () => g.__fakePrisma as Record<string, any>;
export const mailbox = (): any[] => g.__mailbox;
export const uploads = (): any[] => g.__uploads;
export const PASSWORD = "Passw0rd!";

let server: Server;
let baseUrl = "";

export async function startServer() {
  const { app } = await import("../../src/app");
  await new Promise<void>((resolve) => {
    server = app.listen(0, "127.0.0.1", () => resolve());
  });
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return baseUrl;
}
export const stopServer = () => new Promise<void>((r) => server.close(() => r()));

export interface Res<T = any> {
  status: number;
  body: T;
  headers: Headers;
}

/** Behaves like a browser session: keeps cookies, fetches + sends the CSRF token. */
export class Client {
  jar = new Map<string, string>();
  csrf: string | null = null;

  private absorbCookies(res: Response) {
    for (const line of res.headers.getSetCookie()) {
      const [pair, ...attrs] = line.split(";");
      const [name, ...rest] = pair.split("=");
      const value = rest.join("=");
      const expired = attrs.some((a) => /max-age=0/i.test(a) || /expires=thu, 01 jan 1970/i.test(a));
      if (expired || value === "") this.jar.delete(name.trim());
      else this.jar.set(name.trim(), value);
    }
  }
  private cookieHeader() {
    return [...this.jar].map(([k, v]) => `${k}=${v}`).join("; ");
  }

  async raw(method: string, path: string, opts: { body?: unknown; form?: FormData; csrf?: boolean; headers?: Record<string, string> } = {}): Promise<Res> {
    const headers: Record<string, string> = { ...(opts.headers ?? {}) };
    if (opts.body !== undefined) headers["content-type"] = "application/json";
    if (method !== "GET" && opts.csrf !== false) {
      if (!this.csrf) this.csrf = (await this.raw("GET", "/auth/csrf-token")).body.csrfToken;
      headers["x-csrf-token"] = this.csrf!;
    }
    // Read cookies AFTER the possible recursive csrf-token fetch above, or
    // this would send the fresh token alongside a stale cookie jar snapshot.
    const cookie = this.cookieHeader();
    if (cookie) headers.cookie = cookie;
    const res = await fetch(baseUrl + path, {
      method,
      headers,
      body: opts.form ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined),
      redirect: "manual",
    });
    this.absorbCookies(res);
    const text = await res.text();
    let body: any = text;
    try { body = text ? JSON.parse(text) : undefined; } catch { /* non-JSON */ }
    return { status: res.status, body, headers: res.headers };
  }
  get = (path: string) => this.raw("GET", path);
  post = (path: string, body?: unknown) => this.raw("POST", path, { body: body ?? {} });
  patch = (path: string, body?: unknown) => this.raw("PATCH", path, { body: body ?? {} });
  del = (path: string) => this.raw("DELETE", path);

  async login(email: string, password = PASSWORD): Promise<Res> {
    const res = await this.raw("POST", "/auth/login", { body: { email, password }, csrf: false });
    this.csrf = null; // session changed -> token must be re-fetched (the real web client does the same)
    return res;
  }
}

// ---------------------------------------------------------------- fixtures --
const hash = bcrypt.hashSync(PASSWORD, 4);

export async function makeUser(role: string, name: string, extra: Record<string, unknown> = {}) {
  return db().user.create({
    data: { name, email: `${name.toLowerCase().replace(/\s+/g, ".")}@test.school`, passwordHash: hash, role, ...extra },
  });
}

/** A small but complete school: staff of every role, two sections, two families. */
export async function seedSchool() {
  const d = db();
  d.__reset();
  mailbox().length = 0;
  uploads().length = 0;

  const school = await d.school.create({ data: { name: "Test School" } });
  const shift = await d.shift.create({ data: { name: "Morning", schoolId: school.id } });
  const cls = await d.class.create({ data: { name: "Class 6", schoolId: school.id, shiftId: shift.id } });
  const campus = await d.campus.create({ data: { name: "Main", schoolId: school.id } });
  const building = await d.building.create({ data: { name: "A", campusId: campus.id } });
  const room = await d.room.create({ data: { name: "101", buildingId: building.id } });
  const sectionA = await d.section.create({ data: { name: "A", classId: cls.id, roomId: room.id } });
  const sectionB = await d.section.create({ data: { name: "B", classId: cls.id } });
  const math = await d.subject.create({ data: { name: "Mathematics", classId: cls.id } });
  const english = await d.subject.create({ data: { name: "English", classId: cls.id } });

  const superAdmin = await makeUser("super_admin", "Super Admin");
  const admin = await makeUser("admin", "Ada Admin");
  const coordinator = await makeUser("coordinator", "Cora Coordinator");
  const accountant = await makeUser("accountant", "Acc Ountant");
  const librarian = await makeUser("librarian", "Lib Rarian");

  const teacherUser = await makeUser("teacher", "Tina Teacher");
  const teacher = await d.teacher.create({ data: { userId: teacherUser.id, phone: "01711111111" } });
  const teacher2User = await makeUser("teacher", "Tom Teacher");
  const teacher2 = await d.teacher.create({ data: { userId: teacher2User.id } });

  const parentUser = await makeUser("parent", "Pat Parent");
  const guardian = await d.guardian.create({ data: { userId: parentUser.id, phone: "01822222222" } });
  const studentUser = await makeUser("student", "Sam Student");
  const student = await d.student.create({ data: { userId: studentUser.id, rollNumber: "01", sectionId: sectionA.id, guardianId: guardian.id } });
  const student2User = await makeUser("student", "Sue Student");
  const student2 = await d.student.create({ data: { userId: student2User.id, rollNumber: "02", sectionId: sectionA.id, guardianId: guardian.id } });

  const otherParentUser = await makeUser("parent", "Olly Otherparent");
  const otherGuardian = await d.guardian.create({ data: { userId: otherParentUser.id } });
  const otherStudentUser = await makeUser("student", "Otto Other");
  const otherStudent = await d.student.create({ data: { userId: otherStudentUser.id, rollNumber: "01", sectionId: sectionB.id, guardianId: otherGuardian.id } });

  for (const category of ["absence_alert", "fee_due", "exam_schedule", "result_published", "general_notice", "password_reset"]) {
    await d.messagingFeatureToggle.create({ data: { category, smsEnabled: false } });
  }

  return {
    school, shift, cls, room, sectionA, sectionB, math, english,
    superAdmin, admin, coordinator, accountant, librarian,
    teacherUser, teacher, teacher2User, teacher2,
    parentUser, guardian, studentUser, student, student2User, student2,
    otherParentUser, otherGuardian, otherStudentUser, otherStudent,
  };
}

export type World = Awaited<ReturnType<typeof seedSchool>>;

export async function loginAs(email: string) {
  const c = new Client();
  const res = await c.login(email);
  if (res.status !== 200) throw new Error(`login failed for ${email}: ${res.status} ${JSON.stringify(res.body)}`);
  return c;
}
export const emailOf = (u: { email: string }) => u.email;
