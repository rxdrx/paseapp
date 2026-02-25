/**
 * @file screens/HomeScreen.tsx
 * Pantalla principal de PaseApp.
 *
 * Accesibilidad (A11y):
 *   - Todos los elementos tienen `accessibilityLabel` y `accessibilityRole`.
 *   - Los cambios de zona se anuncian mediante `accessibilityLiveRegion="polite"`.
 *   - La zona DANGER usa `accessibilityLiveRegion="assertive"` para TalkBack/VoiceOver.
 *   - Colores con contraste WCAG AA (fondo oscuro en zona crítica).
 *   - Fuente escalable (no usa tamaños fijos, respeta el TextSize del sistema).
 */

import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  AccessibilityInfo,
  useWindowDimensions,
  StatusBar,
  ScrollView,
} from 'react-native';

import { useGeofence } from '../hooks/useGeofence';
import { ProximityZone } from '../types';

// ---------------------------------------------------------------------------
// Constantes de UI
// ---------------------------------------------------------------------------

const ZONE_CONFIG = {
  [ProximityZone.NONE]: {
    label:           'Sin alertas activas',
    sublabel:        'Caminando con seguridad',
    backgroundColor: '#1a1a2e',
    textColor:       '#e0e0e0',
    accentColor:     '#4a9eff',
    a11yHint:        'Sin intersecciones cercanas',
    liveRegion:      'none' as const,
  },
  [ProximityZone.AWARENESS]: {
    label:           'Intersección a 40 metros',
    sublabel:        'Zona de Aviso',
    backgroundColor: '#1a2e1a',
    textColor:       '#e0ffe0',
    accentColor:     '#4eff88',
    a11yHint:        'Esquina próxima. Mantené atención.',
    liveRegion:      'polite' as const,
  },
  [ProximityZone.CAUTION]: {
    label:           'Intersección a 20 metros',
    sublabel:        'Zona de Alerta',
    backgroundColor: '#2e2a1a',
    textColor:       '#fff0cc',
    accentColor:     '#ffcc44',
    a11yHint:        'Cercanía inmediata a la esquina.',
    liveRegion:      'polite' as const,
  },
  [ProximityZone.DANGER]: {
    label:           '¡DETENER AVANCE!',
    sublabel:        'Zona Crítica – 10 metros',
    backgroundColor: '#2e1a1a',
    textColor:       '#ffe0e0',
    accentColor:     '#ff4444',
    a11yHint:        'Detené el avance inmediatamente. Intersección peligrosa.',
    liveRegion:      'assertive' as const,
  },
} as const;

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export default function HomeScreen(): React.JSX.Element {
  const { fontScale } = useWindowDimensions();

  const {
    activeEvent,
    nearestIntersection,
    nearestDistanceMeters,
    isActive,
    error,
    pause,
    resume,
  } = useGeofence();

  const zone       = activeEvent?.zone ?? ProximityZone.NONE;
  const zoneConfig = ZONE_CONFIG[zone];

  // Anuncio de accesibilidad al cambiar de zona
  const handleZoneChange = useCallback((z: ProximityZone) => {
    const config = ZONE_CONFIG[z];
    AccessibilityInfo.announceForAccessibility(
      `${config.label}. ${config.a11yHint}`,
    );
  }, []);

  React.useEffect(() => {
    handleZoneChange(zone);
  }, [zone, handleZoneChange]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <View
      style={[styles.container, { backgroundColor: zoneConfig.backgroundColor }]}
      accessibilityRole="main"
    >
      <StatusBar
        barStyle="light-content"
        backgroundColor={zoneConfig.backgroundColor}
      />

      <ScrollView contentContainerStyle={styles.content}>

        {/* ── Header ── */}
        <View style={styles.header}>
          <Text
            style={[styles.appTitle, { color: zoneConfig.accentColor }]}
            accessibilityRole="header"
          >
            PaseApp
          </Text>
          <Text style={[styles.appSubtitle, { color: zoneConfig.textColor }]}>
            Asistente de Movilidad – Bahía Blanca
          </Text>
        </View>

        {/* ── Indicador de zona principal ── */}
        <View
          style={[styles.zoneCard, { borderColor: zoneConfig.accentColor }]}
          accessible
          accessibilityRole="alert"
          accessibilityLabel={zoneConfig.label}
          accessibilityHint={zoneConfig.a11yHint}
          // @ts-expect-error – accessibilityLiveRegion es válido en RN, tipado incompleto
          accessibilityLiveRegion={zoneConfig.liveRegion}
        >
          <Text
            style={[
              styles.zoneLabel,
              { color: zoneConfig.accentColor, fontSize: 22 * fontScale },
            ]}
          >
            {zoneConfig.label}
          </Text>

          <Text
            style={[
              styles.zoneSublabel,
              { color: zoneConfig.textColor, fontSize: 14 * fontScale },
            ]}
          >
            {zoneConfig.sublabel}
          </Text>

          {nearestDistanceMeters !== null && (
            <Text
              style={[styles.distanceText, { color: zoneConfig.accentColor }]}
              accessibilityLabel={`Distancia: ${Math.round(nearestDistanceMeters)} metros`}
            >
              {Math.round(nearestDistanceMeters)} m
            </Text>
          )}
        </View>

        {/* ── Intersección más cercana ── */}
        {nearestIntersection !== null && (
          <View
            style={styles.intersectionCard}
            accessible
            accessibilityRole="text"
            accessibilityLabel={`Intersección cercana: ${nearestIntersection.streetA} y ${nearestIntersection.streetB}`}
          >
            <Text style={[styles.intersectionTitle, { color: zoneConfig.textColor }]}>
              Intersección más cercana
            </Text>
            <Text
              style={[styles.intersectionName, { color: zoneConfig.accentColor }]}
            >
              {nearestIntersection.streetA} y {nearestIntersection.streetB}
            </Text>
            {nearestIntersection.hasAccessibleLight && (
              <Text style={[styles.accessibleLight, { color: '#4eff88' }]}>
                Semáforo accesible disponible
              </Text>
            )}
          </View>
        )}

        {/* ── Error de permisos ── */}
        {error !== null && (
          <View
            style={styles.errorCard}
            accessible
            accessibilityRole="alert"
            accessibilityLabel={`Error: ${error}`}
            // @ts-expect-error – accessibilityLiveRegion
            accessibilityLiveRegion="assertive"
          >
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* ── Controles ── */}
        <View style={styles.controls}>
          <TouchableOpacity
            style={[
              styles.controlButton,
              { borderColor: zoneConfig.accentColor },
              !isActive && styles.controlButtonActive,
            ]}
            onPress={isActive ? pause : resume}
            accessibilityRole="button"
            accessibilityLabel={isActive ? 'Pausar alertas' : 'Reanudar alertas'}
            accessibilityHint={
              isActive
                ? 'Toca para pausar las alertas de vibración'
                : 'Toca para reanudar las alertas de vibración'
            }
          >
            <Text style={[styles.controlButtonText, { color: zoneConfig.accentColor }]}>
              {isActive ? 'Pausar alertas' : 'Reanudar alertas'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── Estado del sistema ── */}
        <View style={styles.statusRow} accessibilityRole="text">
          <View
            style={[
              styles.statusDot,
              { backgroundColor: isActive ? '#4eff88' : '#ff4444' },
            ]}
          />
          <Text style={[styles.statusText, { color: zoneConfig.textColor }]}>
            {isActive ? 'Sistema activo' : 'Sistema pausado'}
          </Text>
        </View>

      </ScrollView>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Estilos
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 24,
    paddingTop: 48,
    gap: 16,
  },
  header: {
    alignItems: 'center',
    marginBottom: 8,
  },
  appTitle: {
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  appSubtitle: {
    fontSize: 13,
    marginTop: 4,
    opacity: 0.8,
  },
  zoneCard: {
    borderWidth: 2,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    minHeight: 140,
    justifyContent: 'center',
    gap: 8,
  },
  zoneLabel: {
    fontWeight: '800',
    textAlign: 'center',
  },
  zoneSublabel: {
    textAlign: 'center',
    opacity: 0.85,
  },
  distanceText: {
    fontSize: 48,
    fontWeight: '900',
    marginTop: 8,
  },
  intersectionCard: {
    borderRadius: 12,
    padding: 16,
    backgroundColor: 'rgba(255,255,255,0.06)',
    gap: 4,
  },
  intersectionTitle: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1,
    opacity: 0.7,
  },
  intersectionName: {
    fontSize: 18,
    fontWeight: '600',
  },
  accessibleLight: {
    fontSize: 12,
    marginTop: 4,
  },
  errorCard: {
    backgroundColor: 'rgba(255,68,68,0.15)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ff4444',
    padding: 16,
  },
  errorText: {
    color: '#ff8888',
    fontSize: 14,
    textAlign: 'center',
  },
  controls: {
    marginTop: 8,
  },
  controlButton: {
    borderWidth: 1.5,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  controlButtonActive: {
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  controlButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 13,
    opacity: 0.7,
  },
});
