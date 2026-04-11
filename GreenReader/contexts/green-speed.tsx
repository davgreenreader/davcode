import { createContext, useContext, useState } from 'react';

export type GreenSpeed = 'SLOW' | 'NORMAL' | 'FAST';

// Break multipliers by green speed (stimp-based)
// SLOW  (~stimp 8):  golfer hits firmer → less break
// NORMAL (~stimp 10): baseline
// FAST  (~stimp 12+): lighter touch → more break
export const GREEN_SPEED_MODIFIER: Record<GreenSpeed, number> = {
  SLOW:   0.75,
  NORMAL: 1.00,
  FAST:   1.30,
};

export const GREEN_SPEED_LABEL: Record<GreenSpeed, string> = {
  SLOW:   'Slow Greens',
  NORMAL: 'Normal Greens',
  FAST:   'Fast Greens',
};

const GreenSpeedContext = createContext<{
  greenSpeed: GreenSpeed;
  setGreenSpeed: (s: GreenSpeed) => void;
}>({ greenSpeed: 'NORMAL', setGreenSpeed: () => {} });

export function GreenSpeedProvider({ children }: { children: React.ReactNode }) {
  const [greenSpeed, setGreenSpeed] = useState<GreenSpeed>('NORMAL');
  return (
    <GreenSpeedContext.Provider value={{ greenSpeed, setGreenSpeed }}>
      {children}
    </GreenSpeedContext.Provider>
  );
}

export const useGreenSpeed = () => useContext(GreenSpeedContext);
