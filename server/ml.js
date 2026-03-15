import { getDrones, getNodes } from './store.js';

const modelState = {
  weights: [0, 0, 0, 0, 0],
  last_trained_at: null,
};

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));

const dot = (a, b) => a.reduce((sum, val, idx) => sum + val * b[idx], 0);

const buildSamples = (nodes, drones) => {
  const radius = 0.02;
  return nodes.map((node) => {
    const nearby = drones.filter(
      (drone) => Math.hypot(drone.lat - node.lat, drone.lng - node.lng) < radius
    );
    const density = nearby.length / Math.max(1, drones.length);
    const avgBattery =
      nearby.length > 0
        ? nearby.reduce((sum, drone) => sum + (drone.battery ?? 100), 0) / nearby.length
        : 100;
    const batteryStress = 1 - avgBattery / 100;
    const loadRatio = node.current_load / Math.max(1, node.capacity);
    const capNorm = node.capacity / 10;
    const features = [1, loadRatio, capNorm, density, batteryStress];
    return {
      node,
      features,
      target: clamp(loadRatio),
    };
  });
};

const trainModel = (samples, lr = 0.05) => {
  for (const sample of samples) {
    const pred = dot(modelState.weights, sample.features);
    const error = pred - sample.target;
    modelState.weights = modelState.weights.map(
      (w, idx) => w - lr * error * sample.features[idx]
    );
  }
  modelState.last_trained_at = new Date().toISOString();
};

const predict = (samples) =>
  samples.map((sample) => ({
    node_id: sample.node.id,
    congestion: clamp(dot(modelState.weights, sample.features)),
  }));

const buildHotspots = (nodes, predictions) => {
  const byNode = new Map(predictions.map((item) => [item.node_id, item.congestion]));
  return nodes
    .map((node) => ({
      node_id: node.id,
      lat: node.lat,
      lng: node.lng,
      intensity: byNode.get(node.id) ?? 0,
    }))
    .sort((a, b) => b.intensity - a.intensity)
    .slice(0, 8);
};

export const buildForecast = async ({ nodes, drones } = {}) => {
  const liveNodes = nodes ?? (await getNodes());
  const liveDrones = drones ?? (await getDrones());
  const samples = buildSamples(liveNodes, liveDrones);
  trainModel(samples);
  const predictions = predict(samples);
  const hotspots = buildHotspots(liveNodes, predictions);

  return {
    predictions,
    hotspots,
    generated_at: new Date().toISOString(),
    model: {
      weights: modelState.weights,
      last_trained_at: modelState.last_trained_at,
    },
  };
};
