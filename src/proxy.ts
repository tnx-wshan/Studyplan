import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE, SESSION_COOKIE, isAdminServer, verifyAdminToken, verifySessionToken } from "@/lib/auth";

const PUBLIC_PATHS = ["/login", "/intro", "/api/auth/login", "/api/auth/signup", "/api/auth/logout", "/manifest.webmanifest", "/sw.js", "/offline.html"];
const ADMIN_PUBLIC = ["/admin/login", "/api/admin/login"];

const isAdminPath = (p: string) => p === "/admin" || p.startsWith("/admin/") || p.startsWith("/api/admin/");
/** 문제 그림: 관리 화면 미리 보기에서도 쓰므로 관리 서버에서도 연다 (관리자 로그인 필요) */
const isSharedPath = (p: string) => p === "/api/media";

/**
 * 관리 서버(ADMIN_SERVER=1, 다른 포트): 관리 화면만 열고, 관리자 로그인이 필요하다.
 * 학생 서버: 관리 화면은 없는 주소(404)로 보이고, 나머지는 학생 계정으로 로그인해야 열린다.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isAdminServer()) {
    if (!isAdminPath(pathname) && !isSharedPath(pathname)) {
      if (pathname.startsWith("/api/")) return NextResponse.json({ error: "not found" }, { status: 404 });
      return NextResponse.redirect(new URL("/admin", request.url));
    }
    if (ADMIN_PUBLIC.includes(pathname)) return NextResponse.next();
    if (verifyAdminToken(request.cookies.get(ADMIN_COOKIE)?.value)) return NextResponse.next();
    if (pathname.startsWith("/api/")) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }

  if (isAdminPath(pathname)) {
    return new NextResponse("Not Found", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
  }

  if (PUBLIC_PATHS.includes(pathname)) return NextResponse.next();

  if (verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value)) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const url = new URL("/login", request.url);
  if (pathname !== "/") url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|icon.png|icons/).*)"],
};
