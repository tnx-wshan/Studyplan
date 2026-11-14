/**
 * 이 기기에서 로그인한 계정과 기기 데이터(IndexedDB)의 연결.
 * 학생 데이터는 기기 안에만 있으므로 계정마다 DB를 따로 둔다 (같은 기기에서 계정을 바꿔도 서로 섞이지 않는다).
 *   - 계정 도입 전부터 있던 DB("homestudy")는 이 기기에서 처음 로그인한 계정이 이어받는다.
 *   - 그 뒤에 다른 계정으로 로그인하면 "homestudy-<계정id>"를 새로 쓴다.
 */

const ACCOUNT_KEY = "hs-account";
const LEGACY_OWNER_KEY = "hs-legacy-owner";
export const LEGACY_DB_NAME = "homestudy";

function read(key: string): string | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {}
}

export function dbNameFor(accountId: string | null, legacyOwner: string | null): string {
  if (!accountId || !legacyOwner || accountId === legacyOwner) return LEGACY_DB_NAME;
  return `${LEGACY_DB_NAME}-${accountId}`;
}

/** 지금 쓸 기기 DB 이름 */
export function currentDbName(): string {
  return dbNameFor(read(ACCOUNT_KEY), read(LEGACY_OWNER_KEY));
}

export function currentAccountId(): string | null {
  return read(ACCOUNT_KEY);
}

/** 로그인·가입에 성공하면 부른다. 이 기기는 이제 이 계정으로 쓴다 */
export function signInDevice(accountId: string) {
  if (!read(LEGACY_OWNER_KEY)) write(LEGACY_OWNER_KEY, accountId);
  write(ACCOUNT_KEY, accountId);
}

/** 로그아웃. 기기 데이터는 지우지 않고, 다음에 같은 계정으로 로그인하면 그대로 돌아온다 */
export function signOutDevice() {
  write(ACCOUNT_KEY, null);
  // 화면 상태(이용 정지 표시 등)는 계정마다 다르므로 비운다
  write("hs-user-status", null);
}
