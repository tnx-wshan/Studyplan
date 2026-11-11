import { z } from "zod";
import { admin, adminError, ok, readBody } from "@/lib/server/admin-api";
import { addCommand, cancelCommand } from "@/lib/server/users";
import { CommandSchema } from "@/lib/sync/types";

const Body = z.object({ id: z.string(), command: CommandSchema });

/** 사용자 값 고치기: 명령으로 쌓아 두면 기기가 다음 접속(보통 몇 분 안) 때 적용한다 */
export async function POST(request: Request) {
  return admin(async () => {
    const body = await readBody(request, Body);
    if (body instanceof Response) return body;
    const command = addCommand(body.id, body.command);
    return command ? ok({ command }) : adminError(404, "사용자를 찾을 수 없어요.");
  });
}

export async function DELETE(request: Request) {
  return admin(() => {
    const url = new URL(request.url);
    const done = cancelCommand(url.searchParams.get("id") ?? "", Number(url.searchParams.get("commandId")));
    return done ? ok() : adminError(409, "이미 적용된 명령은 취소할 수 없어요.");
  });
}
