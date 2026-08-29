import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { listItemsByStatus } from "@/lib/db/repo";
import { SellWizard } from "@/components/SellWizard";
import { Header } from "@/components/ui";
import { he } from "@/data/he";

export default async function SellPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/profile?next=/sell");

  // Comparable sold prices (spec section 5.6 step 5).
  const comparablePrices = listItemsByStatus(["sold"])
    .map((i) => i.price_agorot)
    .sort((a, b) => a - b);

  return (
    <div>
      <Header title={he.sell.title} back="/" />
      <SellWizard comparablePrices={comparablePrices} />
    </div>
  );
}
