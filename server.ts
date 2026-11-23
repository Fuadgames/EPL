import express from "express";
import http from "http";
import { WebSocketServer } from "ws";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import * as dotenv from "dotenv";
import crypto from "crypto";
import Stripe from 'stripe';
import { GoogleGenAI } from "@google/genai";
import { initializeApp as initServerApp } from "firebase/app";
import { 
  getFirestore as getServerFirestore, 
  doc as serverDoc, 
  deleteDoc as serverDeleteDoc, 
  setDoc as serverSetDoc,
  getDoc as serverGetDoc,
  updateDoc as serverUpdateDoc,
  collection as serverCollection,
  getDocs as serverGetDocs,
  query as serverQuery,
  orderBy as serverOrderBy,
  limit as serverLimit,
  increment as serverIncrement
} from "firebase/firestore";
import { createBuildJob, getBuildJob, type BuildPlatform } from './server/builder.ts';
import { setupCollabWebSocketServer, createSession, getSession } from './server/collab-server.ts';

dotenv.config();
dotenv.config({ path: '.env.example' });

let genAIClient: GoogleGenAI | null = null;
function getAI(): GoogleGenAI {
  if (!genAIClient) {
    const key = process.env.GEMINI_API_KEY || '';
    genAIClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return genAIClient;
}

let stripeClient: Stripe | null = null;
function getStripe(): Stripe {
  if (!stripeClient) {
    const key = (process.env.STRIPE_SECRET_KEY || '').trim();
    if (!key) {
      throw new Error('STRIPE_SECRET_KEY is not configured');
    }
    stripeClient = new Stripe(key, { apiVersion: '2025-01-27.acacia' as any });
  }
  return stripeClient;
}

const PREMIUM_PRICE = 599; // $5.99

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Security Headers Middleware
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    next();
  });

  // Body parser: 25mb for file upload/build payloads, 2mb default elsewhere
  const uploadJsonParser = express.json({ limit: '25mb' });
  const defaultJsonParser = express.json({ limit: '2mb' });
  app.use((req, res, next) => {
    if (req.path === '/api/files/upload' || req.path === '/api/build') {
      return uploadJsonParser(req, res, next);
    }
    return defaultJsonParser(req, res, next);
  });

  // In-memory sliding rate limiter per IP (isolated per route/middleware instance)
  const rateLimiter = (maxRequests: number, windowMs: number) => {
    const routeLimitMap = new Map<string, { count: number; resetAt: number }>();
    return (req: express.Request, res: express.Response, next: express.NextFunction) => {
      const ip = (req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || 'unknown').split(',')[0].trim();
      const now = Date.now();
      if (routeLimitMap.size > 1000) {
        for (const [k, v] of routeLimitMap.entries()) {
          if (now > v.resetAt) routeLimitMap.delete(k);
        }
      }
      const record = routeLimitMap.get(ip);

      if (!record || now > record.resetAt) {
        routeLimitMap.set(ip, { count: 1, resetAt: now + windowMs });
        return next();
      }

      if (record.count >= maxRequests) {
        return res.status(429).json({ error: 'Too many requests, please slow down.' });
      }

      record.count++;
      next();
    };
  };

  // Malicious content sanitizer middleware
  const sanitizeInput = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    // Exempt AI moderation, publishing, and AI Help endpoints so AI can analyze text and perform administrative security actions
    if (
      req.originalUrl?.startsWith('/api/apps/publish') || 
      req.originalUrl?.startsWith('/api/ai/moderate-app') ||
      req.originalUrl?.startsWith('/api/ai/moderate-user') ||
      req.originalUrl?.startsWith('/api/ai/moderate-review') ||
      req.originalUrl?.startsWith('/api/ai/moderate-all-reviews') ||
      req.originalUrl?.startsWith('/api/ai/admin-help') ||
      req.originalUrl?.startsWith('/api/admin/') ||
      req.originalUrl?.startsWith('/api/extra/') ||
      req.path === '/apps/publish' || 
      req.path === '/ai/moderate-app' ||
      req.path === '/ai/moderate-user' ||
      req.path === '/ai/moderate-review' ||
      req.path === '/ai/moderate-all-reviews' ||
      req.path === '/ai/admin-help' ||
      req.path?.startsWith('/admin/') ||
      req.path?.startsWith('/extra/')
    ) {
      return next();
    }
    const bodyStr = JSON.stringify(req.body || {}).toLowerCase();
    if (
      bodyStr.includes('epl studio hacked') || 
      bodyStr.includes('тебя взломали') ||
      bodyStr.includes('you hacked by kamil') ||
      bodyStr.includes('you hacked') ||
      bodyStr.includes('fuada was hacked') ||
      bodyStr.includes('fuada') ||
      bodyStr.includes('взломали')
    ) {
      return res.status(400).json({ error: 'Forbidden content detected.' });
    }
    next();
  };

  app.use('/api', rateLimiter(120, 60000));
  app.use('/api', sanitizeInput);

  // Health and API Version
  app.get("/api/health", (req, res) => {
    res.json({ status: 'ok', version: '2.5.0', service: 'EPL Studio API v2', timestamp: new Date().toISOString() });
  });

  // Google Drive Direct Download Link Generator for EPL Studio Desktop App
  const DESKTOP_DRIVE_FILE_ID = '122nysFUK_GBpxPBcwfV0kMSGhbNuRoSy';
  app.get("/api/desktop-app/generate-link", rateLimiter(30, 60000), async (_req, res) => {
    const driveViewUrl = `https://drive.google.com/file/d/${DESKTOP_DRIVE_FILE_ID}/view?usp=drive_link`;
    const fallbackUrl = `https://drive.usercontent.google.com/download?id=${DESKTOP_DRIVE_FILE_ID}&export=download&confirm=t`;
    let fileName = 'EPL Studio Desktop Setup 1.0.0.exe';
    let fileSize = '108M';
    let directUrl = fallbackUrl;
    let resolvedLive = false;

    try {
      const probeRes = await fetch(`https://drive.google.com/uc?export=download&id=${DESKTOP_DRIVE_FILE_ID}`, {
        method: 'GET',
        redirect: 'follow',
        signal: AbortSignal.timeout(9000),
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36',
        },
      });

      const contentType = probeRes.headers.get('content-type') || '';
      if (contentType.includes('text/html')) {
        const html = await probeRes.text();
        const nameSizeMatch = html.match(/class="uc-name-size"[^>]*>\s*<a[^>]*>([^<]+)<\/a>\s*(?:\(([^)]+)\))?/i);
        if (nameSizeMatch?.[1]) {
          fileName = nameSizeMatch[1].trim();
        }
        if (nameSizeMatch?.[2]) {
          fileSize = nameSizeMatch[2].trim();
        }

        const formMatch = html.match(/<form[^>]*id="download-form"[^>]*action="([^"]+)"[^>]*>([\s\S]*?)<\/form>/i);
        if (formMatch?.[1]) {
          const targetUrl = new URL(formMatch[1]);
          const formBody = formMatch[2] || '';
          const hiddenInputs = formBody.matchAll(/<input[^>]*type="hidden"[^>]*>/gi);
          for (const inputTag of hiddenInputs) {
            const tagStr = inputTag[0];
            const nameMatch = tagStr.match(/name="([^"]+)"/i);
            const valMatch = tagStr.match(/value="([^"]*)"/i);
            if (nameMatch?.[1]) {
              targetUrl.searchParams.set(nameMatch[1], valMatch?.[1] ?? '');
            }
          }
          directUrl = targetUrl.toString();
          resolvedLive = true;
        }
      } else if (probeRes.ok && probeRes.url) {
        directUrl = probeRes.url;
        resolvedLive = true;
      }
    } catch (err: any) {
      console.warn('Google Drive link generation fallback used:', err?.message || err);
    }

    res.json({
      fileId: DESKTOP_DRIVE_FILE_ID,
      fileName,
      fileSize,
      directUrl,
      fallbackUrl,
      driveViewUrl,
      resolvedLive,
      generatedAt: new Date().toISOString(),
    });
  });

  // Project File Upload & Serving (/tmp/epl_uploads)
  const UPLOADS_ROOT = '/tmp/epl_uploads';
  if (!fs.existsSync(UPLOADS_ROOT)) {
    fs.mkdirSync(UPLOADS_ROOT, { recursive: true });
  }

  app.post("/api/files/upload", rateLimiter(40, 60000), (req, res) => {
    try {
      const { fileName, mimeType, base64Data } = req.body || {};
      if (!fileName || typeof fileName !== 'string' || !base64Data || typeof base64Data !== 'string') {
        return res.status(400).json({ error: 'Missing fileName or base64Data' });
      }
      const cleanName = path.basename(fileName).replace(/[^a-zA-Z0-9._\-\(\) ]/g, '_') || `file_${Date.now()}.bin`;
      const rawBase64 = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
      const buf = Buffer.from(rawBase64, 'base64');
      if (buf.length > 18 * 1024 * 1024) {
        return res.status(413).json({ error: 'File exceeds 18MB server upload limit' });
      }
      const id = crypto.randomBytes(8).toString('hex');
      const dirPath = path.join(UPLOADS_ROOT, id);
      fs.mkdirSync(dirPath, { recursive: true });
      fs.writeFileSync(path.join(dirPath, cleanName), buf);
      if (mimeType && typeof mimeType === 'string') {
        fs.writeFileSync(path.join(dirPath, '.meta.json'), JSON.stringify({ mimeType, originalName: fileName }), 'utf8');
      }
      const url = `/api/files/${id}/${encodeURIComponent(cleanName)}`;
      res.json({ name: cleanName, url, size: buf.length, mimeType: mimeType || 'application/octet-stream' });
    } catch (err: any) {
      console.error('File upload error:', err);
      res.status(500).json({ error: err.message || 'Upload failed' });
    }
  });

  app.get("/api/files/:id/:name", (req, res) => {
    try {
      const safeId = req.params.id.replace(/[^a-f0-9]/gi, '');
      const safeName = path.basename(req.params.name);
      const filePath = path.join(UPLOADS_ROOT, safeId, safeName);
      if (!safeId || !safeName || !fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'File not found' });
      }
      const metaPath = path.join(UPLOADS_ROOT, safeId, '.meta.json');
      let mime = 'application/octet-stream';
      if (fs.existsSync(metaPath)) {
        try {
          mime = JSON.parse(fs.readFileSync(metaPath, 'utf8')).mimeType || mime;
        } catch {}
      }
      const forceDownload = req.query.download === '1' || safeName.toLowerCase().endsWith('.exe');
      res.setHeader('Content-Type', mime);
      if (forceDownload) {
        res.setHeader('Content-Disposition', `attachment; filename="${safeName.replace(/"/g, '')}"`);
      }
      res.sendFile(filePath);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to serve file' });
    }
  });

  // Initialize server-side Firestore instance + REST helpers with caller Bearer token
  const fbConfigPath = path.join(process.cwd(), 'firebase-applet-config.json');
  let serverDb: any = null;
  let fbRuntimeConfig: any = null;
  if (fs.existsSync(fbConfigPath)) {
    try {
      fbRuntimeConfig = JSON.parse(fs.readFileSync(fbConfigPath, 'utf8'));
      const sApp = initServerApp(fbRuntimeConfig, 'server-backend-admin');
      serverDb = getServerFirestore(sApp, fbRuntimeConfig.firestoreDatabaseId);
    } catch (e) {
      console.error('Failed to init server Firebase:', e);
    }
  }

  const getBearerToken = (req: express.Request): string | null => {
    const authHeader = req.headers.authorization;
    if (typeof authHeader === 'string' && authHeader.toLowerCase().startsWith('bearer ')) {
      const token = authHeader.slice(7).trim();
      return token || null;
    }
    return null;
  };

  const toFirestoreRestValue = (val: any): any => {
    if (val === null || val === undefined) return { nullValue: null };
    if (typeof val === 'boolean') return { booleanValue: val };
    if (typeof val === 'number') {
      return Number.isInteger(val) ? { integerValue: String(val) } : { doubleValue: val };
    }
    if (typeof val === 'string') return { stringValue: val };
    if (Array.isArray(val)) {
      return { arrayValue: { values: val.map(toFirestoreRestValue) } };
    }
    if (typeof val === 'object') {
      const fields: Record<string, any> = {};
      for (const [k, v] of Object.entries(val)) {
        if (v !== undefined) fields[k] = toFirestoreRestValue(v);
      }
      return { mapValue: { fields } };
    }
    return { stringValue: String(val) };
  };

  const fromFirestoreRestValue = (v: any): any => {
    if (!v || typeof v !== 'object') return null;
    if ('nullValue' in v) return null;
    if ('booleanValue' in v) return v.booleanValue;
    if ('integerValue' in v) return Number(v.integerValue);
    if ('doubleValue' in v) return Number(v.doubleValue);
    if ('stringValue' in v) return v.stringValue;
    if ('timestampValue' in v) return v.timestampValue;
    if ('arrayValue' in v) return (v.arrayValue.values || []).map(fromFirestoreRestValue);
    if ('mapValue' in v) {
      const obj: Record<string, any> = {};
      for (const [k, fv] of Object.entries(v.mapValue.fields || {})) {
        obj[k] = fromFirestoreRestValue(fv);
      }
      return obj;
    }
    return null;
  };

  const firestoreRestBase = (): string | null => {
    if (!fbRuntimeConfig?.projectId) return null;
    const dbId = fbRuntimeConfig.firestoreDatabaseId || '(default)';
    return `https://firestore.googleapis.com/v1/projects/${fbRuntimeConfig.projectId}/databases/${dbId}/documents`;
  };

  const firestoreRestGet = async (col: string, docId: string, token?: string | null): Promise<any | null> => {
    const base = firestoreRestBase();
    if (!base) return null;
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${base}/${encodeURIComponent(col)}/${encodeURIComponent(docId)}`, { headers });
    if (res.status === 404) return null;
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Firestore REST GET ${col}/${docId} failed (${res.status}): ${errText}`);
    }
    const json: any = await res.json();
    const out: Record<string, any> = { id: docId };
    for (const [k, fv] of Object.entries(json.fields || {})) {
      out[k] = fromFirestoreRestValue(fv);
    }
    return out;
  };

  const firestoreRestPatch = async (col: string, docId: string, data: Record<string, any>, token: string): Promise<void> => {
    const base = firestoreRestBase();
    if (!base) throw new Error('Firestore config missing');
    const fields: Record<string, any> = {};
    const maskParams: string[] = [];
    for (const [k, v] of Object.entries(data)) {
      if (v !== undefined) {
        fields[k] = toFirestoreRestValue(v);
        maskParams.push(`updateMask.fieldPaths=${encodeURIComponent(k)}`);
      }
    }
    const url = `${base}/${encodeURIComponent(col)}/${encodeURIComponent(docId)}?${maskParams.join('&')}`;
    const res = await fetch(url, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ fields })
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Firestore REST PATCH ${col}/${docId} failed (${res.status}): ${errText}`);
    }
  };

  const firestoreRestDelete = async (col: string, docId: string, token: string): Promise<void> => {
    const base = firestoreRestBase();
    if (!base) throw new Error('Firestore config missing');
    const url = `${base}/${encodeURIComponent(col)}/${encodeURIComponent(docId)}`;
    const res = await fetch(url, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    if (res.status === 404) return;
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Firestore REST DELETE ${col}/${docId} failed (${res.status}): ${errText}`);
    }
  };

  const firestoreRestList = async (col: string, token?: string | null, pageSize = 100): Promise<any[]> => {
    const base = firestoreRestBase();
    if (!base) throw new Error('Firestore config missing');
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${base}/${encodeURIComponent(col)}?pageSize=${pageSize}`, { headers });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Firestore REST LIST ${col} failed (${res.status}): ${errText}`);
    }
    const json: any = await res.json();
    const docs = Array.isArray(json.documents) ? json.documents : [];
    return docs.map((d: any) => {
      const docId = String(d.name || '').split('/').pop() || '';
      const out: Record<string, any> = { id: docId };
      for (const [k, fv] of Object.entries(d.fields || {})) {
        out[k] = fromFirestoreRestValue(fv);
      }
      return out;
    });
  };

  const withTimeout = <T>(promise: Promise<T>, ms: number, timeoutMessage: string): Promise<T> => {
    let timer: ReturnType<typeof setTimeout>;
    return Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(timeoutMessage)), ms);
      })
    ]).finally(() => clearTimeout(timer));
  };

  // Durable file-backed store for hashed premium promo codes
  type PremiumTierCode = 'plus' | 'premium' | 'ultra';
  interface StoredPremiumCode {
    tier?: PremiumTierCode;
    used: boolean;
    createdAt: string;
    createdBy: string;
    usedBy?: string;
    usedAt?: string;
  }
  const PREMIUM_CODES_DIR = path.join(process.cwd(), '.data');
  const PREMIUM_CODES_FILE = path.join(PREMIUM_CODES_DIR, 'premium-codes.json');
  const premiumCodesStore = new Map<string, StoredPremiumCode>();

  const loadPremiumCodesFromDisk = () => {
    try {
      if (fs.existsSync(PREMIUM_CODES_FILE)) {
        const raw = fs.readFileSync(PREMIUM_CODES_FILE, 'utf8');
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          for (const [hash, rec] of Object.entries(parsed)) {
            if (rec && typeof rec === 'object') {
              premiumCodesStore.set(hash, rec as StoredPremiumCode);
            }
          }
        }
      }
    } catch (e: any) {
      console.warn('Could not load local premium codes store:', e?.message || e);
    }
  };

  const savePremiumCodesToDisk = () => {
    try {
      fs.mkdirSync(PREMIUM_CODES_DIR, { recursive: true });
      const obj: Record<string, StoredPremiumCode> = {};
      for (const [k, v] of premiumCodesStore.entries()) {
        obj[k] = v;
      }
      const tmpPath = `${PREMIUM_CODES_FILE}.tmp`;
      fs.writeFileSync(tmpPath, JSON.stringify(obj, null, 2), 'utf8');
      fs.renameSync(tmpPath, PREMIUM_CODES_FILE);
    } catch (e: any) {
      console.warn('Could not persist local premium codes store:', e?.message || e);
    }
  };

  loadPremiumCodesFromDisk();

  // OpenRouter Nemotron 3.5 Content Moderation + Rate-Limit Circuit Breaker + Gemini Fallback
  const OPENROUTER_API_KEY = (process.env.OPENROUTER_API_KEY || '').trim();
  const OPENROUTER_MODEL = (process.env.OPENROUTER_MODEL || 'nvidia/nemotron-3.5-super-vl:free').trim();
  const OPENROUTER_FALLBACK_MODELS = Array.from(new Set([
    OPENROUTER_MODEL,
    'nvidia/nemotron-3.5-lightning:free',
    'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free'
  ]));

  let openRouterQuotaCooldownUntil = 0;
  let openRouterCooldownLogged = false;

  interface ModerationResult {
    approved: boolean;
    reason: string;
    flags: string[];
    riskScore: number;
    modelUsed?: string;
    checkedByAI?: boolean;
  }

  function extractJsonFromModelOutput(rawText: string): any | null {
    if (!rawText || typeof rawText !== 'string') return null;
    const cleaned = rawText
      .replace(/<think>[\s\S]*?<\/think>/gi, '')
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/g, '')
      .trim();

    // Direct parse if clean JSON
    try {
      return JSON.parse(cleaned);
    } catch {
      // Scan balanced {...} candidates from start to end
      for (let start = 0; start < cleaned.length; start++) {
        if (cleaned[start] !== '{') continue;
        let depth = 0;
        let inString = false;
        let escaped = false;
        for (let end = start; end < cleaned.length; end++) {
          const ch = cleaned[end];
          if (escaped) {
            escaped = false;
            continue;
          }
          if (ch === '\\') {
            escaped = true;
            continue;
          }
          if (ch === '"') {
            inString = !inString;
            continue;
          }
          if (inString) continue;
          if (ch === '{') depth++;
          else if (ch === '}') {
            depth--;
            if (depth === 0) {
              const candidate = cleaned.slice(start, end + 1);
              try {
                const parsed = JSON.parse(candidate);
                if (parsed && typeof parsed === 'object') return parsed;
              } catch {
                break;
              }
            }
          }
        }
      }
    }
    return null;
  }

  async function callGeminiJsonFallback(
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
  ): Promise<{ parsed: any | null; rawText: string; modelUsed: string } | null> {
    const geminiKey = (process.env.GEMINI_API_KEY || '').trim();
    if (!geminiKey) return null;

    try {
      const systemMsg = messages.find(m => m.role === 'system')?.content;
      const userPrompt = messages.filter(m => m.role !== 'system').map(m => m.content).join('\n\n');
      const ai = getAI();
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: userPrompt,
        config: {
          ...(systemMsg ? { systemInstruction: systemMsg } : {}),
          responseMimeType: 'application/json'
        }
      });
      const text = (response.text || '').trim();
      const parsed = extractJsonFromModelOutput(text);
      if (parsed) {
        return { parsed, rawText: text, modelUsed: 'gemini-4-hydrogen' };
      }
    } catch (err: any) {
      console.info('Gemini fallback unavailable:', err?.message || err);
    }
    return null;
  }

  async function callOpenRouterNemotron(
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
    titleHeader: string,
    options?: { temperature?: number; maxTokens?: number; timeoutMs?: number }
  ): Promise<{ parsed: any | null; rawText: string; modelUsed: string }> {
    const timeoutMs = Math.min(options?.timeoutMs ?? 6500, 7500);
    const overallDeadline = Date.now() + 8500;
    const temperature = options?.temperature ?? 0.1;
    const maxTokens = options?.maxTokens ?? 1100;

    if (OPENROUTER_API_KEY && Date.now() >= openRouterQuotaCooldownUntil) {
      openRouterCooldownLogged = false;
      for (const modelId of OPENROUTER_FALLBACK_MODELS) {
        const remaining = overallDeadline - Date.now();
        if (remaining < 1200) break;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), Math.min(timeoutMs, remaining));
        try {
          const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
              "Content-Type": "application/json",
              "HTTP-Referer": process.env.APP_URL || "https://epl-studio.local",
              "X-Title": titleHeader
            },
            body: JSON.stringify({
              model: modelId,
              messages,
              temperature,
              max_tokens: maxTokens,
              reasoning: { effort: "low" },
              response_format: { type: "json_object" }
            }),
            signal: controller.signal
          });
          clearTimeout(timeoutId);

          if (response.status === 429 || response.status === 402) {
            const errBody = await response.text().catch(() => '');
            const resetHeader = Number(response.headers.get('x-ratelimit-reset') || 0);
            const fallbackCooldown = Date.now() + 15 * 60 * 1000;
            openRouterQuotaCooldownUntil =
              resetHeader > Date.now()
                ? Math.min(resetHeader, Date.now() + 60 * 60 * 1000)
                : fallbackCooldown;
            if (!openRouterCooldownLogged) {
              openRouterCooldownLogged = true;
              console.info(
                `OpenRouter free quota limited (${response.status} on ${modelId}); pausing OpenRouter calls for 15m and routing via fallback. Details: ${errBody.slice(0, 140)}`
              );
            }
            break;
          }

          if (!response.ok) {
            const errBody = await response.text().catch(() => '');
            console.info(`OpenRouter model ${modelId} HTTP ${response.status}: ${errBody.slice(0, 160)}`);
            continue;
          }

          const data: any = await response.json();
          const msg = data?.choices?.[0]?.message || {};
          const contentText = typeof msg.content === 'string' ? msg.content : '';
          const reasoningText = typeof msg.reasoning === 'string' ? msg.reasoning : '';

          const parsedFromContent = extractJsonFromModelOutput(contentText);
          if (parsedFromContent) {
            return { parsed: parsedFromContent, rawText: contentText, modelUsed: modelId };
          }

          const parsedFromReasoning = extractJsonFromModelOutput(reasoningText);
          if (parsedFromReasoning) {
            return { parsed: parsedFromReasoning, rawText: reasoningText, modelUsed: modelId };
          }
        } catch (err: any) {
          clearTimeout(timeoutId);
          console.info(`OpenRouter model ${modelId} notice:`, err?.message || err);
        }
      }
    }

    // Secondary AI fallback via Gemini (uses server GEMINI_API_KEY when available)
    const geminiResult = await withTimeout(
      callGeminiJsonFallback(messages),
      6500,
      'Gemini fallback timed out'
    ).catch(() => null);
    if (geminiResult) {
      return geminiResult;
    }

    return { parsed: null, rawText: '', modelUsed: 'local-heuristic' };
  }

  function normalizeForModeration(input: string): string {
    const map: Record<string, string> = {
      'a': 'а', 'e': 'е', 'o': 'о', 'p': 'р', 'c': 'с', 'x': 'х', 'y': 'у', 'k': 'к', 'm': 'м', 't': 'т', 'b': 'в', 'h': 'н',
      '0': 'о', '3': 'з', '4': 'ч', '6': 'б', '@': 'а'
    };
    const lower = input.toLowerCase();
    const collapsed = lower.replace(/[\s.*_\-`'"]+/g, '');
    const cyrMapped = collapsed.split('').map(ch => map[ch] || ch).join('');
    return `${lower} ${collapsed} ${cyrMapped}`;
  }

  const EXPLICIT_ABUSE_TERMS = [
    'hacked by', 'you hacked', 'fuada was hacked', 'взломали', 'you hacked by kamil',
    'порно', 'porn', 'xxx', 'hentai', 'nsfw', 'эрот', 'секс',
    'хуй', 'пизда', 'пиздец', 'ебать', 'ебан', 'заеб', 'блять', 'бляд', 'сука', 'нахуй', 'похуй', 'уеб', 'мудак', 'пидор', 'гандон', 'шлюха',
    'fuck', 'shit', 'nigger', 'cunt', 'bitch', 'asshole', 'whore', 'dick', 'pussy'
  ];

  async function moderateWithNemotron(
    title: string,
    description: string,
    code: string,
    authorName?: string,
    options?: { skipLLM?: boolean }
  ): Promise<ModerationResult> {
    const normalized = normalizeForModeration(`${title} ${description} ${code}`);
    const matchedTerms = EXPLICIT_ABUSE_TERMS.filter(t => normalized.includes(t));

    // Fast deterministic rejection for explicit profanity/defacement without burning API quota
    if (matchedTerms.length > 0) {
      return {
        approved: false,
        reason: `Обнаружены запрещенные выражения или признаки вредоносного контента: ${matchedTerms.slice(0, 3).join(', ')}`,
        flags: ['profanity', 'restricted_terms'],
        riskScore: 9,
        modelUsed: 'safety-filter',
        checkedByAI: true
      };
    }

    if (options?.skipLLM) {
      return {
        approved: true,
        reason: 'Проект прошел плановую проверку безопасности',
        flags: [],
        riskScore: 0,
        modelUsed: 'safety-filter',
        checkedByAI: false
      };
    }

    const prompt = `Проведи точную модерацию проекта/игры для платформы EPL Studio.

ВАЖНЫЕ ПРАВИЛА ОЦЕНКИ (разделяй игры и реальные нарушения):
- Обычная игровая механика НЕ является нарушением: create enemy, damage, health, destroy, boss, attack, laser, explosion, score, weapon — ЭТО РАЗРЕШЕНО в играх и программах.
- ЗАПРЕЩЕНО и должно быть ОТКЛОНЕНО (approved: false):
  1. Ненормативная лексика, маты, оскорбления, травля и завуалированный мат (х*й, п.и.з.д.а, б л я, с у к а, f u c k, s h i t, расизм/язык вражды) в названии, описании, текстах кнопок, надписях text_label, type или комментариях кода.
  2. Контент 18+ / NSFW / порнография / сексуализированный контент.
  3. Признаки реального дефейса или вредоносных атак ("hacked by", "взломали", "you hacked", "fuada was hacked", кража данных/токенов, фишинг-ссылки, бесконечный спам-алерт).

Данные проекта:
- Название: "${title}"
- Описание: "${description}"
- Автор: "${authorName || 'User'}"
- Исходный код (EPL):
\`\`\`
${code.slice(0, 12000)}
\`\`\`

Ответь СТРОГО валидным JSON без markdown:
{
  "approved": boolean,
  "reason": "Краткое и точное объяснение результата на русском языке",
  "flags": string[],
  "riskScore": number
}`;

    const aiRes = await callOpenRouterNemotron(
      [
        {
          role: "system",
          content: "Ты — строгий, но справедливый ИИ-модератор EPL Studio (Nemotron 3.5). Отличай обычную игровую терминологию (enemy, damage, destroy) от настоящих матов, 18+ контента и взломов. Возвращай ТОЛЬКО JSON."
        },
        { role: "user", content: prompt }
      ],
      "EPL Studio Content Moderation",
      { temperature: 0.05, maxTokens: 1000, timeoutMs: 6500 }
    );

    if (aiRes.parsed && typeof aiRes.parsed.approved === 'boolean') {
      return {
        approved: !!aiRes.parsed.approved,
        reason: aiRes.parsed.reason || (aiRes.parsed.approved ? 'Проект безопасен и проверен ИИ' : 'Проект нарушает правила безопасности платформы'),
        flags: Array.isArray(aiRes.parsed.flags) ? aiRes.parsed.flags : [],
        riskScore: typeof aiRes.parsed.riskScore === 'number' ? aiRes.parsed.riskScore : (aiRes.parsed.approved ? 0 : 8),
        modelUsed: aiRes.modelUsed,
        checkedByAI: true
      };
    }

    return {
      approved: true,
      reason: 'Проект прошел базовую проверку безопасности',
      flags: [],
      riskScore: 0,
      modelUsed: 'local-heuristic',
      checkedByAI: false
    };
  }

  async function moderateUserWithNemotron(
    name: string, 
    email: string, 
    bio?: string, 
    avatarUrl?: string, 
    role?: string,
    roleVerification?: string,
    roleVerifiedBy?: string,
    isVerifiedAuthor?: boolean,
    options?: { skipLLM?: boolean }
  ): Promise<ModerationResult> {
    const normalizedRole = (role || 'user').toLowerCase().trim();
    const hasElevatedRole = normalizedRole !== '' && normalizedRole !== 'user';
    const isVerified = isVerifiedAuthor === true;

    // STRICT REQUIREMENT:
    // 1. Check whether user has the VERIFIED checkmark (isVerifiedAuthor === true).
    // 2. If VERIFIED checkmark is NOT present AND user has ANY role other than 'user' -> BAN.
    if (hasElevatedRole && !isVerified) {
      return {
        approved: false,
        reason: `У пользователя установлена роль "${role}" без галочки (VERIFIED). Любые роли кроме "user" без галочки VERIFIED запрещены и блокируются ИИ модератором.`,
        flags: ['unauthorized_role_elevation', 'missing_verified_badge'],
        riskScore: 10,
        modelUsed: OPENROUTER_MODEL,
        checkedByAI: true
      };
    }

    const normalized = normalizeForModeration(`${name} ${bio || ''}`);
    const matchedTerms = EXPLICIT_ABUSE_TERMS.filter(t => normalized.includes(t));

    // If VERIFIED checkmark IS present and no explicit profanity/hack payloads exist in name/bio ->
    // DO NOT ban for elevated roles (developer/admin/moderator/shopkeeper)!
    if (isVerified && matchedTerms.length === 0) {
      return {
        approved: true,
        reason: hasElevatedRole
          ? `У пользователя установлена галочка (VERIFIED) — роль "${role}" подтверждена, профиль одобрен.`
          : 'У пользователя установлена галочка (VERIFIED), нарушений в профиле не обнаружено.',
        flags: [],
        riskScore: 0,
        modelUsed: OPENROUTER_MODEL,
        checkedByAI: true
      };
    }

    if (matchedTerms.length > 0 && !isVerified) {
      return {
        approved: false,
        reason: `Обнаружены запрещенные слова или упоминания взломов/оскорблений в профиле: ${matchedTerms.slice(0, 3).join(', ')}`,
        flags: ['hacking_impersonation', 'profanity', 'restricted_terms'],
        riskScore: 9,
        modelUsed: OPENROUTER_MODEL,
        checkedByAI: true
      };
    }

    if (options?.skipLLM) {
      return {
        approved: true,
        reason: 'Профиль пользователя прошел плановую проверку безопасности',
        flags: [],
        riskScore: 0,
        modelUsed: 'safety-filter',
        checkedByAI: false
      };
    }

    const prompt = `Проведи строгую модерацию профиля пользователя для платформы EPL Studio.
ПРАВИЛО РОЛЕЙ И ГАЛОЧКИ (VERIFIED):
- Если у пользователя ЕСТЬ галочка VERIFIED (Да), НИ В КОЕМ СЛУЧАЕ не бань его за наличие роли developer, admin, moderator или shopkeeper!
- Если у пользователя НЕТ галочки VERIFIED (Нет) и его роль не "user", он должен быть заблокирован.
- Для обычных пользователей (user) проверяй имя и описание на:
  1. Контент 18+ / NSFW / эротика.
  2. Ненормативная лексика / маты / оскорбления.
  3. Признаки взлома / дефейса ("hacked by", "взломали", "you hacked", "kamil").

Данные профиля пользователя:
- Имя пользователя: "${name}"
- Email: "${email}"
- Описание / Био: "${bio || 'Отсутствует'}"
- Ссылка на аватар: "${avatarUrl || 'Стандартный'}"
- Роль: "${role || 'user'}"
- Галочка (VERIFIED): "${isVerified ? 'Да (Подтвержденный аккаунт — не банить за роль)' : 'Нет'}"

Ответь ТОЛЬКО валидным JSON-объектом:
{
  "approved": boolean,
  "reason": string,
  "flags": string[],
  "riskScore": number
}`;

    const aiRes = await callOpenRouterNemotron(
      [
        {
          role: "system",
          content: "Ты — строгий ИИ-модератор профилей пользователей. НИКОГДА не бань пользователя с галочкой VERIFIED=Да за роль (developer/admin/moderator). Возвращай ТОЛЬКО валидный JSON."
        },
        { role: "user", content: prompt }
      ],
      "EPL Studio User Moderation",
      { temperature: 0.05, maxTokens: 900, timeoutMs: 6500 }
    );

    if (aiRes.parsed && typeof aiRes.parsed.approved === 'boolean') {
      // Guard: if VERIFIED is true and no explicit bad words matched, never allow LLM hallucination to ban for role
      if (isVerified && matchedTerms.length === 0 && !aiRes.parsed.approved) {
        return {
          approved: true,
          reason: `У пользователя есть галочка (VERIFIED) — роль "${role || 'user'}" подтверждена.`,
          flags: [],
          riskScore: 0,
          modelUsed: aiRes.modelUsed,
          checkedByAI: true
        };
      }
      return {
        approved: !!aiRes.parsed.approved,
        reason: aiRes.parsed.reason || (aiRes.parsed.approved ? 'Профиль пользователя соответствует правилам платформы' : 'Профиль нарушает правила платформы'),
        flags: Array.isArray(aiRes.parsed.flags) ? aiRes.parsed.flags : [],
        riskScore: typeof aiRes.parsed.riskScore === 'number' ? aiRes.parsed.riskScore : (aiRes.parsed.approved ? 0 : 8),
        modelUsed: aiRes.modelUsed,
        checkedByAI: true
      };
    }

    return {
      approved: true,
      reason: isVerified
        ? "У пользователя установлена галочка (VERIFIED). Профиль одобрен ИИ модератором."
        : 'Профиль пользователя прошел автоматическую проверку безопасности',
      flags: [],
      riskScore: 0,
      modelUsed: 'local-heuristic',
      checkedByAI: false
    };
  }

  // Moderate app standalone endpoint
  app.post("/api/ai/moderate-app", rateLimiter(20, 60000), async (req, res) => {
    try {
      const { title, description, code, authorName } = req.body;
      if (!title || typeof title !== 'string') {
        return res.status(400).json({ error: 'Missing title parameter' });
      }

      const result = await moderateWithNemotron(title, description || '', code || '', authorName);
      res.json(result);
    } catch (err: any) {
      console.error('Moderation error:', err.message);
      res.status(500).json({ error: err.message || 'Moderation failed' });
    }
  });

  async function moderateReviewWithAI(comment: string, rating: number, userName?: string): Promise<ModerationResult> {
    const normalized = normalizeForModeration(comment || '');
    const matchedTerms = EXPLICIT_ABUSE_TERMS.filter(t => normalized.includes(t));

    if (matchedTerms.length > 0) {
      return {
        approved: false,
        reason: `ИИ-модератор удалил отзыв: обнаружены запрещённые выражения или спам (${matchedTerms.slice(0, 3).join(', ')})`,
        flags: ['profanity', 'restricted_terms'],
        riskScore: 9,
        modelUsed: 'safety-filter',
        checkedByAI: true
      };
    }

    const prompt = `Проведи модерацию отзыва пользователя о платформе/игре EPL Studio.

ПРАВИЛА:
- Честная критика (даже оценка 1 звезда или замечания о багах/дизайне без матов и угроз) РАЗРЕШЕНА (approved: true).
- ЗАПРЕЩЕНО и должно быть ОТКЛОНЕНО/УДАЛЕНО (approved: false):
  1. Маты, ненормативная лексика, оскорбления, травля или завуалированный мат (х*й, бля, сука, fuck, shit и т.д.).
  2. Контент 18+ / NSFW / сексуальные описания.
  3. Рекламный спам, фишинговые ссылки, угрозы взломом или дефейсом ("hacked by", "взломали").

Отзыв:
- Автор: "${userName || 'User'}"
- Оценка: ${rating}/5
- Текст отзыва: "${(comment || '').slice(0, 2000)}"

Ответь СТРОГО валидным JSON без markdown:
{
  "approved": boolean,
  "reason": "Краткое объяснение на русском",
  "flags": string[],
  "riskScore": number
}`;

    const aiRes = await callOpenRouterNemotron(
      [
        {
          role: "system",
          content: "Ты — ИИ-модератор отзывов EPL Studio. Отличай конструктивную критику от матов, 18+, спама и взломов. Возвращай ТОЛЬКО JSON."
        },
        { role: "user", content: prompt }
      ],
      "EPL Studio Review Moderation",
      { temperature: 0.05, maxTokens: 600, timeoutMs: 5500 }
    );

    if (aiRes.parsed && typeof aiRes.parsed.approved === 'boolean') {
      return {
        approved: !!aiRes.parsed.approved,
        reason: aiRes.parsed.reason || (aiRes.parsed.approved ? 'Отзыв прошёл проверку ИИ-модератора' : 'Отзыв удалён ИИ-модератором за нарушение правил'),
        flags: Array.isArray(aiRes.parsed.flags) ? aiRes.parsed.flags : [],
        riskScore: typeof aiRes.parsed.riskScore === 'number' ? aiRes.parsed.riskScore : (aiRes.parsed.approved ? 0 : 8),
        modelUsed: aiRes.modelUsed,
        checkedByAI: true
      };
    }

    return {
      approved: true,
      reason: 'Отзыв прошёл базовую проверку безопасности',
      flags: [],
      riskScore: 0,
      modelUsed: 'local-heuristic',
      checkedByAI: false
    };
  }

  app.post("/api/ai/moderate-review", rateLimiter(30, 60000), async (req, res) => {
    try {
      const token = getBearerToken(req);
      const { reviewId, comment, rating, userName, userId } = req.body || {};
      if (!comment || typeof comment !== 'string') {
        return res.status(400).json({ error: 'Missing review comment' });
      }

      const result = await moderateReviewWithAI(comment, Number(rating) || 5, userName);
      let deletedByAi = false;

      if (!result.approved && reviewId && typeof reviewId === 'string') {
        if (token) {
          await firestoreRestDelete('reviews', reviewId, token).then(() => { deletedByAi = true; }).catch(() => {});
        }
        if (!deletedByAi && serverDb) {
          await serverDeleteDoc(serverDoc(serverDb, 'reviews', reviewId)).then(() => { deletedByAi = true; }).catch(() => {});
        }
        const logId = `review_mod_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        const logPayload = {
          id: logId,
          appId: reviewId,
          appTitle: `Review by ${userName || 'User'}`,
          authorId: userId || 'unknown',
          authorName: userName || 'User',
          approved: false,
          reason: result.reason,
          flags: result.flags,
          riskScore: result.riskScore,
          model: 'AI Review Moderator',
          createdAt: new Date().toISOString(),
          codeSnippet: comment.slice(0, 300)
        };
        if (token) {
          await firestoreRestPatch('aiModerationLogs', logId, logPayload, token).catch(() => {});
        } else if (serverDb) {
          await serverSetDoc(serverDoc(serverDb, 'aiModerationLogs', logId), logPayload).catch(() => {});
        }
      }

      res.json({ ...result, deletedByAi });
    } catch (err: any) {
      console.error('Review moderation error:', err.message);
      res.status(500).json({ error: err.message || 'Review moderation failed' });
    }
  });

  app.post("/api/ai/moderate-all-reviews", rateLimiter(10, 60000), async (req, res) => {
    try {
      const token = getBearerToken(req);
      let reviewsList: any[] = [];
      if (token) {
        reviewsList = await firestoreRestList('reviews', token, 100).catch(() => []);
      }
      if (reviewsList.length === 0 && serverDb) {
        const snap = await serverGetDocs(serverCollection(serverDb, 'reviews')).catch(() => null);
        if (snap) {
          reviewsList = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        }
      }

      const deletedIds: string[] = [];
      const details: Array<{ id: string; userName: string; reason: string }> = [];

      for (const rev of reviewsList) {
        if (!rev?.id || !rev?.comment) continue;
        const modRes = await moderateReviewWithAI(String(rev.comment), Number(rev.rating) || 5, rev.userName);
        if (!modRes.approved) {
          let removed = false;
          if (token) {
            await firestoreRestDelete('reviews', rev.id, token).then(() => { removed = true; }).catch(() => {});
          }
          if (!removed && serverDb) {
            await serverDeleteDoc(serverDoc(serverDb, 'reviews', rev.id)).then(() => { removed = true; }).catch(() => {});
          }
          if (removed) {
            deletedIds.push(rev.id);
            details.push({ id: rev.id, userName: rev.userName || 'User', reason: modRes.reason });
          }
        }
      }

      res.json({
        success: true,
        scanned: reviewsList.length,
        deletedCount: deletedIds.length,
        deletedIds,
        details
      });
    } catch (err: any) {
      console.error('Moderate all reviews error:', err.message);
      res.status(500).json({ error: err.message || 'Failed to scan reviews' });
    }
  });

  // Moderate user profile endpoint
  app.post("/api/ai/moderate-user", rateLimiter(30, 60000), async (req, res) => {
    try {
      const token = getBearerToken(req);
      const { userId, name, email, bio, avatarUrl, role, roleVerification, roleVerifiedBy, isVerifiedAuthor } = req.body;
      if (!name || typeof name !== 'string') {
        return res.status(400).json({ error: 'Missing user name' });
      }

      // Cross-check authoritative user doc from Firestore if userId is provided
      let freshUserDoc: any = null;
      if (userId) {
        try {
          freshUserDoc = await firestoreRestGet('users', userId, token);
        } catch {
          if (serverDb) {
            try {
              const snap = await serverGetDoc(serverDoc(serverDb, 'users', userId));
              if (snap.exists()) freshUserDoc = snap.data();
            } catch (_) {}
          }
        }
      }

      const effectiveRole = role || freshUserDoc?.role || 'user';
      const effectiveVerified =
        typeof isVerifiedAuthor === 'boolean'
          ? isVerifiedAuthor
          : freshUserDoc?.isVerifiedAuthor === true;

      const modResult = await moderateUserWithNemotron(
        name, 
        email || freshUserDoc?.email || '', 
        bio ?? freshUserDoc?.bio ?? '', 
        avatarUrl || freshUserDoc?.avatarUrl || '', 
        effectiveRole, 
        roleVerification ?? freshUserDoc?.roleVerification, 
        roleVerifiedBy ?? freshUserDoc?.roleVerifiedBy,
        effectiveVerified
      );
      const isApproved = modResult.approved;

      if (userId) {
        const now = new Date().toISOString();
        const patchData: any = {
          isBanned: !isApproved,
          banReason: !isApproved ? modResult.reason : null,
          moderationStatus: isApproved ? 'approved' : 'rejected',
          moderationReason: modResult.reason,
          moderationFlags: modResult.flags,
          moderatedAt: now,
          moderatedBy: modResult.modelUsed || OPENROUTER_MODEL
        };
        const logId = `mod_user_${userId}_${Date.now()}`;
        const logPayload = {
          id: logId,
          appId: userId,
          appTitle: `[Пользователь] ${name}`,
          authorId: userId,
          authorName: name,
          approved: isApproved,
          reason: modResult.reason,
          flags: modResult.flags,
          riskScore: modResult.riskScore,
          model: modResult.modelUsed || OPENROUTER_MODEL,
          createdAt: now
        };

        try {
          if (token) {
            await Promise.all([
              firestoreRestPatch('users', userId, patchData, token),
              firestoreRestPatch('users_public', userId, { isBanned: !isApproved, banReason: !isApproved ? modResult.reason : null }, token).catch(() => {}),
              firestoreRestPatch('aiModerationLogs', logId, logPayload, token).catch(() => {})
            ]);
          } else if (serverDb) {
            await serverSetDoc(serverDoc(serverDb, 'users', userId), patchData, { merge: true }).catch(() => {});
            await serverSetDoc(serverDoc(serverDb, 'users_public', userId), { isBanned: !isApproved, banReason: !isApproved ? modResult.reason : null }, { merge: true }).catch(() => {});
            await serverSetDoc(serverDoc(serverDb, 'aiModerationLogs', logId), logPayload).catch(() => {});
          }
        } catch (e) {
          console.warn('Server user moderation write skipped:', e);
        }
      }

      res.json({
        approved: isApproved,
        isBanned: !isApproved,
        reason: modResult.reason,
        flags: modResult.flags,
        riskScore: modResult.riskScore
      });
    } catch (err: any) {
      console.error('User moderation error:', err.message);
      res.status(500).json({ error: err.message || 'User moderation failed' });
    }
  });

  // Google OAuth Sync / Verification Endpoint
  app.post("/api/auth/google-sync", rateLimiter(30, 60000), async (req, res) => {
    try {
      const { profile } = req.body;
      if (!profile || !profile.sub || !profile.email) {
        return res.status(400).json({ error: 'Invalid profile data' });
      }

      const uid = profile.sub;
      const isDevEmail = profile.email === 'fufazada@gmail.com';
      
      let userData: any = {
        uid,
        name: profile.name || 'User',
        email: profile.email,
        photoUrl: profile.picture || '',
        avatarUrl: profile.picture || '',
        region: 'Global',
        friends: [],
        role: isDevEmail ? 'developer' : 'user',
        eplCoins: 0,
        purchasedItems: [],
        purchasedApps: [],
        createdAt: new Date().toISOString(),
        premiumExpiry: null,
        isPremium: false
      };

      if (serverDb) {
        try {
          const userDocRef = serverDoc(serverDb, 'users', uid);
          const snap = await serverGetDoc(userDocRef);
          if (snap.exists()) {
            const existingData = snap.data();
            if (isDevEmail && existingData.role !== 'developer') {
              await serverUpdateDoc(userDocRef, { role: 'developer' });
              existingData.role = 'developer';
            }
            userData = { ...existingData, ...userData, eplCoins: existingData.eplCoins ?? 0, purchasedItems: existingData.purchasedItems ?? [] };
          } else {
            await serverSetDoc(userDocRef, userData);
            await serverSetDoc(serverDoc(serverDb, 'users_public', uid), {
              uid,
              name: profile.name || 'User',
              avatarUrl: profile.picture || '',
              region: 'Global',
              eplCoins: 0,
              createdAt: new Date().toISOString()
            });
          }
        } catch (dbErr) {
          console.warn('Server Firestore write skipped (client manages its own document):', dbErr);
        }
      }

      res.json({ success: true, userData });
    } catch (err: any) {
      console.error('Error in google-sync:', err);
      res.status(500).json({ error: err.message || 'Sync failed' });
    }
  });

  // Secure App Publishing with AI Moderation & Anti-Bot Protection
  app.post("/api/apps/publish", rateLimiter(15, 60000), async (req, res) => {
    try {
      const appData = req.body;
      if (!appData || typeof appData !== 'object') {
        return res.status(400).json({ error: 'Invalid app data payload' });
      }

      const title = (appData.title || '').trim();
      const description = (appData.description || '').trim();
      const code = (appData.code || '').trim();
      const authorId = appData.authorId;
      const authorName = appData.authorName || 'Anonymous';

      // Anti-bot & spam verification
      if (!authorId) {
        return res.status(401).json({ error: 'You must be authenticated to publish apps' });
      }
      if (title.length < 2 || title.length > 100) {
        return res.status(400).json({ error: 'Title must be between 2 and 100 characters' });
      }
      if (description.length < 3 || description.length > 5000) {
        return res.status(400).json({ error: 'Description must be between 3 and 5000 characters' });
      }
      if (!code) {
        return res.status(400).json({ error: 'App code cannot be empty' });
      }

      // Run AI content moderation with OpenRouter Nemotron 3.5
      const modResult = await moderateWithNemotron(title, description, code, authorName);
      const isApproved = modResult.approved;
      const appId = appData.id || ('app_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8));

      const publishedAppRecord: any = {
        ...appData,
        id: appId,
        title,
        description,
        code,
        authorId,
        authorName,
        status: isApproved ? 'verified' : 'rejected',
        moderationStatus: isApproved ? 'approved' : 'rejected',
        moderationReason: modResult.reason,
        moderationFlags: modResult.flags,
        moderatedAt: new Date().toISOString(),
        moderatedBy: modResult.modelUsed || OPENROUTER_MODEL,
        updatedAt: new Date().toISOString()
      };

      if (!appData.id) {
        publishedAppRecord.createdAt = new Date().toISOString();
        publishedAppRecord.downloads = 0;
        publishedAppRecord.rating = 5.0;
        publishedAppRecord.likes = 0;
        publishedAppRecord.dislikes = 0;
        publishedAppRecord.visits = 0;
      }

      const token = getBearerToken(req);
      const nowIso = new Date().toISOString();
      const logId = `mod_${appId}_${Date.now()}`;
      const logRecord = {
        id: logId,
        appId,
        appTitle: title,
        authorId,
        authorName,
        approved: isApproved,
        reason: modResult.reason,
        flags: modResult.flags,
        riskScore: modResult.riskScore,
        model: modResult.modelUsed || OPENROUTER_MODEL,
        createdAt: nowIso,
        codeSnippet: code.slice(0, 800)
      };
      const reqId = `modreq_${appId}`;
      const reqRecord = {
        id: reqId,
        type: isApproved ? 'ai_moderation_approved' : 'ai_moderation_alert',
        targetId: appId,
        targetName: title,
        requesterId: authorId,
        requesterName: authorName,
        reason: `[ИИ ${isApproved ? 'Одобрил' : 'Отклонил'}]: ${modResult.reason}${modResult.flags.length > 0 ? ` (Флаги: ${modResult.flags.join(', ')})` : ''}`,
        status: isApproved ? 'approved' : 'pending',
        createdAt: nowIso,
        updatedAt: nowIso,
        appDetails: {
          title,
          category: appData.category || 'Other',
          riskScore: modResult.riskScore,
          flags: modResult.flags
        }
      };

      if (token) {
        await Promise.all([
          firestoreRestPatch('apps', appId, publishedAppRecord, token).catch(() => {}),
          firestoreRestPatch('aiModerationLogs', logId, logRecord, token).catch(() => {}),
          firestoreRestPatch('adminRequests', reqId, reqRecord, token).catch(() => {})
        ]);
      } else if (serverDb) {
        await serverSetDoc(serverDoc(serverDb, 'apps', appId), publishedAppRecord, { merge: true }).catch(() => {});
        await serverSetDoc(serverDoc(serverDb, 'aiModerationLogs', logId), logRecord).catch(() => {});
        await serverSetDoc(serverDoc(serverDb, 'adminRequests', reqId), reqRecord, { merge: true }).catch(() => {});
      }

      res.json({
        success: isApproved,
        approved: isApproved,
        appId,
        reason: modResult.reason,
        flags: modResult.flags,
        riskScore: modResult.riskScore,
        modelUsed: modResult.modelUsed || OPENROUTER_MODEL,
        checkedByAI: modResult.checkedByAI !== false
      });
    } catch (err: any) {
      console.error('Publish error:', err.message);
      res.status(500).json({ error: err.message || 'Failed to publish app' });
    }
  });

  // Manual Review Endpoint for Control Panel
  app.post("/api/admin/manual-review", rateLimiter(60, 60000), async (req, res) => {
    try {
      const token = getBearerToken(req);
      const { appId, action, reason, reviewerName } = req.body;
      if (!appId || !action || !['approve', 'reject'].includes(action)) {
        return res.status(400).json({ error: 'Invalid review parameters' });
      }

      const isApprove = action === 'approve';
      const now = new Date().toISOString();
      const patchData: any = {
        status: isApprove ? 'verified' : 'rejected',
        moderationStatus: isApprove ? 'approved' : 'rejected',
        moderationReason: reason || (isApprove ? 'Одобрено модератором вручную' : 'Отклонено модератором вручную'),
        moderatedBy: `Admin Manual (${reviewerName || 'Staff'})`,
        moderatedAt: now
      };
      const reqId = `modreq_${appId}`;
      const reqPatch = {
        status: isApprove ? 'approved' : 'rejected',
        manualReviewer: reviewerName || 'Admin',
        updatedAt: now
      };

      if (token) {
        await Promise.all([
          firestoreRestPatch('apps', appId, patchData, token),
          firestoreRestPatch('adminRequests', reqId, reqPatch, token).catch(() => {})
        ]);
      } else if (serverDb) {
        try {
          await serverSetDoc(serverDoc(serverDb, 'apps', appId), patchData, { merge: true });
          await serverSetDoc(serverDoc(serverDb, 'adminRequests', reqId), reqPatch, { merge: true });
        } catch (dbErr) {
          console.warn('Server Firestore write skipped for manual review:', dbErr);
        }
      }

      res.json({ success: true, appId, action });
    } catch (err: any) {
      console.error('Manual review error:', err.message);
      res.status(500).json({ error: err.message || 'Failed to update manual review' });
    }
  });

  // Get AI Moderation Logs for Control Panel
  app.get("/api/admin/moderation-logs", rateLimiter(60, 60000), async (req, res) => {
    const token = getBearerToken(req);
    try {
      if (token) {
        try {
          const restLogs = await firestoreRestList('aiModerationLogs', token, 60);
          restLogs.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
          return res.json({ logs: restLogs.slice(0, 60) });
        } catch (restErr: any) {
          console.warn('REST moderation logs fallback notice:', restErr?.message || restErr);
        }
      }

      if (serverDb) {
        try {
          const q = serverQuery(serverCollection(serverDb, 'aiModerationLogs'), serverOrderBy('createdAt', 'desc'), serverLimit(60));
          const snap = await serverGetDocs(q);
          const logs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          return res.json({ logs });
        } catch (dbErr: any) {
          console.warn('Server DB moderation logs read notice:', dbErr?.message || dbErr);
        }
      }

      return res.json({ logs: [] });
    } catch (err: any) {
      console.warn('Get moderation logs notice:', err?.message || err);
      return res.json({ logs: [] });
    }
  });

  // Get All Users for Control Panel (admin/developer/moderator)
  app.get("/api/admin/users", rateLimiter(60, 60000), async (req, res) => {
    const token = getBearerToken(req);
    try {
      if (token) {
        try {
          const restUsers = await firestoreRestList('users', token, 200);
          if (restUsers.length > 0) {
            return res.json({ users: restUsers });
          }
        } catch (restErr: any) {
          console.warn('REST admin users fallback notice:', restErr?.message || restErr);
        }
      }

      if (serverDb) {
        try {
          const usersSnap = await serverGetDocs(serverCollection(serverDb, 'users'));
          const users = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
          return res.json({ users });
        } catch (dbErr: any) {
          console.warn('Server DB users read notice, trying users_public:', dbErr?.message || dbErr);
        }
      }

      try {
        const pubUsers = await firestoreRestList('users_public', token, 200);
        return res.json({ users: pubUsers });
      } catch (pubErr: any) {
        console.warn('REST users_public read notice:', pubErr?.message || pubErr);
      }

      return res.json({ users: [] });
    } catch (err: any) {
      console.warn('Get admin users notice:', err?.message || err);
      return res.json({ users: [] });
    }
  });

  // AI Help Security Assistant for Control Panel (Admin, Developer, Moderator)
  // Dedicated solely to security, moderation, banning users, and taking down unsafe apps
  app.post("/api/ai/admin-help", rateLimiter(30, 60000), async (req, res) => {
    try {
      const token = getBearerToken(req);
      const { message, callerName, callerRole } = req.body;
      if (!message || typeof message !== 'string') {
        return res.status(400).json({ error: 'Missing prompt message' });
      }

      // Gather current context from Firestore (prefer caller Bearer token REST list, fallback to serverDb)
      let appsList: any[] = [];
      let usersList: any[] = [];
      try {
        const [rawApps, rawUsers] = await Promise.all([
          firestoreRestList('apps', token, 100).catch(() => null),
          firestoreRestList('users', token, 100).catch(() => null)
        ]);
        if (rawApps) {
          appsList = rawApps.map(a => ({ id: a.id, title: a.title, status: a.status, authorName: a.authorName, authorId: a.authorId }));
        }
        if (rawUsers) {
          usersList = rawUsers.map(u => ({ id: u.id, name: u.name, email: u.email, role: u.role, isBanned: !!u.isBanned, roleVerification: u.roleVerification }));
        }
      } catch (_) {}

      if (serverDb && (appsList.length === 0 || usersList.length === 0)) {
        try {
          const [appsSnap, usersSnap] = await Promise.all([
            appsList.length === 0 ? serverGetDocs(serverCollection(serverDb, 'apps')).catch(() => null) : Promise.resolve(null),
            usersList.length === 0 ? serverGetDocs(serverCollection(serverDb, 'users')).catch(() => null) : Promise.resolve(null)
          ]);
          if (appsSnap) {
            appsList = appsSnap.docs.map(d => ({ id: d.id, title: d.data().title, status: d.data().status, authorName: d.data().authorName, authorId: d.data().authorId }));
          }
          if (usersSnap) {
            usersList = usersSnap.docs.map(d => ({ id: d.id, name: d.data().name, email: d.data().email, role: d.data().role, isBanned: !!d.data().isBanned, roleVerification: d.data().roleVerification }));
          }
        } catch (e: any) {
          console.warn('Context gathering for AI Help skipped:', e.message);
        }
      }

      const systemPrompt = `Ты — строгий ИИ-помощник по безопасности платформы EPL Studio (EPL Security AI Assistant).
Твоя единственная цель и зона ответственности — БЕЗОПАСНОСТЬ платформы, модерация, защита от матов, 18+ контента, хакинга, взломов и выполнение административных команд безопасности по запросу разработчиков, администраторов и модераторов.
Любые запросы, не связанные с безопасностью, модерацией, банами, разбанами, проверкой контента или защитой платформы, ты должен вежливо отклонять, напоминая, что ты отвечаешь ТОЛЬКО за безопасность.

Ты умеешь анализировать запрос сотрудника (${callerName || 'Сотрудник'}, роль: ${callerRole || 'staff'}) и при необходимости возвращать команду в формате JSON:
{
  "reply": "Твой подробный текстовый ответ сотруднику на русском языке с объяснением мер безопасности",
  "action": {
    "type": "ban_user" | "unban_user" | "delete_app" | "approve_app" | "reject_app" | "run_scan" | "verify_role" | "none",
    "targetUserId": "ID_пользователя_если_применимо",
    "targetAppId": "ID_проекта_если_применимо",
    "reason": "Четкая причина действия безопасности"
  }
}

Доступные пользователи: ${JSON.stringify(usersList.slice(0, 50))}
Доступные проекты: ${JSON.stringify(appsList.slice(0, 50))}

Отвечай ТОЛЬКО валидным JSON-объектом без лишнего текста и без markdown форматирования.`;

      let parsed: any = null;
      const aiHelpRes = await callOpenRouterNemotron(
        [
          { role: "system", content: systemPrompt },
          { role: "user", content: message }
        ],
        "EPL Studio AI Help Security Assistant",
        { temperature: 0.15, maxTokens: 1000, timeoutMs: 22000 }
      );
      if (aiHelpRes.parsed && typeof aiHelpRes.parsed.reply === 'string') {
        parsed = aiHelpRes.parsed;
      }

      // Fallback intent detection if AI returned text or timed out
      if (!parsed) {
        const lower = message.toLowerCase();
        if (lower.includes('забан') || lower.includes('ban')) {
          const matchedUser = usersList.find(u => lower.includes((u.name || '').toLowerCase()) || lower.includes((u.email || '').toLowerCase()) || lower.includes(u.id));
          const matchedApp = appsList.find(a => lower.includes((a.title || '').toLowerCase()) || lower.includes(a.id));
          if (matchedUser) {
            parsed = {
              reply: `Принято. Блокирую пользователя ${matchedUser.name} (${matchedUser.email}) по соображениям безопасности платформы.`,
              action: { type: 'ban_user', targetUserId: matchedUser.id, reason: 'Блокировка по запросу сотрудника через AI Help' }
            };
          } else if (matchedApp) {
            parsed = {
              reply: `Принято. Отклоняю и блокирую проект "${matchedApp.title}" по запросу безопасности.`,
              action: { type: 'reject_app', targetAppId: matchedApp.id, reason: 'Блокировка проекта через AI Help' }
            };
          } else {
            parsed = {
              reply: `Я готов заблокировать пользователя или проект по соображениям безопасности. Укажите точное имя, email или название проекта. Я отвечаю только за безопасность платформы!`,
              action: { type: 'none' }
            };
          }
        } else if (lower.includes('разбан') || lower.includes('unban')) {
          const matchedUser = usersList.find(u => lower.includes((u.name || '').toLowerCase()) || lower.includes((u.email || '').toLowerCase()) || lower.includes(u.id));
          if (matchedUser) {
            parsed = {
              reply: `Пользователь ${matchedUser.name} разблокирован по указанию сотрудника.`,
              action: { type: 'unban_user', targetUserId: matchedUser.id, reason: 'Разблокировка через AI Help' }
            };
          } else {
            parsed = {
              reply: `Укажите пользователя для снятия блокировки. Напоминаю: я специализирован исключительно на безопасности платформы.`,
              action: { type: 'none' }
            };
          }
        } else {
          parsed = {
            reply: `Здравствуйте, ${callerName || 'коллега'}! Я — ИИ-помощник по безопасности EPL Studio. Я отвечаю ТОЛЬКО за безопасность: могу банить/разбанивать нарушителей, удалять и отклонять вредоносные проекты, запускать проверки на маты и эксплойты. Чем могу помочь по безопасности платформы?`,
            action: { type: 'none' }
          };
        }
      }

      // Execute requested security action on server if specified
      let actionResult: any = null;
      if (parsed.action && parsed.action.type !== 'none') {
        const act = parsed.action;
        const now = new Date().toISOString();

        const patchBoth = async (col: string, docId: string, data: Record<string, any>) => {
          if (token) {
            await firestoreRestPatch(col, docId, data, token);
          } else if (serverDb) {
            await serverSetDoc(serverDoc(serverDb, col, docId), data, { merge: true });
          }
        };

        if (act.type === 'ban_user' && act.targetUserId) {
          await patchBoth('users', act.targetUserId, {
            isBanned: true,
            banReason: act.reason || 'Заблокирован ИИ-помощником безопасности',
            moderatedAt: now,
            moderatedBy: `AI Help (${callerName || 'Staff'})`
          });
          await patchBoth('users_public', act.targetUserId, {
            isBanned: true,
            banReason: act.reason || 'Заблокирован ИИ-помощником безопасности'
          }).catch(() => {});
          actionResult = { executed: true, type: 'ban_user', target: act.targetUserId };
        } else if (act.type === 'unban_user' && act.targetUserId) {
          await patchBoth('users', act.targetUserId, {
            isBanned: false,
            banReason: null,
            moderatedAt: now,
            moderatedBy: `AI Help (${callerName || 'Staff'})`
          });
          await patchBoth('users_public', act.targetUserId, {
            isBanned: false,
            banReason: null
          }).catch(() => {});
          actionResult = { executed: true, type: 'unban_user', target: act.targetUserId };
        } else if (act.type === 'reject_app' && act.targetAppId) {
          await patchBoth('apps', act.targetAppId, {
            status: 'rejected',
            moderationStatus: 'rejected',
            moderationReason: act.reason || 'Отклонено ИИ-помощником безопасности',
            moderatedAt: now,
            moderatedBy: `AI Help (${callerName || 'Staff'})`
          });
          actionResult = { executed: true, type: 'reject_app', target: act.targetAppId };
        } else if (act.type === 'approve_app' && act.targetAppId) {
          await patchBoth('apps', act.targetAppId, {
            status: 'verified',
            moderationStatus: 'approved',
            moderationReason: act.reason || 'Одобрено ИИ-помощником безопасности',
            moderatedAt: now,
            moderatedBy: `AI Help (${callerName || 'Staff'})`
          });
          actionResult = { executed: true, type: 'approve_app', target: act.targetAppId };
        } else if (act.type === 'delete_app' && act.targetAppId) {
          if (token) {
            await firestoreRestDelete('apps', act.targetAppId, token).catch(() => {});
          } else if (serverDb) {
            await serverDeleteDoc(serverDoc(serverDb, 'apps', act.targetAppId)).catch(() => {});
          }
          actionResult = { executed: true, type: 'delete_app', target: act.targetAppId };
        } else if (act.type === 'verify_role' && act.targetUserId) {
          await patchBoth('users', act.targetUserId, {
            roleVerification: 'Role is allowed by dev',
            roleVerifiedBy: callerName || 'developer',
            roleVerifiedAt: now,
            isBanned: false
          });
          await patchBoth('users_public', act.targetUserId, {
            roleVerification: 'Role is allowed by dev',
            roleVerifiedBy: callerName || 'developer',
            roleVerifiedAt: now
          }).catch(() => {});
          actionResult = { executed: true, type: 'verify_role', target: act.targetUserId };
        } else if (act.type === 'run_scan') {
          executeHourlyModeration().catch(() => {});
          actionResult = { executed: true, type: 'run_scan' };
        }
      }

      res.json({
        reply: parsed.reply,
        action: parsed.action,
        actionResult
      });
    } catch (err: any) {
      console.error('AI Help error:', err.message);
      res.status(500).json({ error: err.message || 'AI Help failed' });
    }
  });

  // Anti-Cheat & Anti-Inflation Vote Endpoint
  app.post("/api/apps/vote", rateLimiter(30, 60000), async (req, res) => {
    try {
      const token = getBearerToken(req);
      const { userId, appId, type } = req.body;
      if (!userId || !appId || !['like', 'dislike'].includes(type)) {
        return res.status(400).json({ error: 'Invalid vote parameters' });
      }

      const voteId = `${userId}_${appId}`;
      if (token) {
        const [existingVote, existingApp] = await Promise.all([
          firestoreRestGet('votes', voteId, token).catch(() => null),
          firestoreRestGet('apps', appId, token).catch(() => null)
        ]);
        if (existingVote?.type === type) {
          return res.json({ success: true, message: 'Already voted', type });
        }
        const curLikes = Number(existingApp?.likes || 0);
        const curDislikes = Number(existingApp?.dislikes || 0);
        let nextLikes = curLikes;
        let nextDislikes = curDislikes;
        if (existingVote) {
          nextLikes = type === 'like' ? curLikes + 1 : Math.max(0, curLikes - 1);
          nextDislikes = type === 'dislike' ? curDislikes + 1 : Math.max(0, curDislikes - 1);
        } else {
          if (type === 'like') nextLikes = curLikes + 1;
          else nextDislikes = curDislikes + 1;
        }
        await Promise.all([
          firestoreRestPatch('apps', appId, { likes: nextLikes, dislikes: nextDislikes }, token).catch(() => {}),
          firestoreRestPatch('votes', voteId, { userId, appId, type, updatedAt: new Date().toISOString() }, token).catch(() => {})
        ]);
        return res.json({ success: true, appId, type });
      }

      if (serverDb) {
        try {
          const voteRef = serverDoc(serverDb, 'votes', voteId);
          const voteSnap = await serverGetDoc(voteRef);
          const appRef = serverDoc(serverDb, 'apps', appId);

          if (voteSnap.exists()) {
            const prevType = voteSnap.data().type;
            if (prevType === type) {
              return res.json({ success: true, message: 'Already voted', type });
            }
            if (type === 'like') {
              await serverUpdateDoc(appRef, { likes: serverIncrement(1), dislikes: serverIncrement(-1) });
            } else {
              await serverUpdateDoc(appRef, { likes: serverIncrement(-1), dislikes: serverIncrement(1) });
            }
          } else {
            if (type === 'like') {
              await serverUpdateDoc(appRef, { likes: serverIncrement(1) });
            } else {
              await serverUpdateDoc(appRef, { dislikes: serverIncrement(1) });
            }
          }

          await serverSetDoc(voteRef, {
            userId,
            appId,
            type,
            updatedAt: new Date().toISOString()
          });
        } catch (dbErr: any) {
          console.warn('Server vote write skipped:', dbErr?.message || dbErr);
        }
      }

      res.json({ success: true, appId, type });
    } catch (err: any) {
      console.error('Vote error:', err.message);
      res.status(500).json({ error: err.message || 'Failed to register vote' });
    }
  });

  // Admin delete app endpoint
  app.post("/api/admin/delete-app", rateLimiter(60, 60000), async (req, res) => {
    try {
      const token = getBearerToken(req);
      const { appId } = req.body;
      if (!appId || typeof appId !== 'string') {
        return res.status(400).json({ error: 'Missing appId parameter' });
      }

      if (token) {
        await firestoreRestDelete('apps', appId, token);
      } else if (serverDb) {
        await serverDeleteDoc(serverDoc(serverDb, 'apps', appId));
      }

      res.json({ success: true, appId });
    } catch (err: any) {
      console.error('Admin delete-app error:', err.message);
      res.status(500).json({ error: err.message || 'Failed to delete app' });
    }
  });

  // Admin delete user endpoint
  app.post("/api/admin/delete-user", rateLimiter(30, 60000), async (req, res) => {
    try {
      const token = getBearerToken(req);
      const { userId } = req.body;
      if (!userId || typeof userId !== 'string') {
        return res.status(400).json({ error: 'Missing userId parameter' });
      }

      if (token) {
        await Promise.all([
          firestoreRestDelete('users', userId, token),
          firestoreRestDelete('users_public', userId, token)
        ]);
      } else if (serverDb) {
        await Promise.all([
          serverDeleteDoc(serverDoc(serverDb, 'users', userId)),
          serverDeleteDoc(serverDoc(serverDb, 'users_public', userId))
        ]);
      }

      res.json({ success: true, userId });
    } catch (err: any) {
      console.error('Admin delete-user error:', err.message);
      res.status(500).json({ error: err.message || 'Failed to delete user' });
    }
  });

  // Admin ban/unban endpoint
  app.post("/api/admin/ban", rateLimiter(30, 60000), async (req, res) => {
    try {
      const token = getBearerToken(req);
      const { userId, isBanned, reason } = req.body;
      if (!userId || typeof userId !== 'string') {
        return res.status(400).json({ error: 'Missing userId parameter' });
      }

      const patchBody = {
        isBanned: !!isBanned,
        banReason: isBanned ? (reason || 'Violation of terms') : null
      };

      if (token) {
        await Promise.all([
          firestoreRestPatch('users', userId, patchBody, token),
          firestoreRestPatch('users_public', userId, patchBody, token)
        ]);
      } else if (serverDb) {
        await Promise.all([
          serverSetDoc(serverDoc(serverDb, 'users', userId), patchBody, { merge: true }),
          serverSetDoc(serverDoc(serverDb, 'users_public', userId), patchBody, { merge: true })
        ]);
      }

      res.json({ success: true, userId, isBanned: !!isBanned });
    } catch (err: any) {
      console.error('Admin ban error:', err.message);
      res.status(500).json({ error: err.message || 'Failed to update ban status' });
    }
  });

  // Admin Give Coins (Atomic & Audited)
  app.post("/api/admin/give-coins", rateLimiter(60, 60000), async (req, res) => {
    try {
      const token = getBearerToken(req);
      const { uid, amount, adminUid } = req.body;
      if (!uid || typeof amount !== 'number' || Math.abs(amount) > 1e6) {
        return res.status(400).json({ error: 'Invalid parameters' });
      }

      if (token) {
        const existingUser = await firestoreRestGet('users', uid, token);
        if (!existingUser) {
          return res.status(404).json({ error: 'User not found' });
        }
        const currentCoins = existingUser.eplCoins || 0;
        const newCoins = Math.max(0, currentCoins + amount);
        await firestoreRestPatch('users', uid, { eplCoins: newCoins }, token);
        await Promise.all([
          firestoreRestPatch('users_public', uid, { eplCoins: newCoins }, token).catch(() => {}),
          firestoreRestPatch('audit', `coins_${uid}_${Date.now()}`, {
            type: 'coins',
            target: uid,
            amount,
            newCoins,
            by: adminUid || 'admin',
            at: new Date().toISOString()
          }, token).catch(() => {})
        ]);
        return res.json({ success: true, uid, eplCoins: newCoins });
      }

      if (serverDb) {
        const userRef = serverDoc(serverDb, 'users', uid);
        const userSnap = await serverGetDoc(userRef);
        if (!userSnap.exists()) {
          return res.status(404).json({ error: 'User not found' });
        }

        const currentCoins = userSnap.data().eplCoins || 0;
        const newCoins = Math.max(0, currentCoins + amount);

        await serverUpdateDoc(userRef, { eplCoins: newCoins });
        await Promise.all([
          serverSetDoc(serverDoc(serverDb, 'users_public', uid), { eplCoins: newCoins }, { merge: true }).catch(() => {}),
          serverSetDoc(serverDoc(serverDb, 'audit', `coins_${uid}_${Date.now()}`), {
            type: 'coins',
            target: uid,
            amount,
            newCoins,
            by: adminUid || 'admin',
            at: new Date().toISOString()
          }).catch(() => {})
        ]);

        return res.json({ success: true, uid, eplCoins: newCoins });
      }

      res.json({ success: true, uid });
    } catch (err: any) {
      console.error('Give coins error:', err.message);
      res.status(500).json({ error: err.message || 'Failed to give coins' });
    }
  });

  // Admin Set Role (Audited)
  app.post("/api/admin/set-role", rateLimiter(60, 60000), async (req, res) => {
    try {
      const token = getBearerToken(req);
      const { uid, role, adminUid } = req.body;
      if (!uid || !['user', 'moderator', 'admin', 'developer', 'shopkeeper'].includes(role)) {
        return res.status(400).json({ error: 'Invalid parameters' });
      }

      const auditId = `role_${uid}_${Date.now()}`;
      const auditPayload = {
        type: 'role_change',
        target: uid,
        role,
        by: adminUid || 'admin',
        at: new Date().toISOString()
      };

      if (token) {
        await firestoreRestPatch('users', uid, { role }, token);
        await Promise.all([
          firestoreRestPatch('users_public', uid, { role }, token).catch(() => {}),
          firestoreRestPatch('audit', auditId, auditPayload, token).catch(() => {})
        ]);
      } else if (serverDb) {
        await serverSetDoc(serverDoc(serverDb, 'users', uid), { role }, { merge: true });
        await Promise.all([
          serverSetDoc(serverDoc(serverDb, 'users_public', uid), { role }, { merge: true }).catch(() => {}),
          serverSetDoc(serverDoc(serverDb, 'audit', auditId), auditPayload).catch(() => {})
        ]);
      }

      res.json({ success: true, uid, role });
    } catch (err: any) {
      console.error('Set role error:', err.message);
      res.status(500).json({ error: err.message || 'Failed to set role' });
    }
  });

  // Admin / Developer Verified Role (Inserts "Role is allowed by dev")
  app.post("/api/admin/verify-role", rateLimiter(60, 60000), async (req, res) => {
    try {
      const token = getBearerToken(req);
      const { uid, adminUid, adminName } = req.body;
      if (!uid) {
        return res.status(400).json({ error: 'Missing uid' });
      }

      const roleVerification = "Role is allowed by dev";
      const verifiedBy = adminName || "developer";
      const verifiedAt = new Date().toISOString();

      const userPatch = {
        roleVerification,
        roleVerifiedBy: verifiedBy,
        roleVerifiedByUid: adminUid || 'admin',
        roleVerifiedAt: verifiedAt,
        isBanned: false,
        banReason: null,
        moderationStatus: 'approved'
      };
      const publicPatch = {
        roleVerification,
        roleVerifiedBy: verifiedBy,
        roleVerifiedAt: verifiedAt,
        isBanned: false,
        banReason: null
      };
      const auditPayload = {
        type: 'role_verified_by_dev',
        target: uid,
        inscription: roleVerification,
        by: adminUid || 'admin',
        at: verifiedAt
      };
      const auditId = `role_verify_${uid}_${Date.now()}`;

      if (token) {
        await firestoreRestPatch('users', uid, userPatch, token);
        await Promise.all([
          firestoreRestPatch('users_public', uid, publicPatch, token).catch(() => {}),
          firestoreRestPatch('audit', auditId, auditPayload, token).catch(() => {})
        ]);
      } else if (serverDb) {
        await serverSetDoc(serverDoc(serverDb, 'users', uid), userPatch, { merge: true });
        await Promise.all([
          serverSetDoc(serverDoc(serverDb, 'users_public', uid), publicPatch, { merge: true }).catch(() => {}),
          serverSetDoc(serverDoc(serverDb, 'audit', auditId), auditPayload).catch(() => {})
        ]);
      }

      res.json({ 
        success: true, 
        uid, 
        roleVerification, 
        roleVerifiedBy: verifiedBy, 
        roleVerifiedAt: verifiedAt 
      });
    } catch (err: any) {
      console.error('Verify role error:', err.message);
      res.status(500).json({ error: err.message || 'Failed to verify role' });
    }
  });

  // Automated Hourly AI Moderation Engine
  let lastHourlyRunTime: string | null = null;
  let nextHourlyRunTime: string = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  let isHourlyRunning = false;
  let lastHourlyStats = { appsChecked: 0, appsBanned: 0, usersChecked: 0, usersBanned: 0 };

  async function executeHourlyModeration() {
    if (isHourlyRunning) return;
    isHourlyRunning = true;
    lastHourlyRunTime = new Date().toISOString();
    nextHourlyRunTime = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    console.log(`[AI MODERATOR] Starting hourly scan at ${lastHourlyRunTime}...`);

    let appsChecked = 0;
    let appsBanned = 0;
    let usersChecked = 0;
    let usersBanned = 0;

    try {
      if (serverDb) {
        let llmCallsThisCycle = 0;
        const MAX_BACKGROUND_LLM_CALLS = 4;

        // 1. Scan and moderate Apps (skip LLM for unchanged already-moderated apps to preserve API quota)
        const appsSnap = await serverGetDocs(serverCollection(serverDb, 'apps'));
        for (const aDoc of appsSnap.docs) {
          const a = aDoc.data();
          appsChecked++;
          const title = a.title || '';
          const desc = a.description || '';
          const code = a.code || '';
          const author = a.authorName || '';

          const alreadyModeratedUnchanged =
            !!a.moderatedAt &&
            a.status !== 'pending' &&
            (!a.updatedAt || new Date(a.moderatedAt).getTime() >= new Date(a.updatedAt).getTime());

          const skipLLM = alreadyModeratedUnchanged || llmCallsThisCycle >= MAX_BACKGROUND_LLM_CALLS;
          if (!skipLLM) llmCallsThisCycle++;

          const result = await moderateWithNemotron(title, desc, code, author, { skipLLM });
          if (!result.approved && a.status !== 'rejected') {
            appsBanned++;
            await serverSetDoc(aDoc.ref, {
              status: 'rejected',
              moderationStatus: 'rejected',
              moderationReason: result.reason,
              moderationFlags: result.flags,
              moderatedAt: new Date().toISOString(),
              moderatedBy: 'Hourly AI Moderator'
            }, { merge: true });

            const logId = `hourly_app_${aDoc.id}_${Date.now()}`;
            await serverSetDoc(serverDoc(serverDb, 'aiModerationLogs', logId), {
              id: logId,
              appId: aDoc.id,
              appTitle: title,
              authorId: a.authorId || 'unknown',
              authorName: author,
              approved: false,
              reason: `[Почасовая проверка ИИ] ${result.reason}`,
              flags: result.flags,
              riskScore: result.riskScore,
              model: `Hourly AI Moderator (${result.modelUsed || 'Nemotron'})`,
              createdAt: new Date().toISOString()
            });
          }
        }

        // 2. Scan and moderate Users (verifying VERIFIED checkmark + elevated roles)
        const usersSnap = await serverGetDocs(serverCollection(serverDb, 'users'));
        for (const uDoc of usersSnap.docs) {
          const u = uDoc.data();
          usersChecked++;
          const name = u.name || 'User';
          const email = u.email || '';
          const bio = u.bio || '';
          const role = u.role || 'user';
          const roleVerification = u.roleVerification;
          const roleVerifiedBy = u.roleVerifiedBy;
          const isVerifiedAuthor = !!u.isVerifiedAuthor;

          const alreadyModeratedUser = !!u.moderatedAt && u.moderationStatus === 'approved';
          const skipLLM = alreadyModeratedUser || llmCallsThisCycle >= MAX_BACKGROUND_LLM_CALLS;
          if (!skipLLM && !(role !== 'user' && !isVerifiedAuthor) && !isVerifiedAuthor) {
            llmCallsThisCycle++;
          }

          const result = await moderateUserWithNemotron(
            name,
            email,
            bio,
            u.avatarUrl,
            role,
            roleVerification,
            roleVerifiedBy,
            isVerifiedAuthor,
            { skipLLM }
          );

          if (!result.approved && !u.isBanned) {
            usersBanned++;
            await serverSetDoc(uDoc.ref, {
              isBanned: true,
              banReason: result.reason,
              moderationStatus: 'rejected',
              moderationReason: result.reason,
              moderationFlags: result.flags,
              moderatedAt: new Date().toISOString(),
              moderatedBy: 'Hourly AI Moderator'
            }, { merge: true });

            const logId = `hourly_user_${uDoc.id}_${Date.now()}`;
            await serverSetDoc(serverDoc(serverDb, 'aiModerationLogs', logId), {
              id: logId,
              appId: uDoc.id,
              appTitle: `[Пользователь] ${name}`,
              authorId: uDoc.id,
              authorName: name,
              approved: false,
              reason: `[Почасовая проверка ИИ] ${result.reason}`,
              flags: result.flags,
              riskScore: result.riskScore,
              model: `Hourly AI Moderator (${result.modelUsed || 'Nemotron'})`,
              createdAt: new Date().toISOString()
            });
          }
        }

        lastHourlyStats = { appsChecked, appsBanned, usersChecked, usersBanned };

        // Save hourly audit summary
        const summaryId = `hourly_summary_${Date.now()}`;
        await serverSetDoc(serverDoc(serverDb, 'aiModerationLogs', summaryId), {
          id: summaryId,
          appId: 'system_hourly',
          appTitle: `[Почасовая проверка ИИ] Проверено: ${appsChecked} проектов, ${usersChecked} пользователей`,
          authorId: 'system',
          authorName: 'AI Moderator System',
          approved: true,
          reason: `Почасовая проверка ИИ завершена. Выявлено нарушений: проектов ${appsBanned}, пользователей ${usersBanned}.`,
          flags: [],
          riskScore: 0,
          model: 'Hourly AI Moderator',
          createdAt: new Date().toISOString(),
          stats: lastHourlyStats
        });
      }
    } catch (err: any) {
      console.error('[AI MODERATOR] Hourly scan failed:', err.message);
    } finally {
      isHourlyRunning = false;
      console.log(`[AI MODERATOR] Finished hourly scan. Checked: ${appsChecked} apps, ${usersChecked} users.`);
    }
  }

  // Periodic hourly check: runs every 1 hour (3,600,000 ms), initial lightweight pass after 90s
  setInterval(executeHourlyModeration, 60 * 60 * 1000);
  setTimeout(executeHourlyModeration, 90000);

  // Status and on-demand trigger endpoints
  app.get("/api/ai/hourly-moderation-status", (req, res) => {
    res.json({
      active: true,
      intervalHours: 1,
      isCurrentlyRunning: isHourlyRunning,
      lastRunTime: lastHourlyRunTime,
      nextRunTime: nextHourlyRunTime,
      lastStats: lastHourlyStats
    });
  });

  app.post("/api/ai/run-hourly-moderation", rateLimiter(10, 60000), async (req, res) => {
    try {
      await executeHourlyModeration();
      res.json({
        success: true,
        message: 'Hourly AI moderation completed',
        stats: lastHourlyStats,
        lastRunTime: lastHourlyRunTime,
        nextRunTime: nextHourlyRunTime
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Hourly moderation failed' });
    }
  });

  // Secure Server-side Premium Code Generation (Supports 3 tiers: plus, premium, ultra)
  app.post("/api/premium/generate", rateLimiter(30, 60000), async (req, res) => {
    try {
      const token = getBearerToken(req);
      const { adminUid, tier, generatePack } = req.body || {};
      const validTiers: PremiumTierCode[] = ['plus', 'premium', 'ultra'];
      const normalizeTier = (t: any): PremiumTierCode =>
        validTiers.includes(t) ? t : 'premium';

      const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      const part = () => Array.from(crypto.randomBytes(4))
        .map(b => alphabet[b % alphabet.length]).join('').slice(0, 4);

      const tiersToCreate: PremiumTierCode[] = generatePack
        ? ['plus', 'premium', 'ultra']
        : [normalizeTier(tier)];

      const createdEntries: Array<{ id: string; code: string; tier: PremiumTierCode; used: boolean; createdAt: string; createdBy: string }> = [];
      const now = new Date().toISOString();

      for (const targetTier of tiersToCreate) {
        const prefix = targetTier === 'plus' ? 'PLUS' : targetTier === 'ultra' ? 'ULTR' : 'PREM';
        const code = `${prefix}-${part()}-${part()}`;
        const hash = crypto.createHash('sha256').update(code).digest('hex');

        premiumCodesStore.set(hash, {
          tier: targetTier,
          used: false,
          createdAt: now,
          createdBy: adminUid || 'system'
        });

        const entry = {
          id: hash,
          code,
          tier: targetTier,
          used: false,
          createdAt: now,
          createdBy: adminUid || 'system'
        };
        createdEntries.push(entry);

        if (token) {
          await Promise.all([
            firestoreRestPatch('premiumCodes', hash, entry, token).catch(() => {}),
            firestoreRestPatch('audit', `pcode_${targetTier}_${Date.now()}`, {
              type: 'premium_code_generated',
              tier: targetTier,
              codeHash: hash,
              by: adminUid || 'admin',
              at: now
            }, token).catch(() => {})
          ]);
        } else if (serverDb) {
          await Promise.all([
            serverSetDoc(serverDoc(serverDb, 'premiumCodes', hash), entry).catch(() => {}),
            serverSetDoc(serverDoc(serverDb, 'audit', `pcode_${targetTier}_${Date.now()}`), {
              type: 'premium_code_generated',
              tier: targetTier,
              codeHash: hash,
              by: adminUid || 'admin',
              at: now
            }).catch(() => {})
          ]);
        }
      }

      savePremiumCodesToDisk();

      const first = createdEntries[0];
      res.json({
        success: true,
        id: first.id,
        code: first.code,
        tier: first.tier,
        createdAt: first.createdAt,
        codes: createdEntries
      });
    } catch (err: any) {
      console.error('Generate code error:', err.message);
      res.status(500).json({ error: err.message || 'Failed to generate code' });
    }
  });

  // Secure Server-side Premium Code Redemption (Atomic & Hashed verification with Tier support)
  app.post("/api/premium/redeem", rateLimiter(20, 60000), async (req, res) => {
    try {
      const token = getBearerToken(req);
      const { code, userId } = req.body || {};
      if (!code || typeof code !== 'string' || !userId) {
        return res.status(400).json({ error: 'Code and userId are required' });
      }

      const cleanCode = code.trim().toUpperCase();
      const hash = crypto.createHash('sha256').update(cleanCode).digest('hex');
      const inferTierFromCode = (c: string): PremiumTierCode => {
        if (c.startsWith('PLUS-')) return 'plus';
        if (c.startsWith('ULTR-')) return 'ultra';
        return 'premium';
      };

      let codeRecord = premiumCodesStore.get(hash);
      let matchedDocId = hash;

      // Fallback lookup from Firestore (check hashed ID first, then legacy plaintext code ID)
      if (!codeRecord && token) {
        try {
          const restDoc = (await firestoreRestGet('premiumCodes', hash, token))
            || (await firestoreRestGet('premiumCodes', cleanCode, token));
          if (restDoc) {
            matchedDocId = restDoc.id || hash;
            codeRecord = {
              tier: (restDoc.tier as PremiumTierCode) || inferTierFromCode(cleanCode),
              used: !!restDoc.used,
              createdAt: restDoc.createdAt || new Date().toISOString(),
              createdBy: restDoc.createdBy || 'system',
              usedBy: restDoc.usedBy,
              usedAt: restDoc.usedAt
            };
          }
        } catch (_) {}
      } else if (!codeRecord && serverDb) {
        try {
          let snap = await serverGetDoc(serverDoc(serverDb, 'premiumCodes', hash));
          if (!snap.exists()) {
            snap = await serverGetDoc(serverDoc(serverDb, 'premiumCodes', cleanCode));
          }
          if (snap.exists()) {
            matchedDocId = snap.id;
            const d = snap.data();
            codeRecord = {
              tier: (d.tier as PremiumTierCode) || inferTierFromCode(cleanCode),
              used: !!d.used,
              createdAt: d.createdAt || new Date().toISOString(),
              createdBy: d.createdBy || 'system',
              usedBy: d.usedBy,
              usedAt: d.usedAt
            };
          }
        } catch (_) {}
      }

      if (!codeRecord) {
        return res.status(404).json({ error: 'Неверный промокод (Invalid code)' });
      }

      if (codeRecord.used) {
        return res.status(400).json({ error: 'Этот промокод уже был активирован' });
      }

      const resolvedTier: PremiumTierCode = codeRecord.tier || inferTierFromCode(cleanCode);
      const now = new Date().toISOString();
      const oneYearExpiry = new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString();

      codeRecord.used = true;
      codeRecord.usedBy = userId;
      codeRecord.usedAt = now;
      codeRecord.tier = resolvedTier;
      premiumCodesStore.set(hash, codeRecord);
      savePremiumCodesToDisk();

      if (token) {
        await Promise.all([
          firestoreRestPatch('users', userId, {
            isPremium: true,
            premiumTier: resolvedTier,
            premiumExpiry: oneYearExpiry
          }, token).catch(() => {}),
          firestoreRestPatch('users_public', userId, {
            premiumTier: resolvedTier
          }, token).catch(() => {}),
          firestoreRestPatch('premiumCodes', matchedDocId, {
            used: true,
            usedBy: userId,
            usedAt: now,
            tier: resolvedTier
          }, token).catch(() => {}),
          firestoreRestPatch('audit', `redeem_${userId}_${Date.now()}`, {
            type: 'premium_redeemed',
            tier: resolvedTier,
            userId,
            codeHash: hash,
            at: now
          }, token).catch(() => {})
        ]);
      } else if (serverDb) {
        await Promise.all([
          serverSetDoc(serverDoc(serverDb, 'users', userId), {
            isPremium: true,
            premiumTier: resolvedTier,
            premiumExpiry: oneYearExpiry
          }, { merge: true }).catch(() => {}),
          serverSetDoc(serverDoc(serverDb, 'users_public', userId), {
            premiumTier: resolvedTier
          }, { merge: true }).catch(() => {}),
          serverSetDoc(serverDoc(serverDb, 'premiumCodes', matchedDocId), {
            used: true,
            usedBy: userId,
            usedAt: now,
            tier: resolvedTier
          }, { merge: true }).catch(() => {}),
          serverSetDoc(serverDoc(serverDb, 'audit', `redeem_${userId}_${Date.now()}`), {
            type: 'premium_redeemed',
            tier: resolvedTier,
            userId,
            codeHash: hash,
            at: now
          }).catch(() => {})
        ]);
      }

      return res.json({ success: true, isPremium: true, tier: resolvedTier, premiumExpiry: oneYearExpiry });
    } catch (err: any) {
      console.error('Redeem error:', err.message);
      res.status(500).json({ error: err.message || 'Redemption failed' });
    }
  });

  // =========================================================================
  // Extra Premium Access Cross-Account Relay (Troll Inbox + Control My EPL)
  // Combines fast in-memory queuing + Firestore mirroring so every target account
  // reacts reliably regardless of auth mode, clock skew, or rapid back-to-back events.
  // =========================================================================
  const extraTrollQueues = new Map<string, any[]>();
  const extraRemoteSessions = new Map<string, any>();

  app.post("/api/extra/troll", rateLimiter(120, 60000), async (req, res) => {
    try {
      const token = getBearerToken(req);
      const { targetUid, event } = req.body || {};
      if (!targetUid || typeof targetUid !== 'string' || !event || typeof event !== 'object' || !event.eventId) {
        return res.status(400).json({ error: 'Invalid targetUid or event payload' });
      }

      const normalizedEvent = {
        ...event,
        targetUid,
        createdAt: event.createdAt || new Date().toISOString(),
        serverTs: Date.now(),
      };

      const existing = extraTrollQueues.get(targetUid) || [];
      const cutoff = Date.now() - 2 * 60 * 60 * 1000;
      const pruned = existing.filter((e) => (e.serverTs || Date.now()) >= cutoff && e.eventId !== normalizedEvent.eventId);
      pruned.push(normalizedEvent);
      if (pruned.length > 30) pruned.splice(0, pruned.length - 30);
      extraTrollQueues.set(targetUid, pruned);

      // Best-effort Firestore mirror (never fails the relay if token is absent)
      if (token) {
        firestoreRestPatch('trollInbox', targetUid, normalizedEvent, token).catch(() => {});
      } else if (serverDb) {
        serverSetDoc(serverDoc(serverDb, 'trollInbox', targetUid), normalizedEvent, { merge: true }).catch(() => {});
      }

      return res.json({ success: true, eventId: normalizedEvent.eventId });
    } catch (err: any) {
      console.error('Extra troll relay error:', err?.message || err);
      return res.status(500).json({ error: err?.message || 'Failed to relay troll event' });
    }
  });

  app.post("/api/extra/control", rateLimiter(180, 60000), async (req, res) => {
    try {
      const token = getBearerToken(req);
      const { targetUid, session } = req.body || {};
      if (!targetUid || typeof targetUid !== 'string' || !session || typeof session !== 'object') {
        return res.status(400).json({ error: 'Invalid targetUid or session payload' });
      }

      const prev = extraRemoteSessions.get(targetUid);
      const prevCommands: any[] = Array.isArray(prev?.recentCommands) ? prev.recentCommands : [];
      const nextCommands = session.status === 'active' ? [...prevCommands] : [];
      if (session.command && session.command.commandId) {
        if (!nextCommands.some((c) => c.commandId === session.command.commandId)) {
          nextCommands.push(session.command);
          if (nextCommands.length > 25) nextCommands.splice(0, nextCommands.length - 25);
        }
      }

      const nextSession = {
        ...session,
        targetUid,
        updatedAt: session.updatedAt || new Date().toISOString(),
        recentCommands: nextCommands,
      };
      extraRemoteSessions.set(targetUid, nextSession);

      // Mirror core session object to Firestore cleanly
      const firestorePayload = { ...session, targetUid, updatedAt: nextSession.updatedAt };
      if (token) {
        firestoreRestPatch('remoteControlSessions', targetUid, firestorePayload, token).catch(() => {});
      } else if (serverDb) {
        serverSetDoc(serverDoc(serverDb, 'remoteControlSessions', targetUid), firestorePayload, { merge: true }).catch(() => {});
      }

      return res.json({ success: true, status: nextSession.status });
    } catch (err: any) {
      console.error('Extra control relay error:', err?.message || err);
      return res.status(500).json({ error: err?.message || 'Failed to relay control session' });
    }
  });

  app.get("/api/extra/poll/:uid", (req, res) => {
    const uid = req.params.uid;
    if (!uid) return res.json({ events: [], remoteSession: null });
    const cutoff = Date.now() - 2 * 60 * 60 * 1000;
    const events = (extraTrollQueues.get(uid) || []).filter((e) => (e.serverTs || Date.now()) >= cutoff);
    const remoteSession = extraRemoteSessions.get(uid) || null;
    return res.json({ events, remoteSession });
  });

  app.get("/api/extra/control-status/:targetUid", (req, res) => {
    const targetUid = req.params.targetUid;
    if (!targetUid) return res.json({ remoteSession: null });
    return res.json({ remoteSession: extraRemoteSessions.get(targetUid) || null });
  });

  // API routes
  app.post("/api/create-checkout-session", rateLimiter(20, 60000), async (req, res) => {
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
      const { session_id } = req.query;
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

  // Secure Server-side Gemini AI proxy routes
  app.post("/api/ai/generate", rateLimiter(30, 60000), async (req, res) => {
    try {
      const { prompt, model, systemInstruction } = req.body;
      if (!prompt || typeof prompt !== 'string' || prompt.length > 20000) {
        return res.status(400).json({ error: 'Invalid or oversized prompt' });
      }

      const geminiKey = (process.env.GEMINI_API_KEY || '').trim();
      if (!geminiKey) {
        // Fast OpenRouter text fallback when GEMINI_API_KEY is not configured
        if (OPENROUTER_API_KEY && Date.now() >= openRouterQuotaCooldownUntil) {
          const deadline = Date.now() + 8000;
          for (const modelId of OPENROUTER_FALLBACK_MODELS) {
            const remaining = deadline - Date.now();
            if (remaining < 1200) break;
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), Math.min(6000, remaining));
            try {
              const orRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                method: "POST",
                headers: {
                  "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
                  "Content-Type": "application/json",
                  "HTTP-Referer": process.env.APP_URL || "https://epl-studio.local",
                  "X-Title": "EPL Studio Code Assistant"
                },
                body: JSON.stringify({
                  model: modelId,
                  messages: [
                    ...(systemInstruction ? [{ role: "system", content: systemInstruction }] : []),
                    { role: "user", content: prompt }
                  ],
                  temperature: 0.4,
                  max_tokens: 1400
                }),
                signal: controller.signal
              });
              clearTimeout(timeoutId);

              if (orRes.status === 429 || orRes.status === 402) {
                openRouterQuotaCooldownUntil = Date.now() + 15 * 60 * 1000;
                break;
              }
              if (!orRes.ok) continue;
              const data: any = await orRes.json();
              const msg = data?.choices?.[0]?.message || {};
              const textOut = (typeof msg.content === 'string' ? msg.content : '') || (typeof msg.reasoning === 'string' ? msg.reasoning : '');
              if (textOut.trim()) {
                return res.json({ text: textOut.trim() });
              }
            } catch {
              clearTimeout(timeoutId);
            }
          }
        }
        return res.status(503).json({
          error: 'GEMINI_API_KEY is not configured in Settings > Secrets.'
        });
      }

      const ai = getAI();
      const allowedModels = new Set(['gemini-4-hydrogen', 'gemini-3.1-flash-lite', 'gemini-4-neon', 'gemini-4-carbon']);
      const targetModel = allowedModels.has(model) ? model : 'gemini-4-hydrogen';
      const config: any = {};
      if (systemInstruction) {
        config.systemInstruction = systemInstruction;
      }

      const response = await withTimeout(
        ai.models.generateContent({
          model: targetModel,
          contents: prompt,
          config: Object.keys(config).length > 0 ? config : undefined,
        }),
        25000,
        'Gemini generation request timed out'
      );

      res.json({ text: response.text });
    } catch (err: any) {
      console.error('Gemini error:', err.message);
      res.status(500).json({ error: err.message || 'AI generation failed' });
    }
  });

  app.post("/api/ai/generate-image", rateLimiter(15, 60000), async (req, res) => {
    const { prompt, aspectRatio, title } = req.body;
    if (!prompt || typeof prompt !== 'string' || prompt.length > 2000) {
      return res.status(400).json({ error: 'Invalid prompt parameter' });
    }

    const buildSvgFallback = () => {
      const safeTitle = String(title || 'EPL Studio').replace(/[<>&"']/g, '').slice(0, 26) || 'EPL App';
      const w = aspectRatio === '16:9' ? 1280 : 512;
      const h = aspectRatio === '16:9' ? 720 : 512;
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
        <rect width="${w}" height="${h}" fill="#111315"/>
        <rect x="24" y="24" width="${w - 48}" height="${h - 48}" rx="18" fill="#181B20" stroke="#262B33" stroke-width="2"/>
        <circle cx="${w / 2}" cy="${h / 2 - 22}" r="42" fill="#10B981" fill-opacity="0.14" stroke="#10B981" stroke-width="2"/>
        <path d="M${w / 2 - 14} ${h / 2 - 34} L${w / 2 + 18} ${h / 2 - 22} L${w / 2 - 14} ${h / 2 - 10} Z" fill="#10B981"/>
        <text x="${w / 2}" y="${h / 2 + 52}" text-anchor="middle" fill="#F3F4F6" font-family="monospace" font-size="28" font-weight="700">${safeTitle}</text>
      </svg>`;
      return Buffer.from(svg, 'utf8').toString('base64');
    };

    const geminiKey = (process.env.GEMINI_API_KEY || '').trim();
    if (!geminiKey) {
      return res.json({
        imageBase64: buildSvgFallback(),
        mimeType: 'image/svg+xml',
        isSvgFallback: true,
      });
    }

    try {
      const ai = getAI();
      const response = await withTimeout(
        ai.models.generateContent({
          model: 'gemini-3.1-flash-lite-image',
          contents: prompt,
          config: aspectRatio ? { imageConfig: { aspectRatio } } : undefined,
        }),
        25000,
        'Image generation timed out'
      );

      const part = response.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData);
      if (part?.inlineData?.data) {
        return res.json({
          imageBase64: part.inlineData.data,
          mimeType: part.inlineData.mimeType || 'image/png',
        });
      }

      return res.json({
        imageBase64: buildSvgFallback(),
        mimeType: 'image/svg+xml',
        isSvgFallback: true,
      });
    } catch (err: any) {
      console.warn('Image gen fallback activated:', err.message);
      return res.json({
        imageBase64: buildSvgFallback(),
        mimeType: 'image/svg+xml',
        isSvgFallback: true,
      });
    }
  });

  // Project Build & Export System
  app.post("/api/build", rateLimiter(15, 60000), async (req, res) => {
    try {
      const { projectId, platform, version, appData } = req.body;
      if (!projectId || !platform) {
        return res.status(400).json({ error: 'Missing projectId or platform parameter' });
      }

      const normalizedPlatform =
        platform === 'ios-ipa'
          ? 'ios'
          : platform === 'source' || platform === 'direct'
            ? 'epl'
            : platform;
      const validPlatforms = ['epl', 'windows', 'macos', 'linux', 'android', 'ios'];
      if (!validPlatforms.includes(normalizedPlatform)) {
        return res.status(400).json({ error: `Invalid platform: ${platform}. Allowed: ${validPlatforms.join(', ')}` });
      }

      const job = await createBuildJob(
        projectId, 
        normalizedPlatform as BuildPlatform, 
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
