/**
 * Replicates the sensor-fusion elevation calculation from elevation_V2.py.
 *
 * Fuses the camera's pose estimate with the IMU pitch angle to compute
 * absolute ground elevation relative to the camera position.
 */
export function calculateElevation(
  tvec: [number, number, number],
  pitchDegrees: number,
  cameraHeightCm: number,
  tagHeightCm: number
): number {
  const pitchRad = (pitchDegrees * Math.PI) / 180;

  const camYOffset = tvec[1]; // Vertical offset in camera's local frame
  const camZDepth = tvec[2];  // Depth in camera's local frame

  // Rotate camera-Y vector by IMU pitch to get true height in world frame
  const trueTagY =
    camZDepth * Math.sin(pitchRad) + camYOffset * Math.cos(pitchRad);

  // Absolute ground elevation: compensate for sensor mounting heights
  return trueTagY + cameraHeightCm - tagHeightCm;
}
