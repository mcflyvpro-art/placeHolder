import 'server-only';
import { env } from '@/lib/env';

export type Place = {
  id: string;
  name: string;
  address: string | null;
  postalCode: string | null;
  city: string | null;
  lat: number;
  lng: number;
  phone: string | null;
  website: string | null;
  rating: number | null;
  reviews: number | null;
  businessStatus: string | null;
  types: string[];
  mapsUrl: string | null;
  hours: string[] | null;
};

const FIELDS = [
  'places.id', 'places.displayName', 'places.formattedAddress', 'places.addressComponents', 'places.location',
  'places.nationalPhoneNumber', 'places.websiteUri', 'places.rating', 'places.userRatingCount',
  'places.businessStatus', 'places.types', 'places.googleMapsUri', 'places.regularOpeningHours.weekdayDescriptions',
  'nextPageToken',
].join(',');

type RawPlace = {
  id: string;
  displayName?: { text: string };
  formattedAddress?: string;
  addressComponents?: { longText?: string; types?: string[] }[];
  location?: { latitude: number; longitude: number };
  nationalPhoneNumber?: string;
  websiteUri?: string;
  rating?: number;
  userRatingCount?: number;
  businessStatus?: string;
  types?: string[];
  googleMapsUri?: string;
  regularOpeningHours?: { weekdayDescriptions?: string[] };
};

export function mapPlace(p: RawPlace): Place {
  const comp = (t: string) => p.addressComponents?.find((c) => c.types?.includes(t))?.longText ?? null;
  return {
    id: p.id,
    name: p.displayName?.text ?? '',
    address: p.formattedAddress ?? null,
    postalCode: comp('postal_code'),
    city: comp('locality'),
    lat: p.location?.latitude ?? 0,
    lng: p.location?.longitude ?? 0,
    phone: p.nationalPhoneNumber ?? null,
    website: p.websiteUri ?? null,
    rating: p.rating ?? null,
    reviews: p.userRatingCount ?? null,
    businessStatus: p.businessStatus ?? null,
    types: p.types ?? [],
    mapsUrl: p.googleMapsUri ?? null,
    hours: p.regularOpeningHours?.weekdayDescriptions ?? null,
  };
}

export async function textSearch(query: string, pageToken?: string | null): Promise<{ places: Place[]; next: string | null }> {
  const key = env.googleKey;
  if (!key) throw new Error('GOOGLE_PLACES_KEY absente');
  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': FIELDS },
    body: JSON.stringify({ textQuery: query, languageCode: 'fr', regionCode: 'FR', pageSize: 20, ...(pageToken ? { pageToken } : {}) }),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Google ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = (await res.json()) as { places?: RawPlace[]; nextPageToken?: string };
  return { places: (json.places ?? []).map(mapPlace), next: json.nextPageToken ?? null };
}

/** Rafraîchissement d'une fiche (Place Details Enterprise : 1 000 gratuits/mois, quota séparé). */
export async function placeDetails(placeId: string): Promise<Place | null> {
  const key = env.googleKey;
  if (!key) return null;
  const mask = FIELDS.split(',').filter((f) => f.startsWith('places.')).map((f) => f.replace('places.', '')).join(',');
  const res = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?languageCode=fr`, {
    headers: { 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': mask },
    cache: 'no-store',
  });
  if (!res.ok) return null;
  return mapPlace((await res.json()) as RawPlace);
}
