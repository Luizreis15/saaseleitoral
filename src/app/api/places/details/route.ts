import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const placeId = request.nextUrl.searchParams.get("place_id");
  const key = process.env.NEXT_PUBLIC_MAPS_API_KEY;

  if (!key || !placeId) {
    return NextResponse.json({ error: "Parâmetros inválidos" }, { status: 400 });
  }

  const url = new URL("https://maps.googleapis.com/maps/api/place/details/json");
  url.searchParams.set("place_id", placeId);
  url.searchParams.set("key", key);
  url.searchParams.set("language", "pt-BR");
  url.searchParams.set("fields", "name,formatted_address,geometry,address_component");

  const res = await fetch(url.toString());
  const data = await res.json();
  const result = data.result;

  if (!result) {
    return NextResponse.json({ error: "Local não encontrado" }, { status: 404 });
  }

  const components: Array<{ long_name: string; types: string[] }> = result.address_components ?? [];
  const find = (type: string) => components.find((c) => c.types.includes(type))?.long_name ?? "";

  return NextResponse.json({
    name: result.name,
    address: result.formatted_address,
    neighborhood: find("sublocality") || find("sublocality_level_1") || find("neighborhood"),
    postal_code: find("postal_code"),
    latitude: result.geometry?.location?.lat ?? null,
    longitude: result.geometry?.location?.lng ?? null,
  });
}
