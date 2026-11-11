import { admin, ok } from "@/lib/server/admin-api";
import { bankCounts } from "@/lib/server/bank";
import { learnCounts } from "@/lib/server/learn";
import { userCounts } from "@/lib/server/users";
import { aiSetup, PROVIDER_LABELS } from "@/lib/ai/provider";
import { getUsage } from "@/lib/ai/usage";

export async function GET() {
  return admin(async () => {
    const setup = aiSetup();
    return ok({ users: userCounts(), bank: bankCounts(), learn: learnCounts(), ai: { provider: PROVIDER_LABELS[setup.provider], configured: setup.configured, usage: await getUsage() } });
  });
}
