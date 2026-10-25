import express from "express";
import http from "http";
import { WebSocketServer } from "ws";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import * as dotenv from "dotenv";
import Stripe from 'stripe';
import { GoogleGenAI } from "@google/genai";
import { initializeApp as initServerApp } from "firebase/app";
import { getAuth as getServerAuth, signInAnonymously as serverSignInAnonymously } from "firebase/auth";
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
import { createBuildJob, getBuildJob, BuildPlatform } from './server/builder';
import { setupCollabWebSocketServer, createSession, getSession } from './server/collab-server';

dotenv.config();
dotenv.config({ path: '.env.example' });

let genAIClient: GoogleGenAI | null = null;
function getAI(): GoogleGenAI {
  if (!genAIClient) {
    const key = process.env.GEMINI_API_KEY || '';
    genAIClient = new GoogleGenAI({ apiKey: key });
  }
  return genAIClient;
}

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

  // Security Headers Middleware
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    next();
  });

  // Body parser with 2MB limit to prevent memory exhaustion attacks
  app.use(express.json({ limit: '2mb' }));

  // In-memory sliding rate limiter per IP
  const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
  const rateLimiter = (maxRequests: number, windowMs: number) => {
    return (req: express.Request, res: express.Response, next: express.NextFunction) => {
      const ip = (req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || 'unknown').split(',')[0].trim();
      const now = Date.now();
      const record = rateLimitMap.get(ip);

      if (!record || now > record.resetAt) {
        rateLimitMap.set(ip, { count: 1, resetAt: now + windowMs });
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
    // Exempt AI moderation and publishing endpoints so Nemotron AI can analyze and log exploit attempts
    if (
      req.originalUrl?.startsWith('/api/apps/publish') || 
      req.originalUrl?.startsWith('/api/ai/moderate-app') ||
      req.originalUrl?.startsWith('/api/ai/moderate-user') ||
      req.path === '/apps/publish' || 
      req.path === '/ai/moderate-app' ||
      req.path === '/ai/moderate-user'
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

  // Initialize server-side Firestore instance
  const fbConfigPath = path.join(process.cwd(), 'firebase-applet-config.json');
  let serverDb: any = null;
  if (fs.existsSync(fbConfigPath)) {
    try {
      const fbConfig = JSON.parse(fs.readFileSync(fbConfigPath, 'utf8'));
      const sApp = initServerApp(fbConfig, 'server-backend-admin');
      serverDb = getServerFirestore(sApp, fbConfig.firestoreDatabaseId);
      serverSignInAnonymously(getServerAuth(sApp)).catch((err) => {
        console.warn('Server anonymous auth notice:', err.message);
      });
    } catch (e) {
      console.error('Failed to init server Firebase:', e);
    }
  }

  // OpenRouter Nemotron 3.5 Content Moderation
  const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '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';
  const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || 'nvidia/nemotron-3.5-super-vl:free';

  interface ModerationResult {
    approved: boolean;
    reason: string;
    flags: string[];
    riskScore: number;
  }

  async function moderateWithNemotron(title: string, description: string, code: string, authorName?: string): Promise<ModerationResult> {
    const combined = `${title} ${description} ${code}`.toLowerCase();
    const explicitTerms = ['hacked by', 'you hacked', 'fuada was hacked', 'взломали', 'порно', 'porn', 'xxx', 'hentai', 'хуй', 'пизда', 'ебать', 'блять', 'сука', 'fuck', 'shit', 'nigger', 'cunt', 'dick'];
    const matchedTerms = explicitTerms.filter(t => combined.includes(t));

    try {
      const prompt = `Проведи строгую модерацию приложения/игры для платформы EPL Studio.
Проверь на следующие категории нарушений:
1. Контент 18+ / NSFW / сексуальный контент / эротика.
2. Ненормативная лексика / маты / оскорбления / язык вражды (на русском и английском).
3. Признаки взлома / хакинга / эксплойты / вредоносный код / дефейс (слова "hacked", "взлом", "kamil", деструктивные бесконечные циклы, попытки DoS, кража данных).

Данные проекта:
- Название: "${title}"
- Описание: "${description}"
- Автор: "${authorName || 'User'}"
- Исходный код (EPL):
\`\`\`
${code.slice(0, 4000)}
\`\`\`

Ответь ТОЛЬКО валидным JSON-объектом без лишних символов и без markdown блоков в формате:
{
  "approved": boolean,
  "reason": string,
  "flags": string[],
  "riskScore": number
}`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);

      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://epl-studio.local",
          "X-Title": "EPL Studio Content Moderation"
        },
        body: JSON.stringify({
          model: OPENROUTER_MODEL,
          messages: [
            {
              role: "system",
              content: "Ты — строгий ИИ-модератор контента. Анализируй игры и код на 18+, маты и попытки взлома. Возвращай ТОЛЬКО валидный JSON без markdown форматирования: {\"approved\": boolean, \"reason\": string, \"flags\": string[], \"riskScore\": number}"
            },
            { role: "user", content: prompt }
          ],
          temperature: 0.1
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data: any = await response.json();
        const content = data.choices?.[0]?.message?.content || '';
        const jsonMatch = content.match(/\{[\s\S]*"approved"[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          return {
            approved: !!parsed.approved,
            reason: parsed.reason || (parsed.approved ? 'Проект безопасен и проверен ИИ' : 'Проект нарушает правила безопасности платформы'),
            flags: Array.isArray(parsed.flags) ? parsed.flags : [],
            riskScore: typeof parsed.riskScore === 'number' ? parsed.riskScore : (parsed.approved ? 0 : 8)
          };
        }
      }
    } catch (err: any) {
      console.warn('Nemotron OpenRouter error or timeout, applying heuristic backup:', err.message);
    }

    // Heuristic fallback
    if (matchedTerms.length > 0) {
      return {
        approved: false,
        reason: `Обнаружены запрещенные слова или признаки вредоносного контента/взлома: ${matchedTerms.slice(0, 3).join(', ')}`,
        flags: ['hacking', 'profanity', 'restricted_terms'],
        riskScore: 9
      };
    }

    return {
      approved: true,
      reason: 'Проект прошел базовую проверку безопасности',
      flags: [],
      riskScore: 0
    };
  }

  async function moderateUserWithNemotron(name: string, email: string, bio?: string, avatarUrl?: string, role?: string): Promise<ModerationResult> {
    const combined = `${name} ${email} ${bio || ''}`.toLowerCase();
    const explicitTerms = ['hacked by', 'you hacked', 'fuada was hacked', 'взломали', 'порно', 'porn', 'xxx', 'hentai', 'хуй', 'пизда', 'ебать', 'блять', 'сука', 'fuck', 'shit', 'nigger', 'cunt', 'dick', 'kamil', 'you hacked by kamil'];
    const matchedTerms = explicitTerms.filter(t => combined.includes(t));

    try {
      const prompt = `Проведи строгую модерацию профиля пользователя для платформы EPL Studio.
Проверь профиль на категории нарушений:
1. Контент 18+ / NSFW / сексуальные намеки / эротика в имени или описании.
2. Ненормативная лексика / маты / оскорбления / язык вражды (на русском и английском).
3. Признаки взлома / хакинга / фейковых аккаунтов взломщиков ("hacked", "взлом", "kamil", "fuada was hacked", "you hacked by kamil", выдача себя за администрацию).

Данные профиля пользователя:
- Имя пользователя: "${name}"
- Email: "${email}"
- Описание / Био: "${bio || 'Отсутствует'}"
- Ссылка на аватар: "${avatarUrl || 'Стандартный'}"
- Роль: "${role || 'user'}"

Ответь ТОЛЬКО валидным JSON-объектом без лишних символов и без markdown блоков в формате:
{
  "approved": boolean,
  "reason": string,
  "flags": string[],
  "riskScore": number
}`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);

      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://epl-studio.local",
          "X-Title": "EPL Studio User Moderation"
        },
        body: JSON.stringify({
          model: OPENROUTER_MODEL,
          messages: [
            {
              role: "system",
              content: "Ты — строгий ИИ-модератор профилей пользователей. Проверяй имена и биографию на 18+, маты и упоминания взломов. Возвращай ТОЛЬКО валидный JSON: {\"approved\": boolean, \"reason\": string, \"flags\": string[], \"riskScore\": number}"
            },
            { role: "user", content: prompt }
          ],
          temperature: 0.1
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data: any = await response.json();
        const content = data.choices?.[0]?.message?.content || '';
        const jsonMatch = content.match(/\{[\s\S]*"approved"[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          return {
            approved: !!parsed.approved,
            reason: parsed.reason || (parsed.approved ? 'Профиль пользователя соответствует правилам платформы' : 'Профиль нарушает правила платформы'),
            flags: Array.isArray(parsed.flags) ? parsed.flags : [],
            riskScore: typeof parsed.riskScore === 'number' ? parsed.riskScore : (parsed.approved ? 0 : 8)
          };
        }
      }
    } catch (err: any) {
      console.warn('Nemotron user moderation error, using fallback:', err.message);
    }

    if (matchedTerms.length > 0) {
      return {
        approved: false,
        reason: `Обнаружены запрещенные слова или упоминания взломов/оскорблений в профиле: ${matchedTerms.slice(0, 3).join(', ')}`,
        flags: ['hacking_impersonation', 'profanity', 'restricted_terms'],
        riskScore: 9
      };
    }

    return {
      approved: true,
      reason: 'Профиль пользователя прошел автоматическую проверку безопасности',
      flags: [],
      riskScore: 0
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

  // Moderate user profile endpoint
  app.post("/api/ai/moderate-user", rateLimiter(30, 60000), async (req, res) => {
    try {
      const { userId, name, email, bio, avatarUrl, role } = req.body;
      if (!name || typeof name !== 'string') {
        return res.status(400).json({ error: 'Missing user name' });
      }

      const modResult = await moderateUserWithNemotron(name, email || '', bio || '', avatarUrl || '', role || 'user');
      const isApproved = modResult.approved;

      if (serverDb && userId) {
        const userRef = serverDoc(serverDb, 'users', userId);
        const patchData: any = {
          isBanned: !isApproved,
          banReason: !isApproved ? modResult.reason : null,
          moderationStatus: isApproved ? 'approved' : 'rejected',
          moderationReason: modResult.reason,
          moderationFlags: modResult.flags,
          moderatedAt: new Date().toISOString(),
          moderatedBy: OPENROUTER_MODEL
        };
        try {
          await serverSetDoc(userRef, patchData, { merge: true });

          // Record log in aiModerationLogs
          const logId = `mod_user_${userId}_${Date.now()}`;
          await serverSetDoc(serverDoc(serverDb, 'aiModerationLogs', logId), {
            id: logId,
            appId: userId,
            appTitle: `[Пользователь] ${name}`,
            authorId: userId,
            authorName: name,
            approved: isApproved,
            reason: modResult.reason,
            flags: modResult.flags,
            riskScore: modResult.riskScore,
            model: OPENROUTER_MODEL,
            createdAt: new Date().toISOString()
          });
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
        moderatedBy: OPENROUTER_MODEL,
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

      if (serverDb) {
        // Save app to Firestore
        await serverSetDoc(serverDoc(serverDb, 'apps', appId), publishedAppRecord, { merge: true });

        // Record permanent log in aiModerationLogs
        const logId = `mod_${appId}_${Date.now()}`;
        await serverSetDoc(serverDoc(serverDb, 'aiModerationLogs', logId), {
          id: logId,
          appId,
          appTitle: title,
          authorId,
          authorName,
          approved: isApproved,
          reason: modResult.reason,
          flags: modResult.flags,
          riskScore: modResult.riskScore,
          model: OPENROUTER_MODEL,
          createdAt: new Date().toISOString(),
          codeSnippet: code.slice(0, 800)
        });

        // Always create/update admin notification request in adminRequests for Control View
        const reqId = `modreq_${appId}`;
        await serverSetDoc(serverDoc(serverDb, 'adminRequests', reqId), {
          id: reqId,
          type: isApproved ? 'ai_moderation_approved' : 'ai_moderation_alert',
          targetId: appId,
          targetName: title,
          requesterId: authorId,
          requesterName: authorName,
          reason: `[ИИ ${isApproved ? 'Одобрил' : 'Отклонил'}]: ${modResult.reason}${modResult.flags.length > 0 ? ` (Флаги: ${modResult.flags.join(', ')})` : ''}`,
          status: isApproved ? 'approved' : 'pending',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          appDetails: {
            title,
            category: appData.category || 'Other',
            riskScore: modResult.riskScore,
            flags: modResult.flags
          }
        }, { merge: true });
      }

      res.json({
        success: isApproved,
        approved: isApproved,
        appId,
        reason: modResult.reason,
        flags: modResult.flags,
        riskScore: modResult.riskScore
      });
    } catch (err: any) {
      console.error('Publish error:', err.message);
      res.status(500).json({ error: err.message || 'Failed to publish app' });
    }
  });

  // Manual Review Endpoint for Control Panel
  app.post("/api/admin/manual-review", rateLimiter(60, 60000), async (req, res) => {
    try {
      const { appId, action, reason, reviewerName } = req.body;
      if (!appId || !action || !['approve', 'reject'].includes(action)) {
        return res.status(400).json({ error: 'Invalid review parameters' });
      }

      if (serverDb) {
        try {
          const isApprove = action === 'approve';
          const patchData: any = {
            status: isApprove ? 'verified' : 'rejected',
            moderationStatus: isApprove ? 'approved' : 'rejected',
            moderationReason: reason || (isApprove ? 'Одобрено модератором вручную' : 'Отклонено модератором вручную'),
            moderatedBy: `Admin Manual (${reviewerName || 'Staff'})`,
            moderatedAt: new Date().toISOString()
          };

          await serverSetDoc(serverDoc(serverDb, 'apps', appId), patchData, { merge: true });

          // Update corresponding admin request
          const reqId = `modreq_${appId}`;
          await serverSetDoc(serverDoc(serverDb, 'adminRequests', reqId), {
            status: isApprove ? 'approved' : 'rejected',
            manualReviewer: reviewerName || 'Admin',
            updatedAt: new Date().toISOString()
          }, { merge: true });
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
    try {
      if (!serverDb) {
        return res.json({ logs: [] });
      }
      const q = serverQuery(serverCollection(serverDb, 'aiModerationLogs'), serverOrderBy('createdAt', 'desc'), serverLimit(60));
      const snap = await serverGetDocs(q);
      const logs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      res.json({ logs });
    } catch (err: any) {
      console.error('Get moderation logs error:', err.message);
      res.status(500).json({ error: err.message || 'Failed to get logs' });
    }
  });

  // Anti-Cheat & Anti-Inflation Vote Endpoint
  app.post("/api/apps/vote", rateLimiter(30, 60000), async (req, res) => {
    try {
      const { userId, appId, type } = req.body;
      if (!userId || !appId || !['like', 'dislike'].includes(type)) {
        return res.status(400).json({ error: 'Invalid vote parameters' });
      }

      if (serverDb) {
        const voteId = `${userId}_${appId}`;
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
      const { appId } = req.body;
      if (!appId || typeof appId !== 'string') {
        return res.status(400).json({ error: 'Missing appId parameter' });
      }

      if (serverDb) {
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
      const { userId } = req.body;
      if (!userId || typeof userId !== 'string') {
        return res.status(400).json({ error: 'Missing userId parameter' });
      }

      if (serverDb) {
        await Promise.allSettled([
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
      const { userId, isBanned, reason } = req.body;
      if (!userId || typeof userId !== 'string') {
        return res.status(400).json({ error: 'Missing userId parameter' });
      }

      if (serverDb) {
        const patchBody = {
          isBanned: !!isBanned,
          banReason: isBanned ? (reason || 'Violation of terms') : null
        };

        await Promise.allSettled([
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

  // Secure Server-side Gemini AI proxy routes
  app.post("/api/ai/generate", rateLimiter(30, 60000), async (req, res) => {
    try {
      const { prompt, model, systemInstruction } = req.body;
      if (!prompt || typeof prompt !== 'string' || prompt.length > 20000) {
        return res.status(400).json({ error: 'Invalid or oversized prompt' });
      }

      const ai = getAI();
      const targetModel = model || "gemini-2.5-flash";
      const config: any = {};
      if (systemInstruction) {
        config.systemInstruction = systemInstruction;
      }

      const response = await ai.models.generateContent({
        model: targetModel,
        contents: prompt,
        config: Object.keys(config).length > 0 ? config : undefined,
      });

      res.json({ text: response.text });
    } catch (err: any) {
      console.error('Gemini error:', err.message);
      res.status(500).json({ error: err.message || 'AI generation failed' });
    }
  });

  app.post("/api/ai/generate-image", rateLimiter(15, 60000), async (req, res) => {
    try {
      const { prompt } = req.body;
      if (!prompt || typeof prompt !== 'string' || prompt.length > 2000) {
        return res.status(400).json({ error: 'Invalid prompt parameter' });
      }

      const ai = getAI();
      const response = await ai.models.generateContent({
        model: 'imagen-3.0-generate-002',
        contents: prompt,
      });

      const part = response.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData);
      if (part?.inlineData?.data) {
        return res.json({ imageBase64: part.inlineData.data });
      }

      res.status(500).json({ error: 'No image returned' });
    } catch (err: any) {
      console.error('Image gen error:', err.message);
      res.status(500).json({ error: err.message || 'Image generation failed' });
    }
  });

  // Project Build & Export System
  app.post("/api/build", rateLimiter(15, 60000), async (req, res) => {
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
