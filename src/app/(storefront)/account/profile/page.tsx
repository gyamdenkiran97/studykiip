import type { Metadata } from "next";
import { requireActor } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { ProfileForms } from "@/components/account/profile-forms";

export const metadata: Metadata = { title: "Profile & security", robots: { index: false, follow: false } };

export default async function ProfilePage() {
  const actor = await requireActor();
  const [user, sessionCount] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: actor.id },
      select: { name: true, email: true, phone: true, marketingOptIn: true, emailVerified: true, createdAt: true },
    }),
    prisma.session.count({ where: { userId: actor.id, expiresAt: { gt: new Date() } } }),
  ]);

  return (
    <div>
      <h1 className="text-display-3">Profile &amp; security</h1>
      <ProfileForms
        name={user.name}
        email={user.email}
        phone={user.phone}
        marketingOptIn={user.marketingOptIn}
        emailVerified={user.emailVerified}
        memberSince={user.createdAt.toISOString()}
        activeSessions={sessionCount}
      />
    </div>
  );
}
