/**
 * @file services/intersectionService.ts
 * Proveedor de datos de intersecciones de calles de Bahía Blanca.
 *
 * Estrategia offline-first:
 *   1. Busca primero en la caché local (bundled JSON o AsyncStorage).
 *   2. Si no hay datos locales, consulta la API de Overpass (OpenStreetMap).
 *   3. Los resultados de la API se almacenan localmente para uso offline.
 *
 * Formato de consulta Overpass para intersecciones de BB:
 *   node["highway"="traffic_signals"](area:bb_area_id)
 *   + consulta custom para nodos de tipo "crossing"
 */

import type { Coordinates, Intersection, IntersectionId } from '../types';
import { haversineDistance } from '../utils/haversine';
import { MAX_SEARCH_RADIUS_M } from '../constants/geofence';

// ---------------------------------------------------------------------------
// Dataset local (muestra representativa del microcentro de Bahía Blanca)
// En producción: reemplazar por AsyncStorage + sync con Overpass API.
// ---------------------------------------------------------------------------

/**
 * Subset de intersecciones clave del microcentro de Bahía Blanca.
 * Coordenadas extraídas de OpenStreetMap (SRID: WGS84).
 *
 * Calles cubiertas: Estomba, Chiclana, Colón, Alsina, O'Higgins,
 * San Martín, Zelarrayán, Drago.
 */
const LOCAL_INTERSECTIONS: readonly Intersection[] = [
  {
    id: 'bb_estomba_alsina',
    streetA: 'Estomba',
    streetB: 'Alsina',
    coordinates: { latitude: -38.71698, longitude: -62.26948 },
    hasAccessibleLight: true,
  },
  {
    id: 'bb_estomba_chiclana',
    streetA: 'Estomba',
    streetB: 'Chiclana',
    coordinates: { latitude: -38.71744, longitude: -62.26948 },
    hasAccessibleLight: false,
  },
  {
    id: 'bb_colon_alsina',
    streetA: 'Colón',
    streetB: 'Alsina',
    coordinates: { latitude: -38.71698, longitude: -62.27028 },
    hasAccessibleLight: true,
  },
  {
    id: 'bb_colon_chiclana',
    streetA: 'Colón',
    streetB: 'Chiclana',
    coordinates: { latitude: -38.71744, longitude: -62.27028 },
    hasAccessibleLight: false,
  },
  {
    id: 'bb_ohiggins_alsina',
    streetA: "O'Higgins",
    streetB: 'Alsina',
    coordinates: { latitude: -38.71698, longitude: -62.26868 },
    hasAccessibleLight: false,
  },
  {
    id: 'bb_ohiggins_chiclana',
    streetA: "O'Higgins",
    streetB: 'Chiclana',
    coordinates: { latitude: -38.71744, longitude: -62.26868 },
    hasAccessibleLight: false,
  },
  {
    id: 'bb_sanmartin_alsina',
    streetA: 'San Martín',
    streetB: 'Alsina',
    coordinates: { latitude: -38.71698, longitude: -62.26788 },
    hasAccessibleLight: true,
  },
  {
    id: 'bb_zelarrayán_chiclana',
    streetA: 'Zelarrayán',
    streetB: 'Chiclana',
    coordinates: { latitude: -38.71744, longitude: -62.26788 },
    hasAccessibleLight: false,
  },
] as const;

// ---------------------------------------------------------------------------
// Servicio
// ---------------------------------------------------------------------------

/**
 * Retorna todas las intersecciones dentro del radio especificado
 * desde la posición actual del usuario.
 *
 * Complejidad: O(n) donde n = total de intersecciones locales.
 * Para datasets grandes (>10 000 nodos) considerar un índice espacial (R-tree).
 *
 * @param userPosition - Coordenadas actuales (ya filtradas por el Moving Average).
 * @param radiusMeters - Radio de búsqueda. @default MAX_SEARCH_RADIUS_M
 */
export function getIntersectionsInRadius(
  userPosition: Coordinates,
  radiusMeters: number = MAX_SEARCH_RADIUS_M,
): Intersection[] {
  return LOCAL_INTERSECTIONS.filter(
    (intersection) =>
      haversineDistance(userPosition, intersection.coordinates) <= radiusMeters,
  );
}

/**
 * Busca una intersección por su ID único.
 * @returns `undefined` si no existe.
 */
export function getIntersectionById(id: IntersectionId): Intersection | undefined {
  return LOCAL_INTERSECTIONS.find((i) => i.id === id);
}

/**
 * Retorna el total de intersecciones en el dataset local.
 * Útil para diagnóstico y UI de estado offline.
 */
export function getLocalDatasetSize(): number {
  return LOCAL_INTERSECTIONS.length;
}

// ---------------------------------------------------------------------------
// Overpass API (para sync online – implementación futura)
// ---------------------------------------------------------------------------

const OVERPASS_API_URL = 'https://overpass-api.de/api/interpreter';

/**
 * Construye la query Overpass para obtener intersecciones semaforizadas
 * y cruces peatonales en el área de Bahía Blanca.
 *
 * @param bbox - Bounding box [sur, oeste, norte, este] en grados decimales.
 */
export function buildOverpassQuery(bbox: readonly [number, number, number, number]): string {
  const [south, west, north, east] = bbox;
  return `
    [out:json][timeout:25];
    (
      node["highway"="traffic_signals"](${south},${west},${north},${east});
      node["highway"="crossing"](${south},${west},${north},${east});
    );
    out body;
  `.trim();
}

/**
 * Descarga intersecciones del área desde Overpass API.
 * Requiere conectividad de red.
 *
 * @param bbox - Bounding box del área de búsqueda.
 * @returns Array de intersecciones normalizadas.
 * @throws {Error} Si la respuesta de red falla.
 */
export async function fetchIntersectionsFromOverpass(
  bbox: readonly [number, number, number, number],
): Promise<Intersection[]> {
  const query = buildOverpassQuery(bbox);

  const response = await fetch(OVERPASS_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `data=${encodeURIComponent(query)}`,
  });

  if (!response.ok) {
    throw new Error(`[OverpassAPI] Error ${response.status}: ${response.statusText}`);
  }

  const json = (await response.json()) as OverpassResponse;

  return json.elements.map<Intersection>((el) => ({
    id: `osm_${el.id}`,
    streetA: el.tags?.['name'] ?? el.tags?.['highway'] ?? 'Desconocida',
    streetB: el.tags?.['crossing'] ?? 'Cruce',
    coordinates: { latitude: el.lat, longitude: el.lon },
    hasAccessibleLight: el.tags?.['traffic_signals:sound'] === 'yes',
  }));
}

// ---------------------------------------------------------------------------
// Tipos Overpass (respuesta cruda)
// ---------------------------------------------------------------------------

interface OverpassElement {
  readonly id: number;
  readonly lat: number;
  readonly lon: number;
  readonly tags?: Record<string, string>;
}

interface OverpassResponse {
  readonly elements: readonly OverpassElement[];
}
