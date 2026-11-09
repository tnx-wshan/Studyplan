import { AppShell } from "@/components/AppShell";
import { ThemeSync } from "@/components/ThemeSync";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <AppShell>
      <ThemeSync />
      {children}
    </AppShell>
  );
}
