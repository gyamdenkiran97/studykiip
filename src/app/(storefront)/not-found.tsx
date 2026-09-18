import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getCategoryTree } from "@/server/catalog/queries";

/** 404 within the storefront: keeps the chrome, offers a way onward. */
export default async function NotFound() {
  const tree = await getCategoryTree();

  return (
    <div className="shell py-24 text-center">
      <p className="eyebrow text-clay">404</p>
      <h1 className="mt-5 text-display-2">We cannot find that page</h1>
      <p className="mx-auto mt-4 max-w-md text-[15px] leading-relaxed text-muted">
        The link may be out of date, or the product may have been archived. The departments are all still
        here.
      </p>

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button asChild size="lg">
          <Link href="/shop">Browse everything</Link>
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link href="/">Back to the homepage</Link>
        </Button>
      </div>

      <nav aria-label="Departments" className="mx-auto mt-14 max-w-2xl">
        <ul className="flex flex-wrap justify-center gap-x-6 gap-y-2.5">
          {tree.map((department) => (
            <li key={department.slug}>
              <Link
                href={`/category/${department.slug}`}
                className="text-[13.5px] text-muted underline decoration-transparent underline-offset-4 transition-colors hover:text-ink hover:decoration-line-strong"
              >
                {department.name}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
