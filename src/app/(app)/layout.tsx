import { redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { requireUser } from "@/lib/auth/user";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  // 首登强制改密：未改密前一律先去改密页
  if (user.mustChangePassword) redirect("/change-password");

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <AppHeader user={user} />
      <div className="flex-1">{children}</div>
    </div>
  );
}
