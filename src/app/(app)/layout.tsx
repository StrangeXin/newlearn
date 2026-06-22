import { redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { AssistantWidget } from "@/components/assistant-widget";
import { passwordChangeRequired, requireUser } from "@/lib/auth/user";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  // 首登强制改密：未改密前一律先去改密页（可由 REQUIRE_PASSWORD_CHANGE=false 临时关闭）
  if (user.mustChangePassword && passwordChangeRequired()) redirect("/change-password");

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <AppHeader user={user} />
      <div className="flex-1">{children}</div>
      <AssistantWidget />
    </div>
  );
}
