/**
 * @file __tests__/geofence.test.ts
 * Tests unitarios para la lógica de resolución de zonas de geofencing.
 *
 * Valida:
 *   - Resolución correcta de zonas por distancia
 *   - Límites de umbral (edge cases)
 *   - Zonas contiguas y de transición
 */

import { resolveProximityZone } from '../../hooks/useGeofence';
import { ProximityZone } from '../../types';
import {
  THRESHOLD_AWARENESS_M,
  THRESHOLD_CAUTION_M,
  THRESHOLD_DANGER_M,
} from '../../constants/geofence';

// ---------------------------------------------------------------------------
// resolveProximityZone
// ---------------------------------------------------------------------------

describe('resolveProximityZone', () => {

  // ── Zona NONE ──

  it('retorna NONE cuando la distancia supera el umbral de awareness', () => {
    expect(resolveProximityZone(THRESHOLD_AWARENESS_M + 1)).toBe(ProximityZone.NONE);
  });

  it('retorna NONE para distancias muy grandes', () => {
    expect(resolveProximityZone(500)).toBe(ProximityZone.NONE);
    expect(resolveProximityZone(1000)).toBe(ProximityZone.NONE);
  });

  // ── Zona AWARENESS ──

  it('retorna AWARENESS exactamente en el umbral de 40 m', () => {
    expect(resolveProximityZone(THRESHOLD_AWARENESS_M)).toBe(ProximityZone.AWARENESS);
  });

  it('retorna AWARENESS para distancias entre 21 m y 40 m', () => {
    expect(resolveProximityZone(39)).toBe(ProximityZone.AWARENESS);
    expect(resolveProximityZone(30)).toBe(ProximityZone.AWARENESS);
    expect(resolveProximityZone(21)).toBe(ProximityZone.AWARENESS);
  });

  // ── Zona CAUTION ──

  it('retorna CAUTION exactamente en el umbral de 20 m', () => {
    expect(resolveProximityZone(THRESHOLD_CAUTION_M)).toBe(ProximityZone.CAUTION);
  });

  it('retorna CAUTION para distancias entre 11 m y 20 m', () => {
    expect(resolveProximityZone(20)).toBe(ProximityZone.CAUTION);
    expect(resolveProximityZone(15)).toBe(ProximityZone.CAUTION);
    expect(resolveProximityZone(11)).toBe(ProximityZone.CAUTION);
  });

  // ── Zona DANGER ──

  it('retorna DANGER exactamente en el umbral de 10 m', () => {
    expect(resolveProximityZone(THRESHOLD_DANGER_M)).toBe(ProximityZone.DANGER);
  });

  it('retorna DANGER para distancias menores a 10 m', () => {
    expect(resolveProximityZone(9)).toBe(ProximityZone.DANGER);
    expect(resolveProximityZone(5)).toBe(ProximityZone.DANGER);
    expect(resolveProximityZone(1)).toBe(ProximityZone.DANGER);
    expect(resolveProximityZone(0)).toBe(ProximityZone.DANGER);
  });

  // ── Transiciones de umbral (boundary testing) ──

  it('transición correcta entre AWARENESS y CAUTION en 20 m', () => {
    expect(resolveProximityZone(20.01)).toBe(ProximityZone.AWARENESS);
    expect(resolveProximityZone(20)).toBe(ProximityZone.CAUTION);
    expect(resolveProximityZone(19.99)).toBe(ProximityZone.CAUTION);
  });

  it('transición correcta entre CAUTION y DANGER en 10 m', () => {
    expect(resolveProximityZone(10.01)).toBe(ProximityZone.CAUTION);
    expect(resolveProximityZone(10)).toBe(ProximityZone.DANGER);
    expect(resolveProximityZone(9.99)).toBe(ProximityZone.DANGER);
  });

  it('transición correcta entre NONE y AWARENESS en 40 m', () => {
    expect(resolveProximityZone(40.01)).toBe(ProximityZone.NONE);
    expect(resolveProximityZone(40)).toBe(ProximityZone.AWARENESS);
    expect(resolveProximityZone(39.99)).toBe(ProximityZone.AWARENESS);
  });

  // ── Valores especiales ──

  it('maneja correctamente distancia = 0 (usuario en la esquina)', () => {
    expect(resolveProximityZone(0)).toBe(ProximityZone.DANGER);
  });

  it('priorización correcta: DANGER > CAUTION > AWARENESS > NONE', () => {
    // Las zonas interiores deben siempre tener mayor prioridad
    const zones = [5, 15, 35, 55].map(resolveProximityZone);
    expect(zones).toEqual([
      ProximityZone.DANGER,
      ProximityZone.CAUTION,
      ProximityZone.AWARENESS,
      ProximityZone.NONE,
    ]);
  });
});

// ---------------------------------------------------------------------------
// Consistencia entre constantes y la función resolver
// ---------------------------------------------------------------------------

describe('Consistencia de umbrales', () => {
  it('THRESHOLD_DANGER_M < THRESHOLD_CAUTION_M < THRESHOLD_AWARENESS_M', () => {
    expect(THRESHOLD_DANGER_M).toBeLessThan(THRESHOLD_CAUTION_M);
    expect(THRESHOLD_CAUTION_M).toBeLessThan(THRESHOLD_AWARENESS_M);
  });

  it('los tres umbrales son positivos', () => {
    expect(THRESHOLD_DANGER_M).toBeGreaterThan(0);
    expect(THRESHOLD_CAUTION_M).toBeGreaterThan(0);
    expect(THRESHOLD_AWARENESS_M).toBeGreaterThan(0);
  });
});
