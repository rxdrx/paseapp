/**
 * @file __tests__/haversine.test.ts
 * Tests unitarios para la fórmula de Haversine y funciones derivadas.
 *
 * Casos de prueba diseñados con coordenadas reales de Bahía Blanca
 * para validar precisión en el contexto geográfico de la app.
 */

import {
  haversineDistance,
  isApproaching,
  findNearest,
} from '../../utils/haversine';
import type { Coordinates } from '../../types';

// ---------------------------------------------------------------------------
// Fixtures – coordenadas reales de Bahía Blanca
// ---------------------------------------------------------------------------

/** Plaza Rivadavia (centro geográfico de referencia). */
const PLAZA_RIVADAVIA: Coordinates = {
  latitude:  -38.71880,
  longitude: -62.27027,
};

/** Intersección Estomba & Alsina (~130 m de Plaza Rivadavia). */
const ESTOMBA_ALSINA: Coordinates = {
  latitude:  -38.71698,
  longitude: -62.26948,
};

/** Punto a 1 m de distancia (para test de distancia cero aproximada). */
const ALMOST_SAME: Coordinates = {
  latitude:  -38.71881,
  longitude: -62.27027,
};

// ---------------------------------------------------------------------------
// haversineDistance
// ---------------------------------------------------------------------------

describe('haversineDistance', () => {
  it('retorna 0 para coordenadas idénticas', () => {
    const dist = haversineDistance(PLAZA_RIVADAVIA, PLAZA_RIVADAVIA);
    expect(dist).toBe(0);
  });

  it('retorna ~1 metro para puntos casi idénticos', () => {
    const dist = haversineDistance(PLAZA_RIVADAVIA, ALMOST_SAME);
    expect(dist).toBeGreaterThan(0);
    expect(dist).toBeLessThan(2); // < 2 m de tolerancia
  });

  it('calcula ~204 metros entre Plaza Rivadavia y Estomba & Alsina', () => {
    const dist = haversineDistance(PLAZA_RIVADAVIA, ESTOMBA_ALSINA);
    // Tolerancia ±5 m por redondeo de coordenadas
    expect(dist).toBeGreaterThan(195);
    expect(dist).toBeLessThan(215);
  });

  it('es simétrica: dist(A→B) === dist(B→A)', () => {
    const ab = haversineDistance(PLAZA_RIVADAVIA, ESTOMBA_ALSINA);
    const ba = haversineDistance(ESTOMBA_ALSINA, PLAZA_RIVADAVIA);
    expect(Math.abs(ab - ba)).toBeLessThan(0.001); // tolerancia floating-point
  });

  it('maneja coordenadas en el ecuador (latitud 0)', () => {
    const a: Coordinates = { latitude: 0, longitude: 0 };
    const b: Coordinates = { latitude: 0, longitude: 0.001 };
    const dist = haversineDistance(a, b);
    // 0.001° de longitud en el ecuador ≈ 111.3 m
    expect(dist).toBeGreaterThan(100);
    expect(dist).toBeLessThan(120);
  });
});

// ---------------------------------------------------------------------------
// isApproaching
// ---------------------------------------------------------------------------

describe('isApproaching', () => {
  it('retorna true cuando la distancia decrece significativamente', () => {
    expect(isApproaching(50, 35)).toBe(true);
  });

  it('retorna false cuando la distancia aumenta', () => {
    expect(isApproaching(35, 50)).toBe(false);
  });

  it('retorna false cuando la distancia no cambia', () => {
    expect(isApproaching(35, 35)).toBe(false);
  });

  it('respeta la histeresis: cambio < hysteresisM se ignora', () => {
    // Cambio de 1 m con histeresis de 2 m → no se considera acercamiento
    expect(isApproaching(35, 34, 2)).toBe(false);
  });

  it('detecta acercamiento cuando el cambio supera la histeresis', () => {
    // Cambio de 5 m con histeresis de 2 m → sí es acercamiento
    expect(isApproaching(35, 30, 2)).toBe(true);
  });

  it('retorna false cuando distancia es igual con histeresis 0', () => {
    expect(isApproaching(20, 20, 0)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// findNearest
// ---------------------------------------------------------------------------

describe('findNearest', () => {
  const intersections = [
    { id: '1', coordinates: { latitude: -38.71698, longitude: -62.26948 } },
    { id: '2', coordinates: { latitude: -38.71744, longitude: -62.26948 } },
    { id: '3', coordinates: { latitude: -38.71800, longitude: -62.27100 } },
  ];

  it('retorna null para un array vacío', () => {
    const result = findNearest(PLAZA_RIVADAVIA, []);
    expect(result).toBeNull();
  });

  it('retorna el único elemento si solo hay uno', () => {
    const result = findNearest(PLAZA_RIVADAVIA, [intersections[0]!]);
    expect(result).not.toBeNull();
    expect(result!.item.id).toBe('1');
  });

  it('encuentra el más cercano entre múltiples candidatos', () => {
    // El punto '3' es el más cercano a Plaza Rivadavia
    const result = findNearest(PLAZA_RIVADAVIA, intersections);
    expect(result).not.toBeNull();
    expect(result!.item.id).toBe('3');
  });

  it('la distancia retornada coincide con haversineDistance', () => {
    const result = findNearest(PLAZA_RIVADAVIA, intersections);
    const expected = haversineDistance(
      PLAZA_RIVADAVIA,
      result!.item.coordinates,
    );
    expect(result!.distanceMeters).toBeCloseTo(expected, 5);
  });
});
