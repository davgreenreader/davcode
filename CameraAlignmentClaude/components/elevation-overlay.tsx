/**
 * HUD overlay — mirrors the cv2.putText readouts from elevation_V2.py.
 * Shows: Distance (in), Camera Pitch (deg), Ground Elevation (cm).
 * Also draws an SVG bounding box around the detected ArUco marker.
 */
import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import Svg, { Polygon } from 'react-native-svg';

import { ElevationColors } from '@/constants/theme';

interface Props {
  distIn: number;
  pitchDeg: number;
  elevationCm: number;
  markerFound: boolean;
  /** Screen-space corners [[x,y], ...] scaled to the display size */
  screenCorners: number[][] | null;
  screenWidth: number;
  screenHeight: number;
}

export function ElevationOverlay({
  distIn,
  pitchDeg,
  elevationCm,
  markerFound,
  screenCorners,
  screenWidth,
  screenHeight,
}: Props) {
  const color = markerFound
    ? Math.abs(elevationCm) < 2.0
      ? ElevationColors.level
      : ElevationColors.slope
    : ElevationColors.noTarget;

  const polygonPoints = screenCorners
    ? screenCorners.map(([x, y]) => `${x},${y}`).join(' ')
    : null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Marker bounding box */}
      {polygonPoints && (
        <Svg width={screenWidth} height={screenHeight} style={StyleSheet.absoluteFill}>
          <Polygon
            points={polygonPoints}
            fill="none"
            stroke={color}
            strokeWidth={2.5}
          />
        </Svg>
      )}

      {/* HUD readouts — bottom-left, matching Python layout */}
      <View style={styles.hud}>
        <Text style={[styles.hudText, { color: '#ffffff' }]}>
          {markerFound ? `Dist: ${distIn.toFixed(1)} in` : 'Searching for marker 121...'}
        </Text>
        <Text style={[styles.hudText, { color: '#ffc800' }]}>
          {`Cam Pitch: ${pitchDeg.toFixed(1)} deg`}
        </Text>
        {markerFound && (
          <Text style={[styles.hudText, { color }]}>
            {`Ground Elev: ${elevationCm >= 0 ? '+' : ''}${elevationCm.toFixed(1)} cm`}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hud: {
    position: 'absolute',
    bottom: 24,
    left: 20,
    gap: 6,
  },
  hudText: {
    fontFamily: 'monospace',
    fontSize: 16,
    fontWeight: '600',
    textShadowColor: '#000',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
});
