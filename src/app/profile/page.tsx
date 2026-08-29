import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { SignInPanel } from "@/components/SignInPanel";
import { Header } from "@/components/ui";
import { he } from "@/data/he";

export default async function ProfileRedirect({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const user = await getCurrentUser();
  if (user) redirect(`/u/${user.id}`);
  const { next } = await searchParams;
  return (
    <div>
      <Header title={he.nav.profile} back="/" />
      <SignInPanel next={next} />
    </div>
  );
}
