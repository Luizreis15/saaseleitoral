import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isAuthRoute = path.startsWith("/login");
  const isPresencePublic =
    path.startsWith("/p/") || path.startsWith("/api/presence/");
  const isPublic = isAuthRoute || path === "/" || isPresencePublic;

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  if (user && isAuthRoute) {
    const { data: profile } = await supabase
      .from("op_profiles")
      .select("role")
      .eq("auth_user_id", user.id)
      .eq("active", true)
      .maybeSingle();

    const url = request.nextUrl.clone();
    url.pathname = profile?.role === "coordinator" ? "/minha-equipe" : "/dashboard";
    return NextResponse.redirect(url);
  }

  if (user) {
    const masterOnlyPrefixes = [
      "/dashboard",
      "/coordenadores",
      "/equipes",
      "/auditoria",
      "/pendencias",
      "/busca",
      "/mapa",
    ];
    const isMasterOnly = masterOnlyPrefixes.some((p) => path === p || path.startsWith(`${p}/`));
    const isMasterMemberList =
      path === "/integrantes" ||
      path === "/integrantes/novo" ||
      (path.startsWith("/integrantes/") && path.endsWith("/editar"));
    const isMasterLocationList = path === "/locais" || path === "/locais/novo";

    if (isMasterOnly || isMasterMemberList || isMasterLocationList) {
      const { data: profile } = await supabase
        .from("op_profiles")
        .select("role")
        .eq("auth_user_id", user.id)
        .eq("active", true)
        .maybeSingle();

      if (profile?.role === "coordinator") {
        const url = request.nextUrl.clone();
        url.pathname = "/minha-equipe";
        return NextResponse.redirect(url);
      }
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
