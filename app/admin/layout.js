import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/libs/next-auth";
import config from "@/config";

export default async function AdminLayout({ children }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect(config.auth.loginUrl);

  const adminEmails = (process.env.ADMIN_EMAILS || "").split(",").filter(Boolean);
  if (adminEmails.length && !adminEmails.includes(session.user?.email)) {
    redirect("/");
  }

  return <>{children}</>;
}
