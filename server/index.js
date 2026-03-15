import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import {
  getCompanies,
  getCompanyById,
  createCompany,
  getProfiles,
  getProfileById,
  getProfileByUsername,
  upsertProfile,
  updateProfile,
  associateProfileCompany,
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
  allowedHeaders: ['Content-Type', 'Authorization', 'x-user-role'],
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

app.post('/api/companies', async (req, res, next) => {
  try {
    const company = await createCompany(req.body?.name ?? '');
    res.json(company);
  } catch (error) {
    res.status(400).json({ error: error.message || 'Failed to create company.' });
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

app.get('/api/profiles/by-username/:username', async (req, res, next) => {
  try {
    const profile = await getProfileByUsername(req.params.username);
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

app.post('/api/profiles/:id/company', async (req, res, next) => {
  try {
    const profile = await associateProfileCompany(req.params.id, req.body?.company_id);
    res.json(profile);
  } catch (error) {
    res.status(400).json({ error: error.message || 'Failed to associate company.' });
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
    const userRole = req.headers['x-user-role'];
    if (userRole !== 'admin') {
      res.status(403).json({ error: 'Only admins can create nodes.' });
      return;
    }
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

    const userRole = req.headers['x-user-role'];
    if (userRole === 'admin') {
      res.status(403).json({ error: 'Admins cannot register drones.' });
      return;
    }
    const { tier = 'starter', ...payload } = req.body ?? {};
    if (!payload?.company_id) {
      res.status(400).json({ error: 'Company association is required to register drones.' });
      return;
    }
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
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      res.json({
        summary: 'AI analysis is not configured yet. Add GEMINI_API_KEY to enable it.',
        recommendations: [],
      });
      return;
    }

    const model = process.env.GEMINI_MODEL || 'gemini-3-flash-preview';
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

    const responseSchema = {
      type: 'object',
      properties: {
        summary: { type: 'string' },
        recommendations: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              description: { type: 'string' },
              impact: { type: 'string' },
              priority: { type: 'string', enum: ['high', 'medium', 'low'] },
            },
            required: ['title', 'description', 'impact', 'priority'],
          },
        },
      },
      required: ['summary', 'recommendations'],
    };

    const prompt = [
      'You are an operations analyst for a drone fleet platform.',
      'Return JSON that matches the provided schema.',
      'Use concise, actionable language.',
      '',
      'Network data:',
      JSON.stringify(networkData ?? {}, null, 2),
    ].join('\n');

    const geminiResponse = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          responseJsonSchema: responseSchema,
        },
      }),
    });

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      throw new Error(`Gemini API error: ${geminiResponse.status} ${errorText}`);
    }

    const payload = await geminiResponse.json();
    const text = payload?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      throw new Error('Gemini response missing content text.');
    }

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error('Gemini returned non-JSON output.');
    }

    const summary = typeof parsed?.summary === 'string' ? parsed.summary : 'No summary provided.';
    const recommendations = Array.isArray(parsed?.recommendations) ? parsed.recommendations : [];

    res.json({ summary, recommendations });
  } catch (error) {
    next(error);
  }
});

app.post('/api/text-to-speech', async (req, res, next) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      res.json({
        audioBase64: null,
        message: 'GEMINI_API_KEY not configured yet. Add it to enable TTS.',
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
