import { PrismaClient } from "@prisma/client";

const roles = ["admin", "manager", "support", "fulfillment"] as const;
type StaffRole = (typeof roles)[number];

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required.");
  }

  const [email, requestedRole] = process.argv.slice(2);
  if (!email || !roles.includes(requestedRole as StaffRole)) {
    throw new Error(`Usage: npm run admin:role -- <existing-user-email> ${roles.join("|")}`);
  }

  const prisma = new PrismaClient();
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw new Error("No account exists for that email.");
    if (!user.emailVerified) throw new Error("Verify this account's email before assigning staff access.");

    await prisma.$transaction([
      prisma.user.update({ where: { id: user.id }, data: { role: requestedRole } }),
      prisma.auditLog.create({
        data: {
          actorId: null,
          action: "STAFF_ROLE_BOOTSTRAP",
          resource: "User",
          resourceId: user.id,
          changes: { previousRole: user.role, role: requestedRole },
        },
      }),
    ]);
    console.info(`Assigned ${requestedRole} access to the verified account.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error("Staff role assignment failed.", error);
  process.exitCode = 1;
});
