import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import Svg, { Polygon } from 'react-native-svg';

export type AlignmentStatus = 'LEFT' | 'LITTLE LEFT' | 'CENTER' | 'LITTLE RIGHT' | 'RIGHT' | 'SEARCHING...';

interface Props {
  status: AlignmentStatus;
  distFeet: number | null;
  screenWidth: number;
  screenHeight: number;
  corners: number[][] | null;
  frameW: number;
  frameH: number;
}

const STATUS_COLOR: Record<AlignmentStatus, string> = {
  'CENTER':       '#00e676',
  'LITTLE LEFT':  '#ffeb3b',
  'LITTLE RIGHT': '#ffeb3b',
  'LEFT':         '#ff5252',
  'RIGHT':        '#ff5252',
  'SEARCHING...': '#ffffff',
};

// Convert a frame corner [frameX, frameY] (landscape) to screen [x, y] in portrait.
// VisionCamera rotates the landscape frame 90° CW, then aspect-fills the portrait screen.
// After rotation the displayed frame is frameH wide × frameW tall.
// Aspect fill: scale = screenHeight / frameW; the sides are cropped by cropX each.
function toScreen(
  corner: number[],
  frameW: number,
  frameH: number,
  screenWidth: number,
  screenHeight: number,
): [number, number] {
  const scale = screenHeight / frameW;
  const cropX = (frameH * scale - screenWidth) / 2;
  const sx = (frameH - corner[1]) * scale - cropX;
  const sy = corner[0] * scale;
  return [sx, sy];
}

export function AlignmentOverlay({ status, distFeet, screenWidth, screenHeight, corners, frameW, frameH }: Props) {
  const statusColor = STATUS_COLOR[status];

  // Build SVG polygon points string from the 4 ArUco corners
  let polygonPoints: string | null = null;
  if (corners && corners.length === 4 && frameW > 0 && frameH > 0) {
    polygonPoints = corners
      .map((c) => toScreen(c, frameW, frameH, screenWidth, screenHeight).join(','))
      .join(' ');
  }

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Center line guide */}
      <View style={[styles.centerLine, { left: screenWidth / 2 - 1 }]} />

      {/* ArUco corner overlay */}
      {polygonPoints && (
        <Svg width={screenWidth} height={screenHeight} style={StyleSheet.absoluteFill}>
          <Polygon
            points={polygonPoints}
            fill="none"
            stroke={statusColor}
            strokeWidth={3}
          />
        </Svg>
      )}

      {/* Status banner */}
      <View style={styles.statusContainer}>
        <Text style={[styles.statusText, { color: statusColor }]}>{status}</Text>
      </View>

      {/* Distance readout */}
      <View style={styles.distContainer}>
        <Text style={styles.distText}>
          {distFeet !== null ? `${distFeet.toFixed(1)} ft` : '— ft'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  centerLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  statusContainer: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  statusText: {
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: 2,
    textShadowColor: '#000',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 6,
  },
  distContainer: {
    position: 'absolute',
    bottom: 110,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  distText: {
    color: '#ffffff',
    fontSize: 48,
    fontWeight: '700',
    textShadowColor: '#000',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 6,
  },
});
