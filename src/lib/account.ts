/** 계정 입력 검사 (서버와 화면이 함께 쓴다) */

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 64;

export function normalizeEmail(input: string): string {
  return input.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return email.length <= 120 && /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(email);
}

/** 문제가 있으면 안내 문구, 괜찮으면 null */
export function passwordProblem(password: string): string | null {
  if (password.length < PASSWORD_MIN) return `비밀번호는 ${PASSWORD_MIN}자 이상이어야 해요.`;
  if (password.length > PASSWORD_MAX) return `비밀번호는 ${PASSWORD_MAX}자까지 쓸 수 있어요.`;
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) return "비밀번호에 영문자와 숫자를 모두 넣어 주세요.";
  return null;
}
