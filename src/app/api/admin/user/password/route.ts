import { z } from "zod";
import { adminResetPassword } from "@/lib/server/accounts";
import { admin, adminError, ok, readBody } from "@/lib/server/admin-api";

/** 비밀번호를 잊은 학생에게 임시 비밀번호를 만들어 준다. 한 번만 보여 주고, 그 학생의 다른 기기 로그인은 풀린다 */
export async function POST(request: Request) {
  return admin(async () => {
    const body = await readBody(request, z.object({ id: z.string() }));
    if (body instanceof Response) return body;
    const password = await adminResetPassword(body.id);
    return password ? ok({ password }) : adminError(404, "가입된 계정이 없는 사용자예요.");
  });
}
