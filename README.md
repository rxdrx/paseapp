# PaseApp — Asistente de Movilidad Urbana

Aplicación móvil de accesibilidad para personas con discapacidad visual en **Bahía Blanca, Argentina**.  
Emite alertas hápticas (vibración) basadas en la proximidad a intersecciones de calles.

---

## Tecnologías

| Capa | Tecnología |
|---|---|
| UI | React Native 0.76 + TypeScript estricto |
| GPS | `expo-location` (`BestForNavigation`) |
| Haptics | `expo-haptics` (iOS) / `Vibration` API (Android) |
| Datos de mapa | OpenStreetMap / Overpass API + datos locales (offline-first) |
| Tests | Jest + ts-jest |

---

## Arquitectura

```
src/
├── types/
│   └── index.ts               # Tipos de dominio (Coordinates, ProximityZone, …)
├── constants/
│   └── geofence.ts            # Umbrales, patrones de vibración, config GPS
├── utils/
│   ├── haversine.ts           # Cálculo de distancia offline (Haversine)
│   └── gpsFilter.ts           # Filtro de media móvil anti-jitter
├── services/
│   ├── intersectionService.ts # Datos de esquinas (local + Overpass API)
│   └── vibrationService.ts    # Abstracción vibracion iOS/Android
├── hooks/
│   ├── useLocation.ts         # Permisos + watchPositionAsync
│   └── useGeofence.ts         # Lógica central de geofencing
├── screens/
│   └── HomeScreen.tsx         # UI accesible (WCAG AA)
└── __tests__/
    ├── haversine.test.ts
    ├── gpsFilter.test.ts
    └── geofence.test.ts
```

---

## Zonas de Proximidad

| Zona | Distancia | Patrón de Vibración | Descripción |
|---|---|---|---|
| `AWARENESS` | ≤ 40 m | `[0, 500]` | Un pulso largo. Aproximación a la esquina. |
| `CAUTION`   | ≤ 20 m | `[0, 200, 100, 200]` | Dos pulsos cortos. Cercanía inmediata. |
| `DANGER`    | ≤ 10 m | `[0, 100, 50, 100, 50, 100, 50, 100]` | Tren rápido. Detener avance. |

---

## Reglas de Lógica

### 1. Filtro de Dirección
La vibración **solo se activa si el usuario se acerca**. Implementado con histeresis de 2 m.

### 2. Moving Average Filter (5 muestras)
Descarta lecturas con `accuracy > 25 m`. Mitiga el GPS Jitter en el microcentro de BB.

### 3. Filtro de Consistencia DANGER
La zona de 10 m requiere **3 lecturas consecutivas** antes de disparar.

### 4. Optimización de Batería
`timeInterval: 1000 ms` + `distanceInterval: 2 m` en `watchPositionAsync`.

---

## Instalación

```bash
npm install
npm run android   # o npm run ios
npm test          # tests con cobertura
```

---

## Roadmap

- [ ] Integración con paradas SAPEM (colectivos)
- [ ] Sync con Overpass API para dataset actualizado
- [ ] BackgroundFetch para alertas en segundo plano
- [ ] Modo "Ruta guiada"
- [ ] Semáforos accesibles vía BLE
