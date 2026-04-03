import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import Svg, { Polygon, Line } from 'react-native-svg';

export type AlignmentStatus =
  | 'MOVE LEFT'
  | 'SLIGHT LEFT'
  | 'CENTERED'
  | 'SLIGHT RIGHT'
  | 'MOVE RIGHT'
  | 'SEARCHING';

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
  'CENTERED':    '#00e676',
  'SLIGHT LEFT': '#ffeb3b',
  'SLIGHT RIGHT':'#ffeb3b',
  'MOVE LEFT':   '#ff5252',
  'MOVE RIGHT':  '#ff5252',
  'SEARCHING':   'rgba(255,255,255,0.7)',
};

// ─── Coordinate transform ────────────────────────────────────────────────────
// VisionCamera delivers frames in landscape (camera native orientation).
// Back camera in portrait: frame rotated 90° CW for display.
// After rotation: displayed width = frameH, displayed height = frameW.
// Aspect-fill scale = screenHeight / frameW.
// Excess width is cropped symmetrically on both sides.
//
// 90° CW mapping:  new_x = frameH - frameY,  new_y = frameX
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

export function AlignmentOverlay({
  status,
  distFeet,
  screenWidth,
  screenHeight,
  corners,
  frameW,
  frameH,
}: Props) {
  const color = STATUS_COLOR[status];

  // Build SVG polygon from the 4 ArUco corners
  let polygonPoints: string | null = null;
  if (corners && corners.length === 4 && frameW > 0 && frameH > 0) {
    polygonPoints = corners
      .map((c) => toScreen(c, frameW, frameH, screenWidth, screenHeight).join(','))
      .join(' ');
  }

  const centerX = screenWidth / 2;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Vertical center guide line */}
      <Svg
        width={screenWidth}
        height={screenHeight}
        style={StyleSheet.absoluteFill}>
        <Line
          x1={centerX}
          y1="0"
          x2={centerX}
          y2={screenHeight}
          stroke="rgba(255,255,255,0.30)"
          strokeWidth={2}
          strokeDasharray="12,8"
        />

        {/* ArUco marker outline */}
        {polygonPoints && (
          <Polygon
            points={polygonPoints}
            fill="rgba(0,0,0,0.15)"
            stroke={color}
            strokeWidth={3}
          />
        )}
      </Svg>

      {/* Status label */}
      <View style={styles.statusWrap}>
        <Text style={[styles.statusText, { color }]}>{status}</Text>
      </View>

      {/* Arrow cue */}
      {(status === 'MOVE LEFT' || status === 'SLIGHT LEFT') && (
        <View style={[styles.arrow, styles.arrowLeft]}>
          <Text style={[styles.arrowText, { color }]}>◀</Text>
        </View>
      )}
      {(status === 'MOVE RIGHT' || status === 'SLIGHT RIGHT') && (
        <View style={[styles.arrow, styles.arrowRight]}>
          <Text style={[styles.arrowText, { color }]}>▶</Text>
        </View>
      )}

      {/* Distance readout */}
      <View style={styles.distWrap}>
        <Text style={styles.distText}>
          {distFeet !== null ? `${distFeet.toFixed(1)} ft` : ''}
        </Text>
      </View>

      {/* DEBUG — remove after calibration */}
      {frameW > 0 && corners && (
        <View style={styles.debugWrap}>
          <Text style={styles.debugText}>
            frame:{frameW}x{frameH} view:{Math.round(screenWidth)}x{Math.round(screenHeight)}
          </Text>
          <Text style={styles.debugText}>
            c0:[{Math.round(corners[0][0])},{Math.round(corners[0][1])}]
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  statusWrap: {
    position: 'absolute',
    top: 64,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  statusText: {
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: 2,
    textShadowColor: '#000',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 8,
  },
  arrow: {
    position: 'absolute',
    top: '45%',
  },
  arrowLeft: {
    left: 24,
  },
  arrowRight: {
    right: 24,
  },
  arrowText: {
    fontSize: 48,
    textShadowColor: '#000',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 6,
  },
  distWrap: {
    position: 'absolute',
    bottom: 120,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  distText: {
    color: '#ffffff',
    fontSize: 44,
    fontWeight: '700',
    textShadowColor: '#000',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 6,
  },
  debugWrap: {
    position: 'absolute',
    bottom: 180,
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: 2,
  },
  debugText: {
    color: '#ffeb3b',
    fontSize: 12,
    fontWeight: '600',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
});
