import * as tf from '@tensorflow/tfjs-node';
import { getDrones, getNodes } from './store.js';

const modelState = {
  model: null,
  last_trained_at: null,
  weights: [],
  last_loss: null,
};

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));

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

const ensureModel = (inputDim) => {
  if (modelState.model) return modelState.model;
  const model = tf.sequential();
  model.add(
    tf.layers.dense({
      units: 1,
      inputShape: [inputDim],
      activation: 'linear',
      useBias: true,
    })
  );
  model.compile({
    optimizer: tf.train.adam(0.05),
    loss: 'meanSquaredError',
  });
  modelState.model = model;
  return model;
};

const trainModel = async (samples) => {
  if (samples.length === 0) return;
  const inputDim = samples[0].features.length;
  const model = ensureModel(inputDim);

  const xs = tf.tensor2d(samples.map((sample) => sample.features));
  const ys = tf.tensor2d(samples.map((sample) => [sample.target]));

  try {
    const history = await model.fit(xs, ys, {
      epochs: 12,
      batchSize: Math.min(samples.length, 16),
      shuffle: true,
      verbose: 0,
    });

    const loss = history?.history?.loss;
    modelState.last_loss = Array.isArray(loss) ? loss[loss.length - 1] : null;

    const weights = model.getWeights();
    const kernel = await weights[0].array();
    const bias = await weights[1].array();
    modelState.weights = [...kernel.map((row) => row[0]), bias[0]];
    modelState.last_trained_at = new Date().toISOString();
  } finally {
    xs.dispose();
    ys.dispose();
  }
};

const predict = async (samples) => {
  if (samples.length === 0) return [];
  const model = ensureModel(samples[0].features.length);
  const xs = tf.tensor2d(samples.map((sample) => sample.features));
  try {
    const predsTensor = model.predict(xs);
    const preds = await predsTensor.array();
    predsTensor.dispose();
    return samples.map((sample, idx) => ({
      node_id: sample.node.id,
      congestion: clamp(preds[idx][0]),
    }));
  } finally {
    xs.dispose();
  }
};

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

const buildHeatCells = (drones, hotspots) => {
  const points = [
    ...drones.map((drone) => ({ lat: drone.lat, lng: drone.lng, weight: 1.2 })),
  ];

  hotspots.forEach((hotspot) => {
    if (hotspot.intensity < 0.4) return;
    const extra = Math.round(3 + hotspot.intensity * 6);
    for (let i = 0; i < extra; i += 1) {
      points.push({
        lat: hotspot.lat + (Math.random() - 0.5) * 0.014,
        lng: hotspot.lng + (Math.random() - 0.5) * 0.014,
        weight: 0.6 + hotspot.intensity * 0.6,
      });
    }
  });

  const grid = new Map();
  const gridSize = 0.0045;
  const sigma = 0.035;
  const radiusCells = Math.ceil((sigma * 2) / gridSize);

  points.forEach((point) => {
    const baseLat = Math.round(point.lat / gridSize) * gridSize;
    const baseLng = Math.round(point.lng / gridSize) * gridSize;
    for (let dx = -radiusCells; dx <= radiusCells; dx += 1) {
      for (let dy = -radiusCells; dy <= radiusCells; dy += 1) {
        const lat = baseLat + dx * gridSize;
        const lng = baseLng + dy * gridSize;
        const dist = Math.hypot(lat - point.lat, lng - point.lng);
        const kernel = Math.exp(-(dist * dist) / (2 * sigma * sigma)) * point.weight;
        if (kernel < 0.008) continue;
        const key = `${lat.toFixed(4)}|${lng.toFixed(4)}`;
        const existing = grid.get(key);
        if (existing) {
          existing.value += kernel;
        } else {
          grid.set(key, { lat, lng, value: kernel });
        }
      }
    }
  });

  const values = Array.from(grid.values()).map((cell) => cell.value);
  const maxValue = values.length > 0 ? Math.max(...values) : 1;

  const cells = [];
  grid.forEach((cell) => {
    const intensity = Math.min(1, cell.value / maxValue);
    if (intensity < 0.05) return;
    cells.push({ lat: cell.lat, lng: cell.lng, intensity });
  });

  return cells;
};

export const buildForecast = async ({ nodes, drones } = {}) => {
  const liveNodes = nodes ?? (await getNodes());
  const liveDrones = drones ?? (await getDrones());
  const samples = buildSamples(liveNodes, liveDrones);

  await trainModel(samples);
  const predictions = await predict(samples);
  const hotspots = buildHotspots(liveNodes, predictions);
  const heat_cells = buildHeatCells(liveDrones, hotspots);

  return {
    predictions,
    hotspots,
    heat_cells,
    generated_at: new Date().toISOString(),
    model: {
      weights: modelState.weights,
      last_trained_at: modelState.last_trained_at,
      loss: modelState.last_loss,
      samples: samples.length,
      nodes: liveNodes.length,
      drones: liveDrones.length,
    },
  };
};
