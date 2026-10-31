import "server-only";

import type { RowDataPacket } from "mysql2/promise";
import { AuthError } from "./auth-errors";
import type { AuthPool } from "./mysql-users";

/**
 * Legacy student lookup adapter for `stud2022`.
 *
 * Security guarantees:
 * - Uses strictly parameterized queries (`?` parameter placeholder).
 * - Never selects or touches legacy credential columns (`killer`, `reset_token`).
 * - Read-only query; never performs INSERT, UPDATE, or DELETE on `stud2022`.
 */

export type Stud2022Record = {
  id: number;
  reg_no: string;
  dob: string | Date;
  status: string;
  email?: string | null;
  name?: string | null;
};

export type StudentStore = {
  findByRegNo(regNo: string): Promise<Stud2022Record | null>;
};

function toStoreError(error: unknown): AuthError {
  if (error instanceof AuthError) return error;
  return new AuthError("store-error", 500, "Account service is unavailable.");
}

export class MySqlStudentStore implements StudentStore {
  constructor(private readonly pool: AuthPool) {}

  async findByRegNo(regNo: string): Promise<Stud2022Record | null> {
    const trimmed = regNo.trim();
    if (!trimmed) return null;
    try {
      // Parameterized query with explicit safe column projection
      // Never selects 'killer' or 'reset_token'
      const [rows] = await this.pool.query(
        "SELECT id, reg_no, dob, status, email FROM stud2022 WHERE TRIM(reg_no) = ? LIMIT 1",
        [trimmed],
      );
      const row = (rows as (RowDataPacket & Stud2022Record)[])[0];
      return row ?? null;
    } catch (error) {
      throw toStoreError(error);
    }
  }
}

export class MemoryStudentStore implements StudentStore {
  private students = new Map<string, Stud2022Record>();

  constructor(initialStudents?: Stud2022Record[]) {
    if (initialStudents) {
      for (const s of initialStudents) {
        this.add(s);
      }
    }
  }

  add(student: Stud2022Record): void {
    this.students.set(student.reg_no.trim().toLowerCase(), { ...student });
  }

  async findByRegNo(regNo: string): Promise<Stud2022Record | null> {
    const key = regNo.trim().toLowerCase();
    const student = this.students.get(key);
    return student ? { ...student } : null;
  }
}
