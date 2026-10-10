import express from "express";
import http from "http";
import { WebSocketServer } from "ws";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import * as dotenv from "dotenv";
import Stripe from 'stripe';
import { createBuildJob, getBuildJob, BuildPlatform } from './server/builder';
import { setupCollabWebSocketServer, createSession, getSession } from './server/collab-server';

dotenv.config();
dotenv.config({ path: '.env.example' });

let stripeClient: Stripe | null = null;
function getStripe(): Stripe {
  if (!stripeClient) {
    const key = process.env.STRIPE_SECRET_KEY || 'sk_test_4eC39HqLyjWDarjtT1zdp7dc';
    stripeClient = new Stripe(key, { apiVersion: '2025-01-27.acacia' as any });
  }
  return stripeClient;
}

const PREMIUM_PRICE = 599; // $5.99

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API routes
  app.post("/api/create-checkout-session", async (req, res) => {
    try {
      const { userId } = req.body;
      const stripe = getStripe();
      const origin = req.headers.origin || `http://localhost:${PORT}`;

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: 'usd',
              product_data: {
                name: 'Premium License',
                description: 'One-time premium code for EPL',
              },
              unit_amount: PREMIUM_PRICE,
            },
            quantity: 1,
          },
        ],
        mode: 'payment',
        success_url: `${origin}/success?session_id={CHECKOUT_SESSION_ID}&user_id=${userId || 'guest'}`,
        cancel_url: `${origin}/premium`,
      });

      res.json({ id: session.id, url: session.url });
    } catch (err: any) {
      console.error('Stripe error:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/verify-session", async (req, res) => {
    try {
      const { session_id, user_id } = req.query;
      if (!session_id || typeof session_id !== 'string') {
        return res.status(400).json({ error: 'Missing session_id' });
      }

      const stripe = getStripe();
      const session = await stripe.checkout.sessions.retrieve(session_id);

      if (session.payment_status === 'paid') {
        // Generate a code
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        const gen = () => Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
        const premiumCode = `System.Unlock.Premium: Code ${gen()}-${gen()}-${gen()}`;
        
        return res.json({ success: true, premiumCode });
      }

      res.status(400).json({ error: 'Not paid' });
    } catch (err: any) {
      console.error('Verify error:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // Project Build & Export System
  app.post("/api/build", async (req, res) => {
    try {
      const { projectId, platform, version, appData } = req.body;
      if (!projectId || !platform) {
        return res.status(400).json({ error: 'Missing projectId or platform parameter' });
      }

      const validPlatforms = ['windows', 'macos', 'linux', 'android', 'ios', 'ios-ipa'];
      if (!validPlatforms.includes(platform)) {
        return res.status(400).json({ error: `Invalid platform: ${platform}. Allowed: ${validPlatforms.join(', ')}` });
      }

      const job = await createBuildJob(
        projectId, 
        platform as BuildPlatform, 
        version || '1.0.0', 
        appData || { title: 'EPL App', code: '' }
      );

      res.json({ buildId: job.id, status: job.status, progress: job.progress });
    } catch (err: any) {
      console.error('Build creation error:', err);
      res.status(500).json({ error: err.message || 'Failed to initialize build' });
    }
  });

  app.get("/api/build/:buildId/status", (req, res) => {
    const job = getBuildJob(req.params.buildId);
    if (!job) {
      return res.status(404).json({ error: 'Build job not found' });
    }
    res.json({
      buildId: job.id,
      projectId: job.projectId,
      platform: job.platform,
      version: job.version,
      status: job.status,
      progress: job.progress,
      statusMessage: job.statusMessage,
      logs: job.logs || [],
      downloadUrl: job.downloadUrl,
      fileName: job.fileName,
      fileSize: job.fileSize,
      error: job.error
    });
  });

  app.get("/api/build/:buildId/download", (req, res) => {
    const job = getBuildJob(req.params.buildId);
    if (!job || job.status !== 'completed' || !job.filePath) {
      return res.status(404).json({ error: 'Build file not ready or job not found' });
    }
    if (!fs.existsSync(job.filePath)) {
      return res.status(404).json({ error: 'Build file expired or missing' });
    }

    const safeName = job.fileName ? job.fileName.replace(/[^\w\.\-\(\) _]/gi, '_') : 'app-build.zip';

    res.download(job.filePath, safeName, (err) => {
      if (err && !res.headersSent) {
        console.error('Download error:', err);
        res.status(500).json({ error: 'Error transmitting build file' });
      }
    });
  });

  // Together Create API routes
  app.post("/api/collab/create", (req, res) => {
    try {
      const { ownerId, ownerName, projectName, files, projectId } = req.body;
      if (!ownerId) {
        return res.status(400).json({ error: 'Missing ownerId' });
      }

      const session = createSession(
        ownerId,
        ownerName || 'User',
        projectName || 'Together Create Project',
        files || [],
        projectId
      );

      res.json({ session });
    } catch (err: any) {
      console.error('Create collab error:', err);
      res.status(500).json({ error: err.message || 'Failed to create session' });
    }
  });

  app.get("/api/collab/:sessionId", (req, res) => {
    const session = getSession(req.params.sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.json({
      id: session.data.id,
      projectName: session.data.projectName,
      ownerId: session.data.ownerId,
      ownerName: session.data.ownerName,
      createdAt: session.data.createdAt,
      participantCount: session.clients.size,
      fileCount: session.data.files.length
    });
  });

  // Create HTTP server & WebSocket server for Together Create
  const httpServer = http.createServer(app);
  const wss = new WebSocketServer({ server: httpServer, path: '/ws/collab' });
  setupCollabWebSocketServer(wss);

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
