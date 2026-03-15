import * as tf from '@tensorflow/tfjs';

export interface RouteFeatures {
  distanceKm: number;
  congestion: number;
  batteryLevel: number;
  droneDensity: number;
}

const FEATURE_SCALES = {
  distanceKm: 50,
  congestion: 1,
  batteryLevel: 1,
  droneDensity: 1,
};

let cachedModel: tf.LayersModel | null = null;

const buildModel = (): tf.LayersModel => {
  const model = tf.sequential();
  model.add(
    tf.layers.dense({
      inputShape: [4],
      units: 1,
      activation: 'linear',
      useBias: true,
    })
  );

  const weights = tf.tensor2d([[0.7], [0.3], [0.4], [0.2]]);
  const bias = tf.tensor1d([0.05]);
  model.setWeights([weights, bias]);

  return model;
};

const getModel = (): tf.LayersModel => {
  if (!cachedModel) {
    cachedModel = buildModel();
  }
  return cachedModel;
};

const normalizeFeatures = (features: RouteFeatures): number[] => {
  const distance = features.distanceKm / FEATURE_SCALES.distanceKm;
  const congestion = features.congestion / FEATURE_SCALES.congestion;
  const batteryPenalty = (1 - features.batteryLevel) / FEATURE_SCALES.batteryLevel;
  const density = features.droneDensity / FEATURE_SCALES.droneDensity;

  return [distance, congestion, batteryPenalty, density];
};

export const estimatePathCost = (features: RouteFeatures): number => {
  const model = getModel();
  return tf.tidy(() => {
    const input = tf.tensor2d([normalizeFeatures(features)]);
    const output = model.predict(input) as tf.Tensor;
    const value = output.dataSync()[0];
    return Number.isFinite(value) ? value : Number.POSITIVE_INFINITY;
  });
};
