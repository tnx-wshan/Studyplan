import { redirect } from "next/navigation";

/** 학습 화면은 첫 화면(/)으로 옮겼다. 예전 주소로 오면 첫 화면으로 보낸다 */
export default function LearnRedirect() {
  redirect("/");
}
