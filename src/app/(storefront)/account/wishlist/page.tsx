import { redirect } from "next/navigation";

/** The wishlist has a public-facing home; keep one implementation. */
export default function AccountWishlistPage() {
  redirect("/wishlist");
}
