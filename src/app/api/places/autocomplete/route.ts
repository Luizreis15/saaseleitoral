import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim();
  const key = process.env.NEXT_PUBLIC_MAPS_API_KEY;

  if (!key) {
    return NextResponse.json({ predictions: [], error: "Maps API não configurada" }, { status: 200 });
  }
  if (!q || q.length < 3) {
    return NextResponse.json({ predictions: [] });
  }

  const url = new URL("https://maps.googleapis.com/maps/api/place/autocomplete/json");
  url.searchParams.set("input", q);
  url.searchParams.set("key", key);
  url.searchParams.set("language", "pt-BR");
  url.searchParams.set("components", "country:br");
  url.searchParams.set("types", "establishment");

  const res = await fetch(url.toString());
  const data = await res.json();

  return NextResponse.json({
    predictions: (data.predictions ?? []).map((p: {
      place_id: string;
      description: string;
      structured_formatting?: { main_text: string; secondary_text: string };
    }) => ({
      place_id: p.place_id,
      description: p.description,
      structured_formatting: p.structured_formatting,
    })),
  });
}
