import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import {
  getCompanies,
  getCompanyById,
  getProfiles,
  getProfileById,
  upsertProfile,
  updateProfile,
  getNodes,
  getNodeById,
  createNode,
  updateNode,
  getDrones,
  getDroneById,
  updateDrone,
  createDrone,
  deleteDrone,
  getTransactions,
  createTransaction,
  getNetworkMetrics,
} from './store.js';

const app = express();

const corsOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const corsOptions = {
  origin: corsOrigins.length > 0 ? corsOrigins : true,
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'polaris-api' });
});

app.get('/api/companies', async (_req, res, next) => {
  try {
    const companies = await getCompanies();
    res.json(companies);
  } catch (error) {
    next(error);
  }
});

app.get('/api/companies/:id', async (req, res, next) => {
  try {
    const company = await getCompanyById(req.params.id);
    res.json(company);
  } catch (error) {
    next(error);
  }
});

app.get('/api/profiles', async (_req, res, next) => {
  try {
    const profiles = await getProfiles();
    res.json(profiles);
  } catch (error) {
    next(error);
  }
});

app.get('/api/profiles/:id', async (req, res, next) => {
  try {
    const profile = await getProfileById(req.params.id);
    res.json(profile);
  } catch (error) {
    next(error);
  }
});

app.post('/api/profiles', async (req, res, next) => {
  try {
    const profile = await upsertProfile(req.body);
    res.json(profile);
  } catch (error) {
    next(error);
  }
});

app.patch('/api/profiles/:id', async (req, res, next) => {
  try {
    await updateProfile(req.params.id, req.body);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.get('/api/nodes', async (_req, res, next) => {
  try {
    const nodes = await getNodes();
    res.json(nodes);
  } catch (error) {
    next(error);
  }
});

app.get('/api/nodes/:id', async (req, res, next) => {
  try {
    const node = await getNodeById(req.params.id);
    res.json(node);
  } catch (error) {
    next(error);
  }
});

app.post('/api/nodes', async (req, res, next) => {
  try {
    const node = await createNode(req.body);
    res.json(node);
  } catch (error) {
    next(error);
  }
});

app.patch('/api/nodes/:id', async (req, res, next) => {
  try {
    await updateNode(req.params.id, req.body);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.get('/api/drones', async (_req, res, next) => {
  try {
    const drones = await getDrones();
    res.json(drones);
  } catch (error) {
    next(error);
  }
});

app.get('/api/drones/:id', async (req, res, next) => {
  try {
    const drone = await getDroneById(req.params.id);
    res.json(drone);
  } catch (error) {
    next(error);
  }
});

app.patch('/api/drones/:id', async (req, res, next) => {
  try {
    await updateDrone(req.params.id, req.body);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.post('/api/drones', async (req, res, next) => {
  try {
    const tierPricing = {
      starter: 0.5,
      pro: 1.25,
      enterprise: 2.5,
    };

    const { tier = 'starter', ...payload } = req.body ?? {};
    const drone = await createDrone(payload);

    const amountSol = tierPricing[tier] ?? tierPricing.starter;
    if (drone.company_id) {
      await createTransaction({
        drone_id: drone.id,
        node_id: null,
        company_id: drone.company_id,
        amount_sol: amountSol,
      });
    }

    res.json({ drone, tier, amount_sol: amountSol });
  } catch (error) {
    next(error);
  }
});

app.delete('/api/drones/:id', async (req, res, next) => {
  try {
    const removed = await deleteDrone(req.params.id);
    res.json({ ok: removed });
  } catch (error) {
    next(error);
  }
});

app.get('/api/transactions', async (req, res, next) => {
  try {
    const limit = Number(req.query.limit) || 50;
    const transactions = await getTransactions(limit);
    res.json(transactions);
  } catch (error) {
    next(error);
  }
});

app.post('/api/transactions', async (req, res, next) => {
  try {
    const tx = await createTransaction(req.body);
    res.json(tx);
  } catch (error) {
    next(error);
  }
});

app.get('/api/metrics', async (_req, res, next) => {
  try {
    const metrics = await getNetworkMetrics();
    res.json(metrics);
  } catch (error) {
    next(error);
  }
});

app.post('/api/ai-analytics', async (req, res, next) => {
  try {
    const { networkData } = req.body ?? {};
    const summary = networkData
      ? `Network health looks stable with ${networkData.total_drones} active drones and ${networkData.total_nodes} nodes.`
      : 'Network health summary is unavailable.';

    const recommendations = [
      {
        title: 'Rebalance charging loads',
        description: `Shift traffic away from ${networkData?.most_congested_node ?? 'the busiest node'} to reduce congestion.`,
        impact: 'Lower queue times by 8-12%',
        priority: 'high',
      },
      {
        title: 'Schedule proactive maintenance',
        description: 'Rotate drones with low battery and prioritize charging slots for them.',
        impact: 'Reduce battery-related delays by ~10%',
        priority: 'medium',
      },
      {
        title: 'Optimize delivery windows',
        description: 'Batch deliveries during lower congestion periods.',
        impact: 'Improve deliveries per hour by 5-7%',
        priority: 'low',
      },
    ];

    res.json({ summary, recommendations });
  } catch (error) {
    next(error);
  }
});

app.post('/api/text-to-speech', async (req, res, next) => {
  try {
    const apiKey = process.env.INTEGRATIONS_API_KEY;
    if (!apiKey) {
      res.json({
        audioBase64: null,
        message: 'INTEGRATIONS_API_KEY not configured yet. Add it to enable TTS.',
      });
      return;
    }

    // Placeholder: integration call would go here using apiKey.
    res.json({
      audioBase64: null,
      message: 'TTS integration placeholder. Wire this to your provider when ready.',
    });
  } catch (error) {
    next(error);
  }
});

app.use((error, _req, res, _next) => {
  console.error('API error:', error);
  res.status(500).json({ error: error.message || 'Internal server error' });
});

const port = Number(process.env.PORT) || 5050;
app.listen(port, () => {
  console.log(`Polaris API running on http://localhost:${port}`);
});
