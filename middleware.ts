import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

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
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const { data: { user } } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;
  const isAuthRoute =
    path === "/login" ||
    path === "/register" ||
    path === "/pending" ||
    path.startsWith("/login/") ||
    path.startsWith("/register/") ||
    path.startsWith("/pending/");
  // Veřejně přístupné cesty bez přihlášení (kromě auth tras a Next.js internals).
  const isGuestAllowed =
    path === "/" ||
    path === "/schedule" ||
    path.startsWith("/schedule/") ||
    path === "/trophies" ||
    path.startsWith("/trophies/") ||
    path.startsWith("/_next") ||
    path.startsWith("/favicon");

  if (!user && !isAuthRoute && !isGuestAllowed) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && !isAuthRoute && path !== "/pending") {
    // Schválení vyžadujeme pouze pro chráněné stránky (admin, hraci atd.).
    // Public stránky (schedule, trophies) přihlášený neschválený smí vidět.
    const isPublicForApproved =
      path === "/" ||
      path === "/schedule" ||
      path.startsWith("/schedule/") ||
      path === "/trophies" ||
      path.startsWith("/trophies/");
    if (!isPublicForApproved) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("is_approved")
        .eq("id", user.id)
        .single();
      if (profile && !profile.is_approved) {
        const url = request.nextUrl.clone();
        url.pathname = "/pending";
        return NextResponse.redirect(url);
      }
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|ico|webp|gif|woff|woff2)).*)"],
};
