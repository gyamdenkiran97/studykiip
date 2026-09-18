import type { Metadata } from "next";
import { requireActor } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { AddressBook } from "@/components/account/address-book";

export const metadata: Metadata = { title: "Addresses", robots: { index: false, follow: false } };

export default async function AddressesPage() {
  const actor = await requireActor();
  const addresses = await prisma.address.findMany({
    where: { userId: actor.id, deletedAt: null },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
  });

  return (
    <div>
      <h1 className="text-display-3">Addresses</h1>
      <p className="mt-2 text-[14.5px] text-muted">
        Saved addresses appear at checkout so you do not have to type them again.
      </p>
      <AddressBook
        addresses={addresses.map((address) => ({
          id: address.id,
          type: address.type,
          fullName: address.fullName,
          company: address.company,
          line1: address.line1,
          line2: address.line2,
          city: address.city,
          region: address.region,
          postalCode: address.postalCode,
          countryCode: address.countryCode,
          phone: address.phone,
          isDefault: address.isDefault,
        }))}
      />
    </div>
  );
}
