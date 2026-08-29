import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getItem, listItemsByStatus, listPhotos } from "@/lib/db/repo";
import { SellWizard } from "@/components/SellWizard";
import { Header } from "@/components/ui";
import { he } from "@/data/he";

export default async function EditListingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/profile?next=/item/${id}/edit`);

  const item = getItem(id);
  if (!item) notFound();
  if (item.owner_id !== user.id) redirect(`/item/${id}`);

  const comparablePrices = listItemsByStatus(["sold"])
    .map((i) => i.price_agorot)
    .sort((a, b) => a - b);

  return (
    <div>
      <Header title={he.sell.editTitle} back={`/item/${id}`} />
      {item.status === "reserved" || item.status === "sold" ? (
        <p className="px-6 py-16 text-center text-sm text-stone-400">
          {he.sell.lockedInDeal}
        </p>
      ) : (
        <SellWizard
          comparablePrices={comparablePrices}
          edit={{ itemId: id, item, photos: listPhotos(id) }}
        />
      )}
    </div>
  );
}
