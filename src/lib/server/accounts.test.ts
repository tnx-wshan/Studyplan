import { beforeEach, describe, expect, it } from "vitest";
import { openMemoryDb } from "./db";
import { adminResetPassword, adoptDeviceUser, authenticate, changePassword, createAccount, getAccount } from "./accounts";
import { addCommand, getUser, syncUser } from "./users";
import { isValidEmail, normalizeEmail, passwordProblem } from "@/lib/account";

beforeEach(() => {
  openMemoryDb();
});

const snapshot = { level: 1, totalXp: 0, coins: 0, freezes: 0, streak: 0, longestStreak: 0, learnDone: [], learnTodaySec: 0, learnWeekSec: 0 };

describe("account input", () => {
  it("normalizes and validates email", () => {
    expect(normalizeEmail("  Kim@Example.COM ")).toBe("kim@example.com");
    expect(isValidEmail("kim@example.com")).toBe(true);
    for (const bad of ["", "kim", "kim@", "@example.com", "kim@example", "k im@example.com", "kim@@example.com"]) expect(isValidEmail(bad)).toBe(false);
  });

  it("requires 8+ chars with a letter and a digit", () => {
    expect(passwordProblem("abc12345")).toBeNull();
    expect(passwordProblem("abc1234")).toMatch(/8자/);
    expect(passwordProblem("abcdefgh")).toMatch(/숫자/);
    expect(passwordProblem("12345678")).toMatch(/영문자/);
  });
});

describe("accounts", () => {
  it("signs up, logs in with any email casing, and never stores the password", async () => {
    const made = await createAccount("Kim@Example.com", "pass1234");
    expect(made.ok && made.account.email).toBe("kim@example.com");
    const row = (await import("./db")).serverDb().prepare("SELECT password_hash FROM accounts").get() as { password_hash: string };
    expect(row.password_hash).toMatch(/^scrypt\$/);
    expect(row.password_hash).not.toContain("pass1234");

    const ok = await authenticate("KIM@example.com ", "pass1234");
    expect(ok.ok && ok.account.id).toBe(made.ok && made.account.id);
    const wrong = await authenticate("kim@example.com", "pass12345");
    expect(wrong).toMatchObject({ ok: false, status: 401 });
    // 없는 메일과 틀린 비밀번호는 같은 문구
    const none = await authenticate("none@example.com", "pass1234");
    expect(none.ok === false && wrong.ok === false && none.error === wrong.error).toBe(true);
  });

  it("rejects a duplicate email and weak passwords", async () => {
    await createAccount("a@example.com", "pass1234");
    expect(await createAccount("A@example.com", "other1234")).toMatchObject({ ok: false, status: 409 });
    expect(await createAccount("b@example.com", "short1")).toMatchObject({ ok: false, status: 400 });
    expect(await createAccount("not-an-email", "pass1234")).toMatchObject({ ok: false, status: 400 });
  });

  it("changes the password, bumps the session version, and checks the current one", async () => {
    const made = await createAccount("a@example.com", "pass1234");
    if (!made.ok) throw new Error("signup failed");
    const id = made.account.id;
    expect(await changePassword(id, "wrong1234", "newpass99")).toMatchObject({ ok: false, status: 401 });
    expect(await changePassword(id, "pass1234", "weak")).toMatchObject({ ok: false, status: 400 });
    expect(await changePassword(id, "pass1234", "pass1234")).toMatchObject({ ok: false, status: 400 });
    const changed = await changePassword(id, "pass1234", "newpass99");
    expect(changed.ok && changed.account.sessionVersion).toBe(1);
    expect(getAccount(id)?.sessionVersion).toBe(1);
    expect(await authenticate("a@example.com", "pass1234")).toMatchObject({ ok: false });
    expect((await authenticate("a@example.com", "newpass99")).ok).toBe(true);
  });

  it("lets an admin hand out a temporary password that forces re-login elsewhere", async () => {
    const made = await createAccount("a@example.com", "pass1234");
    if (!made.ok) throw new Error("signup failed");
    const temp = await adminResetPassword(made.account.id);
    expect(temp && passwordProblem(temp)).toBeNull();
    expect((await authenticate("a@example.com", temp!)).ok).toBe(true);
    expect((await authenticate("a@example.com", "pass1234")).ok).toBe(false);
    expect(getAccount(made.account.id)?.sessionVersion).toBe(1);
    expect(await adminResetPassword("nope")).toBeNull();
  });

  it("moves a pre-account device record onto the account id", async () => {
    const made = await createAccount("a@example.com", "pass1234");
    if (!made.ok) throw new Error("signup failed");
    const device = "33333333-3333-4333-8333-333333333333";
    syncUser({ userId: device, nickname: "공부왕", grade: "고1", snapshot, lastCommandId: 0 });
    addCommand(device, { type: "setCoins", payload: { coins: 5 } });
    adoptDeviceUser(made.account.id, device);
    expect(getUser(device)).toBeNull();
    const user = getUser(made.account.id);
    expect(user?.nickname).toBe("공부왕");
    expect(user?.commands).toHaveLength(1);
    // 이미 이 계정의 기록이 있으면 다시 옮기지 않는다
    syncUser({ userId: device, nickname: "다른 기기", grade: "고1", snapshot, lastCommandId: 0 });
    adoptDeviceUser(made.account.id, device);
    expect(getUser(device)?.nickname).toBe("다른 기기");
    expect(getUser(made.account.id)?.nickname).toBe("공부왕");
  });
});
