/** 서버가 시작될 때 한 번 실행: 알림 스케줄러 시작 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startReminderScheduler } = await import("./lib/push/server");
    startReminderScheduler();
  }
}
