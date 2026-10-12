/**
 * In-memory stand-in for PrismaClient, driven by the REAL generated schema
 * (Prisma.dmmf). Used only by the test suite so the actual Express app,
 * middleware, services and controllers can be exercised end-to-end without
 * a database. It enforces the same things Postgres would for this app:
 * primary/unique keys (P2002), foreign keys (P2003), and "record not found"
 * on update/delete (P2025). It is NOT a full Prisma implementation — only
 * the query features this codebase uses.
 */
import { Prisma } from "@prisma/client";

type Row = Record<string, any>;
type Field = (typeof Prisma.dmmf.datamodel.models)[number]["fields"][number];
type Model = (typeof Prisma.dmmf.datamodel.models)[number];

const MODELS = Prisma.dmmf.datamodel.models;
const modelByName = new Map<string, Model>(MODELS.map((m) => [m.name, m]));
const lowerFirst = (s: string) => s[0].toLowerCase() + s.slice(1);

function knownError(code: string, message: string) {
  return Object.assign(new Error(message), { code, name: "PrismaClientKnownRequestError" });
}

const eq = (a: any, b: any) => {
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  if (a instanceof Date && typeof b === "string") return a.getTime() === new Date(b).getTime();
  return a === b;
};
const toComparable = (v: any) => (v instanceof Date ? v.getTime() : v);

export function createFakePrisma() {
  const tables = new Map<string, Row[]>(MODELS.map((m) => [m.name, []]));
  let idCounter = 0;
  const nextId = () => `c${(++idCounter).toString(36).padStart(8, "0")}`;

  const scalarFields = (m: Model) => m.fields.filter((f) => f.kind !== "object");
  const relField = (m: Model, name: string) => m.fields.find((f) => f.name === name && f.kind === "object");

  // ---- relation resolution -------------------------------------------------
  function relatedRows(model: Model, row: Row, field: Field): Row[] {
    const related = modelByName.get(field.type)!;
    const table = tables.get(related.name)!;
    if (field.relationFromFields && field.relationFromFields.length > 0) {
      // this side holds the FK
      return table.filter((r) =>
        field.relationFromFields!.every((f, i) => row[f] != null && eq(r[field.relationToFields![i]], row[f]))
      );
    }
    // other side holds the FK
    const opp = related.fields.find((f) => f.relationName === field.relationName && f.kind === "object")!;
    return table.filter((r) =>
      opp.relationFromFields!.every((f, i) => row[opp.relationToFields![i]] != null && eq(r[f], row[opp.relationToFields![i]]))
    );
  }

  // ---- where ---------------------------------------------------------------
  function scalarMatches(rowVal: any, cond: any): boolean {
    if (cond === undefined) return true;
    if (cond === null) return rowVal == null;
    if (cond instanceof Date || typeof cond !== "object") return eq(rowVal, cond);
    for (const [op, v] of Object.entries(cond)) {
      if (v === undefined) continue;
      switch (op) {
        case "equals": if (!scalarMatches(rowVal, v)) return false; break;
        case "not": if (v === null ? rowVal == null : scalarMatches(rowVal, v)) return false; break;
        case "in": if (!(v as any[]).some((x) => eq(rowVal, x))) return false; break;
        case "notIn": if ((v as any[]).some((x) => eq(rowVal, x))) return false; break;
        case "gt": if (!(toComparable(rowVal) > toComparable(v))) return false; break;
        case "gte": if (!(toComparable(rowVal) >= toComparable(v))) return false; break;
        case "lt": if (!(toComparable(rowVal) < toComparable(v))) return false; break;
        case "lte": if (!(toComparable(rowVal) <= toComparable(v))) return false; break;
        case "contains": {
          const insensitive = (cond as any).mode === "insensitive";
          const hay = String(rowVal ?? "");
          if (!(insensitive ? hay.toLowerCase().includes(String(v).toLowerCase()) : hay.includes(v as string))) return false;
          break;
        }
        case "startsWith": if (!String(rowVal ?? "").startsWith(v as string)) return false; break;
        case "endsWith": if (!String(rowVal ?? "").endsWith(v as string)) return false; break;
        case "mode": break; // consumed by "contains"
        default: throw new Error(`fake-prisma: unsupported filter operator "${op}"`);
      }
    }
    return true;
  }

  function matches(model: Model, row: Row, where: any): boolean {
    if (!where) return true;
    for (const [key, val] of Object.entries(where)) {
      if (val === undefined) continue;
      if (key === "AND") { if (!(val as any[]).every((w) => matches(model, row, w))) return false; continue; }
      if (key === "OR") { if (!(val as any[]).some((w) => matches(model, row, w))) return false; continue; }
      if (key === "NOT") { if (matches(model, row, val)) return false; continue; }
      const field = model.fields.find((f) => f.name === key);
      if (!field) {
        // compound unique selector, e.g. { studentId_date: { studentId, date } }
        if (!matches(model, row, val)) return false;
        continue;
      }
      if (field.kind === "object") {
        const rel = relatedRows(model, row, field);
        const related = modelByName.get(field.type)!;
        const v: any = val;
        if (field.isList) {
          if (v.some && !rel.some((r) => matches(related, r, v.some))) return false;
          if (v.every && !rel.every((r) => matches(related, r, v.every))) return false;
          if (v.none && rel.some((r) => matches(related, r, v.none))) return false;
        } else {
          const target = rel[0] ?? null;
          const cond = v.is !== undefined ? v.is : v;
          if (cond === null) { if (target) return false; }
          else if (!target || !matches(related, target, cond)) return false;
        }
        continue;
      }
      if (!scalarMatches(row[key], val)) return false;
    }
    return true;
  }

  // ---- ordering / include --------------------------------------------------
  function orderValue(model: Model, row: Row, spec: any): any {
    const [k, v] = Object.entries(spec)[0] as [string, any];
    const field = model.fields.find((f) => f.name === k)!;
    if (field.kind === "object") {
      const rel = relatedRows(model, row, field)[0];
      return rel ? orderValue(modelByName.get(field.type)!, rel, v) : null;
    }
    return row[k];
  }
  function directionOf(spec: any): "asc" | "desc" {
    const [, v] = Object.entries(spec)[0] as [string, any];
    return typeof v === "string" ? (v as "asc" | "desc") : directionOf(v);
  }
  function sortRows(model: Model, rows: Row[], orderBy: any): Row[] {
    if (!orderBy) return rows;
    const specs = Array.isArray(orderBy) ? orderBy : [orderBy];
    return [...rows].sort((a, b) => {
      for (const spec of specs) {
        const av = toComparable(orderValue(model, a, spec));
        const bv = toComparable(orderValue(model, b, spec));
        if (av === bv) continue;
        if (av == null) return 1;
        if (bv == null) return -1;
        const cmp = av < bv ? -1 : 1;
        return directionOf(spec) === "desc" ? -cmp : cmp;
      }
      return 0;
    });
  }

  function shape(model: Model, row: Row, include?: Record<string, any>): Row {
    const out: Row = {};
    for (const f of scalarFields(model)) out[f.name] = row[f.name] instanceof Date ? new Date(row[f.name]) : row[f.name];
    if (include) {
      for (const [name, arg] of Object.entries(include)) {
        if (!arg) continue;
        const field = relField(model, name);
        if (!field) throw new Error(`fake-prisma: unknown relation "${name}" on ${model.name}`);
        const related = modelByName.get(field.type)!;
        let rows = relatedRows(model, row, field);
        const nested = arg === true ? {} : arg;
        if (nested.where) rows = rows.filter((r) => matches(related, r, nested.where));
        rows = sortRows(related, rows, nested.orderBy);
        if (nested.skip) rows = rows.slice(nested.skip);
        if (nested.take != null) rows = rows.slice(0, nested.take);
        const shaped = rows.map((r) => shape(related, r, nested.include));
        out[name] = field.isList ? shaped : shaped[0] ?? null;
      }
    }
    return out;
  }

  // ---- writes --------------------------------------------------------------
  function checkUnique(model: Model, row: Row, ignore?: Row) {
    const table = tables.get(model.name)!;
    const keys: string[][] = [
      ...(model.primaryKey ? [model.primaryKey.fields] : []),
      ...model.uniqueIndexes.map((u) => u.fields),
      ...model.fields.filter((f) => f.isId || f.isUnique).map((f) => [f.name]),
    ];
    for (const key of keys) {
      if (key.some((k) => row[k] == null)) continue;
      const clash = table.find((r) => r !== ignore && key.every((k) => eq(r[k], row[k])));
      if (clash) throw knownError("P2002", `Unique constraint failed on ${model.name}(${key.join(", ")})`);
    }
  }
  function checkForeignKeys(model: Model, row: Row) {
    for (const f of model.fields.filter((x) => x.kind === "object" && x.relationFromFields?.length)) {
      const fks = f.relationFromFields!;
      if (fks.every((k) => row[k] == null)) continue;
      const parent = tables.get(f.type)!.find((p) => fks.every((k, i) => eq(p[f.relationToFields![i]], row[k])));
      if (!parent) throw knownError("P2003", `Foreign key constraint failed on ${model.name}.${fks.join(",")}`);
    }
  }

  function defaultFor(f: Field): any {
    const d: any = f.default;
    if (d === undefined) return undefined;
    if (typeof d === "object" && d !== null && "name" in d) {
      if (d.name === "cuid" || d.name === "uuid") return nextId();
      if (d.name === "now") return new Date();
      return undefined;
    }
    return d;
  }

  function buildRow(model: Model, data: Row): { row: Row; nested: [Field, any][] } {
    const row: Row = {};
    const nested: [Field, any][] = [];
    for (const f of scalarFields(model)) {
      let v = data[f.name];
      if (v === undefined) v = f.isUpdatedAt ? new Date() : defaultFor(f);
      if (v === undefined) {
        if (f.isRequired) throw new Error(`fake-prisma: missing required field ${model.name}.${f.name}`);
        v = null;
      }
      row[f.name] = v;
    }
    for (const key of Object.keys(data)) {
      const f = relField(model, key);
      if (f && data[key] !== undefined) nested.push([f, data[key]]);
      else if (!f && !model.fields.some((x) => x.name === key) && data[key] !== undefined) {
        throw new Error(`fake-prisma: unknown field "${key}" on ${model.name}`);
      }
    }
    return { row, nested };
  }

  function insert(modelName: string, data: Row): Row {
    const model = modelByName.get(modelName)!;
    const { row, nested } = buildRow(model, data);
    checkUnique(model, row);
    checkForeignKeys(model, row);
    tables.get(modelName)!.push(row);
    for (const [field, arg] of nested) {
      const related = modelByName.get(field.type)!;
      const opp = related.fields.find((f) => f.relationName === field.relationName && f.kind === "object")!;
      const creates = arg.create ? (Array.isArray(arg.create) ? arg.create : [arg.create]) : [];
      for (const c of creates) {
        const child = { ...c };
        opp.relationFromFields!.forEach((fk, i) => (child[fk] = row[opp.relationToFields![i]]));
        insert(related.name, child);
      }
    }
    return row;
  }

  function findRows(model: Model, where: any): Row[] {
    return tables.get(model.name)!.filter((r) => matches(model, r, where));
  }

  function applyUpdate(model: Model, row: Row, data: Row) {
    const draft = { ...row };
    for (const [k, v] of Object.entries(data)) {
      if (v === undefined) continue;
      const f = model.fields.find((x) => x.name === k);
      if (!f || f.kind === "object") throw new Error(`fake-prisma: cannot update "${k}" on ${model.name}`);
      // JSON columns hold plain objects; store them as-is rather than treating them as operators.
      if (f.type === "Json") draft[k] = v;
      else if (v && typeof v === "object" && !(v instanceof Date)) {
        const op = v as any;
        if ("increment" in op) draft[k] = (draft[k] ?? 0) + op.increment;
        else if ("decrement" in op) draft[k] = (draft[k] ?? 0) - op.decrement;
        else if ("set" in op) draft[k] = op.set;
        else throw new Error(`fake-prisma: unsupported update operator on ${model.name}.${k}`);
      } else draft[k] = v;
    }
    const updatedAt = model.fields.find((f) => f.isUpdatedAt);
    if (updatedAt) draft[updatedAt.name] = new Date();
    checkUnique(model, draft, row);
    checkForeignKeys(model, draft);
    Object.assign(row, draft);
  }

  function delegate(model: Model) {
    const one = (where: any) => findRows(model, where)[0] ?? null;
    return {
      findUnique: async (a: any) => { const r = one(a.where); return r ? shape(model, r, a.include) : null; },
      findFirst: async (a: any = {}) => {
        const rows = sortRows(model, findRows(model, a.where), a.orderBy);
        return rows[0] ? shape(model, rows[0], a.include) : null;
      },
      findMany: async (a: any = {}) => {
        let rows = sortRows(model, findRows(model, a.where), a.orderBy);
        if (a.skip) rows = rows.slice(a.skip);
        if (a.take != null) rows = rows.slice(0, a.take);
        return rows.map((r) => shape(model, r, a.include));
      },
      count: async (a: any = {}) => findRows(model, a.where).length,
      create: async (a: any) => shape(model, insert(model.name, a.data), a.include),
      update: async (a: any) => {
        const r = one(a.where);
        if (!r) throw knownError("P2025", `${model.name} not found`);
        applyUpdate(model, r, a.data);
        return shape(model, r, a.include);
      },
      updateMany: async (a: any) => {
        const rows = findRows(model, a.where);
        rows.forEach((r) => applyUpdate(model, r, a.data));
        return { count: rows.length };
      },
      upsert: async (a: any) => {
        const r = one(a.where);
        if (r) { applyUpdate(model, r, a.update); return shape(model, r, a.include); }
        return shape(model, insert(model.name, a.create), a.include);
      },
      delete: async (a: any) => {
        const r = one(a.where);
        if (!r) throw knownError("P2025", `${model.name} not found`);
        const t = tables.get(model.name)!;
        t.splice(t.indexOf(r), 1);
        return shape(model, r);
      },
      deleteMany: async (a: any = {}) => {
        const rows = findRows(model, a.where);
        const t = tables.get(model.name)!;
        rows.forEach((r) => t.splice(t.indexOf(r), 1));
        return { count: rows.length };
      },
    };
  }

  const client: Record<string, any> = {
    $transaction: async (arg: any) => (typeof arg === "function" ? arg(client) : Promise.all(arg)),
    $disconnect: async () => {},
    /** test helper: raw rows of a table (copy) */
    __rows: (name: string) => (tables.get(name) ?? []).map((r) => ({ ...r })),
    __reset: () => tables.forEach((t) => (t.length = 0)),
  };
  for (const m of MODELS) client[lowerFirst(m.name)] = delegate(m);
  return client;
}
