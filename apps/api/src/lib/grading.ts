/**
 * Bangladesh general-education grading scale (percent of full marks):
 *   80+ A+ (5.00) · 70+ A (4.00) · 60+ A- (3.50) · 50+ B (3.00) · 40+ C (2.00) · 33+ D (1.00) · <33 F (0.00)
 * Edit this one table to change the scale for the whole system.
 */
const SCALE: { min: number; grade: string; point: number }[] = [
  { min: 80, grade: "A+", point: 5 },
  { min: 70, grade: "A", point: 4 },
  { min: 60, grade: "A-", point: 3.5 },
  { min: 50, grade: "B", point: 3 },
  { min: 40, grade: "C", point: 2 },
  { min: 33, grade: "D", point: 1 },
  { min: 0, grade: "F", point: 0 },
];

export const round2 = (n: number) => Math.round(n * 100) / 100;

export function gradeFor(percent: number): { grade: string; point: number } {
  const row = SCALE.find((r) => percent >= r.min) ?? SCALE[SCALE.length - 1];
  return { grade: row.grade, point: row.point };
}

/** Overall GPA = mean of subject points; failing any subject fails the student (GPA 0). */
export function summarise(items: { obtained: number; maxMarks: number }[]) {
  const total = items.reduce((a, i) => a + i.obtained, 0);
  const maxTotal = items.reduce((a, i) => a + i.maxMarks, 0);
  const percent = maxTotal > 0 ? round2((total / maxTotal) * 100) : 0;
  const points = items.map((i) => gradeFor(i.maxMarks > 0 ? (i.obtained / i.maxMarks) * 100 : 0).point);
  const passed = items.length > 0 && points.every((p) => p > 0);
  const gpa = passed ? round2(points.reduce((a, b) => a + b, 0) / points.length) : 0;
  const grade = passed ? gradeFor(percent).grade : "F";
  return { total, maxTotal, percent, passed, gpa, grade };
}
