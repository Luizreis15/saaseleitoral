import { PresencePublicClient } from "@/components/presence/presence-public-client";
import { hashSecret, isLinkUsable } from "@/lib/presence";
import { createServiceClient } from "@/lib/supabase/admin";

export default async function PresencePublicPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  let locationName = "Escola / local";
  let memberHint = "Integrante";
  let expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  let usable = true;

  try {
    const admin = createServiceClient();
    const { data: link } = await admin
      .from("op_presence_links")
      .select(
        "status, expires_at, revoked_at, starts_at, op_locations(name), op_members(full_name)"
      )
      .eq("token_hash", hashSecret(token))
      .maybeSingle();

    if (!link) {
      usable = false;
    } else {
      usable = isLinkUsable({
        status: link.status,
        expiresAt: link.expires_at,
        revokedAt: link.revoked_at,
        startsAt: link.starts_at,
      });
      expiresAt = link.expires_at;
      const location = Array.isArray(link.op_locations) ? link.op_locations[0] : link.op_locations;
      const member = Array.isArray(link.op_members) ? link.op_members[0] : link.op_members;
      locationName = location?.name ?? locationName;
      const first = member?.full_name?.trim().split(/\s+/)[0];
      memberHint = first ? `${first}` : memberHint;
    }
  } catch {
    // Sem service role no ambiente: ainda permite tentativa via APIs.
  }

  return (
    <div className="relative flex min-h-dvh items-center justify-center px-4 py-8">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-20 top-8 h-64 w-64 rounded-full bg-sky-400/15 blur-3xl" />
        <div className="absolute -right-16 bottom-8 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
      </div>
      <div className="relative w-full max-w-md animate-fade-up">
        <PresencePublicClient
          token={token}
          locationName={locationName}
          memberHint={memberHint}
          expiresAt={expiresAt}
          usable={usable}
        />
      </div>
    </div>
  );
}
