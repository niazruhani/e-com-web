import { headers } from "next/headers";
import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission, type Permission } from "@/lib/permissions";
export { hasPermission } from "@/lib/permissions";

export async function getCurrentUser() {
  if (!process.env.DATABASE_URL || !process.env.AUTH_SECRET) return null;
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, email: true, emailVerified: true, role: true },
  });
  if (!user?.emailVerified) return null;
  return user;
}

export async function userHasPermission(userId: string, permission: Permission) {
  const user = await getCurrentUser();
  if (!user || user.id !== userId) return false;
  return hasPermission(user.role, permission);
}
