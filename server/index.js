import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();
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
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

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
    const { networkData, companyContext } = req.body ?? {};
    const companyId = companyContext?.id ?? companyContext?.company_id ?? null;
    const company = companyId ? await getCompanyById(companyId) : null;

    const fallback = {
      summary: networkData
        ? `Network health looks stable with ${networkData.total_drones} active drones and ${networkData.total_nodes} nodes.`
        : 'Network health summary is unavailable.',
      recommendations: [
        {
          title: 'Infrastructure Expansion',
          description: `Add capacity near ${networkData?.most_congested_node ?? 'the busiest node'} to reduce queue times.`,
          impact: 'Improves peak throughput by 8-15%',
          priority: 'high',
        },
        {
          title: 'Efficiency Insights',
          description: 'Batch deliveries during lower congestion periods and pre-charge high-usage routes.',
          impact: 'Cuts average delay by 5-10%',
          priority: 'medium',
        },
        {
          title: 'Congestion Prediction',
          description: 'Expect congestion spikes during top delivery windows; pre-allocate nodes to absorb surges.',
          impact: 'Reduces congestion risk by ~10%',
          priority: 'low',
        },
      ],
    };

    if (!networkData) {
      res.json(fallback);
      return;
    }

    if (!GEMINI_API_KEY) {
      res.json(fallback);
      return;
    }

    const prompt = `You are an operations analyst for a drone infrastructure network.${
      company?.name ? ` The user belongs to ${company.name}.` : ''
    }
Return JSON only (no markdown) with this schema:
{
  "summary": string,
  "recommendations": [
    { "title": string, "description": string, "impact": string, "priority": "high"|"medium"|"low" }
  ]
}
Requirements:
- Include at least 3 recommendations.
- Explicitly cover: infrastructure expansion suggestions, efficiency insights, and congestion predictions.
- Base your response on this data: ${JSON.stringify(networkData)}.`;

    const response = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': GEMINI_API_KEY,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      }
    );

    if (!response.ok) {
      res.json(fallback);
      return;
    }

    const payload = await response.json();
    const text = payload?.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? '')
      .join('');
    const jsonMatch = text?.match(/\{[\s\S]*\}/);
    const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : null;

    if (!parsed?.summary || !Array.isArray(parsed?.recommendations)) {
      res.json(fallback);
      return;
    }

    res.json(parsed);
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
