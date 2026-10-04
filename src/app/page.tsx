import { redirect } from "next/navigation";
import { getSessionUser, homePathForRole } from "@/lib/auth/session";

export default async function HomePage() {
  const session = await getSessionUser();
  if (!session) redirect("/login");
  redirect(homePathForRole(session.profile.role));
}
