import os
import json
import httpx
from mcp.server.fastmcp import FastMCP
from urllib.parse import urlencode

mcp = FastMCP("foursquare-places")

FSQ_API_BASE = "https://places-api.foursquare.com"
FSQ_TOKEN = os.getenv("FOURSQUARE_SERVICE_TOKEN", "")

# Pro fields — free tier (10K calls/month + $200 credits)
PRO_FIELDS = ",".join([
    "fsq_place_id", "name", "location", "categories", "distance",
    "geocodes", "link", "closed_bucket", "website", "tel", "email",
])

# Pro detail fields — still free tier, just more fields on a single venue
PRO_DETAIL_FIELDS = ",".join([
    "fsq_place_id", "name", "location", "categories", "geocodes",
    "description", "tel", "email", "website", "social_media",
    "hours", "price", "attributes",
])

# Premium fields — cost credits ($18.75/1K calls)
# Only used when explicitly requested: rating, photos, tips, tastes, popularity, hours_popular
PREMIUM_DETAIL_FIELDS = ",".join([
    "fsq_place_id", "name", "location", "categories", "geocodes",
    "description", "tel", "email", "website", "social_media",
    "hours", "hours_popular", "rating", "price", "menu",
    "photos", "tips", "tastes", "popularity", "attributes",
])


async def _fsq_request(endpoint: str, params: dict) -> dict | list | None:
    headers = {
        "Authorization": f"Bearer {FSQ_TOKEN}",
        "Accept": "application/json",
        "X-Places-Api-Version": "2025-02-05",
    }
    url = f"{FSQ_API_BASE}{endpoint}"
    if params:
        url += f"?{urlencode(params)}"
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.get(url, headers=headers, timeout=15.0)
            resp.raise_for_status()
            return resp.json()
        except httpx.HTTPStatusError as e:
            return {"error": f"Foursquare API {e.response.status_code}", "detail": e.response.text[:200]}
        except Exception as e:
            return {"error": str(e)}


@mcp.tool()
async def search_venues(query: str, near: str, limit: int = 10) -> str:
    """Search for venues near a named location. Uses free tier.

    Args:
        query: What to search for (e.g. "coffee shop", "rooftop bar", "tacos")
        near: A geographic area (e.g. "Austin TX", "East 6th Street Austin", "Downtown")
        limit: Number of results (1-50, default 10)
    """
    data = await _fsq_request("/places/search", {
        "query": query,
        "near": near,
        "limit": min(limit, 50),
        "fields": PRO_FIELDS,
        "sort": "RELEVANCE",
    })
    return json.dumps(data, indent=2)


@mcp.tool()
async def search_venues_nearby(query: str, latitude: float, longitude: float, radius: int = 2000, limit: int = 10) -> str:
    """Search for venues near a specific lat/lng point. Uses free tier.

    Args:
        query: What to search for (e.g. "coffee", "bar", "restaurant")
        latitude: Latitude coordinate
        longitude: Longitude coordinate
        radius: Search radius in meters (default 2000, max 100000)
        limit: Number of results (1-50, default 10)
    """
    data = await _fsq_request("/places/search", {
        "query": query,
        "ll": f"{latitude},{longitude}",
        "radius": min(radius, 100000),
        "limit": min(limit, 50),
        "fields": PRO_FIELDS,
        "sort": "DISTANCE",
    })
    return json.dumps(data, indent=2)


@mcp.tool()
async def venue_details(fsq_id: str) -> str:
    """Get detailed info about a venue — description, hours, price tier,
    social media, website, phone, and features (WiFi, reservations, etc).
    Uses free Pro tier fields only.

    Args:
        fsq_id: The Foursquare place ID (e.g. "50981188e4b0f94e062c8664")
    """
    data = await _fsq_request(f"/places/{fsq_id}", {
        "fields": PRO_DETAIL_FIELDS,
    })
    return json.dumps(data, indent=2)


@mcp.tool()
async def venue_details_premium(fsq_id: str) -> str:
    """Get rich details including rating, photos, tips/reviews, popular hours,
    tastes, and menu. COSTS CREDITS — only use when the user specifically
    asks for reviews, ratings, photos, or popularity data.

    Args:
        fsq_id: The Foursquare place ID
    """
    data = await _fsq_request(f"/places/{fsq_id}", {
        "fields": PREMIUM_DETAIL_FIELDS,
    })
    return json.dumps(data, indent=2)


@mcp.tool()
async def venues_open_now(category: str, near: str, limit: int = 10) -> str:
    """Find venues that are currently open in an area. Uses free tier.

    Args:
        category: Type of venue (e.g. "bar", "coffee", "restaurant", "nightclub")
        near: Location name (e.g. "Austin TX", "South Congress")
        limit: Number of results (1-50, default 10)
    """
    data = await _fsq_request("/places/search", {
        "query": category,
        "near": near,
        "limit": min(limit, 50),
        "fields": PRO_FIELDS,
        "open_now": "true",
        "sort": "POPULARITY",
    })
    return json.dumps(data, indent=2)


if __name__ == "__main__":
    mcp.run(transport="sse", host="0.0.0.0", port=8080)
