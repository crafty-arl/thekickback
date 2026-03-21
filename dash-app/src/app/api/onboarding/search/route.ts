import { NextRequest, NextResponse } from "next/server";

const USER_AGENT = "theKickBack/1.0 (hub@thekickback.net)";

interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
  address?: {
    road?: string;
    house_number?: string;
    suburb?: string;
    neighbourhood?: string;
    city?: string;
    town?: string;
    state?: string;
    postcode?: string;
    country?: string;
  };
  type?: string;
  class?: string;
}

interface OverpassElement {
  tags?: Record<string, string>;
}

export async function POST(request: NextRequest) {
  const body = await request.json() as { name: string; city: string };
  if (!body.name || !body.city) {
    return NextResponse.json({ found: false, error: "name and city required" }, { status: 400 });
  }

  const query = `${body.name} ${body.city}`;

  // Step 1: Nominatim search
  let nominatimResults: NominatimResult[] = [];
  try {
    const geoRes = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&limit=3`,
      { headers: { "User-Agent": USER_AGENT } }
    );
    if (geoRes.ok) {
      nominatimResults = await geoRes.json();
    }
  } catch (err) {
    console.error("Nominatim error:", err);
  }

  if (nominatimResults.length === 0) {
    return NextResponse.json({ found: false });
  }

  const best = nominatimResults[0];
  const lat = parseFloat(best.lat);
  const lng = parseFloat(best.lon);

  // Build address from parts
  const addr = best.address;
  const addressParts = [];
  if (addr?.house_number) addressParts.push(addr.house_number);
  if (addr?.road) addressParts.push(addr.road);
  const streetLine = addressParts.join(" ");
  const city = addr?.city || addr?.town || "";
  const state = addr?.state || "";
  const zip = addr?.postcode || "";
  const fullAddress = [streetLine, city, state, zip].filter(Boolean).join(", ");
  const neighborhood = addr?.suburb || addr?.neighbourhood || "";

  // Step 2: Overpass API for richer data (hours, amenity type, cuisine, etc.)
  let hours = "";
  let amenityType = "";
  let phone = "";
  let website = "";
  let cuisine = "";

  try {
    const escapedName = body.name.replace(/"/g, '\\"');
    const overpassQuery = `[out:json][timeout:5];(node["name"~"${escapedName}",i]["amenity"](around:500,${lat},${lng});way["name"~"${escapedName}",i]["amenity"](around:500,${lat},${lng}););out body 1;`;

    const overpassRes = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": USER_AGENT },
      body: `data=${encodeURIComponent(overpassQuery)}`,
    });

    if (overpassRes.ok) {
      const overpassData = await overpassRes.json() as { elements?: OverpassElement[] };
      const el = overpassData.elements?.[0];
      if (el?.tags) {
        hours = el.tags.opening_hours || "";
        amenityType = el.tags.amenity || el.tags.shop || "";
        phone = el.tags.phone || el.tags["contact:phone"] || "";
        website = el.tags.website || el.tags["contact:website"] || "";
        cuisine = el.tags.cuisine || "";
      }
    }
  } catch (err) {
    console.error("Overpass error:", err);
    // Best effort — Nominatim data is still useful
  }

  return NextResponse.json({
    found: true,
    address: fullAddress || best.display_name,
    lat,
    lng,
    neighborhood,
    hours,
    type: amenityType || best.type || "",
    phone,
    website,
    cuisine,
  });
}
