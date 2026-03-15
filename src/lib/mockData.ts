import type { MockScenario } from '@/types/mock';

export const loadMockScenario = async (): Promise<MockScenario> => {
  const response = await fetch('/mock/scenario.json');
  if (!response.ok) {
    throw new Error('Failed to load mock scenario data');
  }
  return response.json() as Promise<MockScenario>;
};
