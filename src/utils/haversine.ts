/**
 * @file utils/haversine.ts
 * Cálculo de distancia geodésica usando la fórmula de Haversine.
 *
 * Se ejecuta enteramente en el cliente (offline-first) para evitar
 * latencia de red durante la navegación urbana.
 *
 * @see https://en.wikipedia.org/wiki/Haversine_formula
 */

import type { Coordinates } from '../types';

/** Radio medio de la Tierra en metros (WGS84). */
const EARTH_RADIUS_M = 6_371_000 as const;

/**
 * Convierte grados a radianes.
 * @pure
 */
const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;

/**
 * Calcula la distancia en metros entre dos coordenadas geográficas
 * usando la fórmula de Haversine (Great-circle distance).
 *
 * Precisión: ~0.5% de error para distancias cortas (<1 km), suficiente
 * para geofencing urbano a nivel de esquinas.
 *
 * @param from - Punto de origen (posición actual del usuario).
 * @param to   - Punto de destino (coordenada de la intersección).
 * @returns Distancia en metros.
 *
 * @example
 * const dist = haversineDistance(
 *   { latitude: -38.7183, longitude: -62.2663 },
 *   { latitude: -38.7185, longitude: -62.2670 },
 * );
 * // → ~60.4 metros
 */
export function haversineDistance(from: Coordinates, to: Coordinates): number {
  const dLat = toRadians(to.latitude  - from.latitude);
  const dLon = toRadians(to.longitude - from.longitude);

  const fromLatRad = toRadians(from.latitude);
  const toLatRad   = toRadians(to.latitude);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(fromLatRad) * Math.cos(toLatRad) * Math.sin(dLon / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_M * c;
}

/**
 * Determina si la distancia entre el usuario y un objetivo está
 * disminuyendo entre dos lecturas consecutivas.
 *
 * Implementa el "Filtro de Dirección" requerido: la vibración sólo
 * se activa cuando el usuario SE ACERCA (distancia decrece).
 *
 * @param previousDistance - Distancia medida en la lectura anterior (m).
 * @param currentDistance  - Distancia medida en la lectura actual (m).
 * @param hysteresisM      - Tolerancia mínima de cambio para considerar
 *                           movimiento real (evita jitter). @default 0
 * @returns `true` si el usuario se está acercando.
 */
export function isApproaching(
  previousDistance: number,
  currentDistance: number,
  hysteresisM = 0,
): boolean {
  return currentDistance < previousDistance - hysteresisM;
}

/**
 * Ordena un array de intersecciones por distancia al punto dado
 * y retorna la más cercana junto con su distancia.
 *
 * @returns `null` si el array de intersecciones está vacío.
 */
export function findNearest<T extends { coordinates: Coordinates }>(
  from: Coordinates,
  candidates: readonly T[],
): { item: T; distanceMeters: number } | null {
  if (candidates.length === 0) return null;

  let nearest = candidates[0]!;
  let minDist = haversineDistance(from, nearest.coordinates);

  for (let i = 1; i < candidates.length; i++) {
    const candidate = candidates[i]!;
    const dist = haversineDistance(from, candidate.coordinates);
    if (dist < minDist) {
      minDist = dist;
      nearest = candidate;
    }
  }

  return { item: nearest, distanceMeters: minDist };
}
