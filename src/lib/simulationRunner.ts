import { getDrones, getNodes } from '@/db/api';
import { runSimulation } from '@/lib/simulation';

let intervalId: ReturnType<typeof setInterval> | null = null;
let subscribers = 0;
let running = false;

const tick = async () => {
  if (running) return;
  running = true;
  try {
    const [currentDrones, currentNodes] = await Promise.all([getDrones(), getNodes()]);
    await runSimulation(currentDrones, currentNodes);
  } catch (error) {
    console.error('Simulation error:', error);
  } finally {
    running = false;
  }
};

export const startSimulationRunner = (intervalMs = 2000) => {
  subscribers += 1;
  if (!intervalId) {
    void tick();
    intervalId = setInterval(tick, intervalMs);
  }

  return () => {
    subscribers = Math.max(0, subscribers - 1);
    if (subscribers === 0 && intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
  };
};
