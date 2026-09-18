import { CartProvider } from "@/components/storefront/cart-provider";
import { CartDrawer } from "@/components/storefront/cart-drawer";
import { Header } from "@/components/storefront/header";
import { Footer } from "@/components/storefront/footer";
import { MobileBar } from "@/components/storefront/mobile-bar";
import { getCartView } from "@/server/cart";

export default async function StorefrontLayout({ children }: { children: React.ReactNode }) {
  const cart = await getCartView();

  return (
    <CartProvider initialCart={cart}>
      <div className="flex min-h-dvh flex-col">
        <Header />
        <main id="main" className="flex-1 pb-16 lg:pb-0">
          {children}
        </main>
        <Footer />
      </div>
      <CartDrawer />
      <MobileBar />
    </CartProvider>
  );
}
