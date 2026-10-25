/**
 * EPL Studio - Firebase Cloud Functions (2nd Gen)
 * Privileged Operations & Security Boundary Enforcement
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');
const crypto = require('crypto');

initializeApp();
const db = getFirestore();
const auth = getAuth();

/**
 * Validates authentication, email verification, and optional admin claim
 */
const guard = (req, needAdmin = false) => {
  if (!req.auth) {
    throw new HttpsError('unauthenticated', 'Authentication required');
  }
  if (!req.auth.token.email_verified) {
    throw new HttpsError('permission-denied', 'Email must be verified');
  }
  if (needAdmin && req.auth.token.admin !== true && req.auth.token.developer !== true) {
    throw new HttpsError('permission-denied', 'Admin or Developer privilege required');
  }
  return req.auth;
};

/**
 * setRole: Assigns RBAC roles and custom user claims
 */
exports.setRole = onCall(async (req) => {
  const me = guard(req, true);
  const { uid, role } = req.data || {};
  if (!uid || !['user', 'moderator', 'admin', 'developer', 'shopkeeper'].includes(role)) {
    throw new HttpsError('invalid-argument', 'Invalid user ID or role');
  }

  // Set Firebase Auth custom claims
  await auth.setCustomUserClaims(uid, {
    admin: role === 'admin' || role === 'developer',
    developer: role === 'developer',
    moderator: role === 'moderator',
    role: role
  });

  // Update Firestore user document
  await db.doc(`users/${uid}`).update({
    role,
    updatedAt: FieldValue.serverTimestamp()
  });

  // Write immutable audit record
  await db.collection('audit').add({
    type: 'role_change',
    by: me.uid,
    target: uid,
    role,
    at: FieldValue.serverTimestamp()
  });

  return { ok: true, role };
});

/**
 * giveCoins: Atomic server-side balance updates with transaction guarantees
 */
exports.giveCoins = onCall(async (req) => {
  const me = guard(req, true);
  const { uid, amount } = req.data || {};
  if (!uid || !Number.isInteger(amount) || Math.abs(amount) > 1e6) {
    throw new HttpsError('invalid-argument', 'Invalid coin amount or target UID');
  }

  let newBalance = 0;
  await db.runTransaction(async (tx) => {
    const userRef = db.doc(`users/${uid}`);
    const snap = await tx.get(userRef);
    if (!snap.exists) {
      throw new HttpsError('not-found', 'Target user does not exist');
    }
    const current = snap.data().eplCoins || 0;
    newBalance = Math.max(0, current + amount);
    tx.update(userRef, { eplCoins: newBalance });
    
    // Also sync users_public if present
    const publicRef = db.doc(`users_public/${uid}`);
    tx.set(publicRef, { eplCoins: newBalance }, { merge: true });

    tx.set(db.collection('audit').doc(), {
      type: 'coins',
      by: me.uid,
      target: uid,
      amount,
      balanceAfter: newBalance,
      at: FieldValue.serverTimestamp()
    });
  });

  return { ok: true, newBalance };
});

/**
 * generatePremiumCode: Generates a cryptographically strong code and stores only its SHA-256 hash
 */
exports.generatePremiumCode = onCall(async (req) => {
  const me = guard(req, true);
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const part = () => Array.from(crypto.randomBytes(4))
    .map(b => alphabet[b % alphabet.length]).join('').slice(0, 4);
  const code = `${part()}-${part()}-${part()}`;
  
  // Store only cryptographic hash (SHA-256) in Firestore
  const hash = crypto.createHash('sha256').update(code).digest('hex');
  await db.doc(`premium_codes/${hash}`).set({
    used: false,
    createdAt: FieldValue.serverTimestamp(),
    createdBy: me.uid
  });

  await db.collection('audit').add({
    type: 'premium_code_generated',
    by: me.uid,
    codeHash: hash,
    at: FieldValue.serverTimestamp()
  });

  // Plain code returned once to the caller
  return { code };
});

/**
 * redeemPremiumCode: Atomically redeems a code using hash matching
 */
exports.redeemPremiumCode = onCall(async (req) => {
  const me = guard(req);
  const code = String(req.data?.code || '').trim().toUpperCase();
  if (!code) {
    throw new HttpsError('invalid-argument', 'Premium code is required');
  }

  const hash = crypto.createHash('sha256').update(code).digest('hex');
  const codeRef = db.doc(`premium_codes/${hash}`);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(codeRef);
    if (!snap.exists) {
      throw new HttpsError('not-found', 'Invalid or non-existent premium code');
    }
    const data = snap.data();
    if (data.used) {
      throw new HttpsError('already-exists', 'This code has already been redeemed');
    }

    // 1-year premium duration
    const until = new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString();
    tx.update(codeRef, {
      used: true,
      usedBy: me.uid,
      usedAt: FieldValue.serverTimestamp()
    });

    tx.update(db.doc(`users/${me.uid}`), {
      isPremium: true,
      premiumExpiry: until
    });

    tx.set(db.collection('audit').doc(), {
      type: 'premium_redeem',
      by: me.uid,
      codeHash: hash,
      at: FieldValue.serverTimestamp()
    });
  });

  return { ok: true, isPremium: true };
});

/**
 * verifySession: HMAC-verified session validation for payment flows
 */
exports.verifySession = onCall(async (req) => {
  const me = guard(req);
  const { sessionId, signature } = req.data || {};
  if (!sessionId || !signature) {
    throw new HttpsError('invalid-argument', 'Session ID and HMAC signature required');
  }

  const secret = process.env.SESSION_SECRET || 'epl-studio-hmac-secret-fallback-key';
  const expected = crypto.createHmac('sha256', secret)
    .update(`${me.uid}:${sessionId}`).digest('hex');

  const bufExpected = Buffer.from(expected);
  const bufReceived = Buffer.from(String(signature).padEnd(expected.length).slice(0, expected.length));

  if (!crypto.timingSafeEqual(bufExpected, bufReceived)) {
    throw new HttpsError('permission-denied', 'Invalid signature');
  }

  const snap = await db.doc(`sessions/${sessionId}`).get();
  if (!snap.exists || snap.data().uid !== me.uid) {
    throw new HttpsError('not-found', 'Session not found or belongs to another user');
  }

  return { 
    premiumCode: snap.data().premiumCode, 
    status: snap.data().status 
  };
});

/**
 * onUserCreate: Automatically provisions baseline user record with zero privileges
 */
exports.onUserCreate = require('firebase-functions/v2/identity').beforeUserCreated(async (event) => {
  const u = event.data;
  await db.doc(`users/${u.uid}`).set({
    uid: u.uid,
    email: u.email || '',
    name: u.displayName || 'User',
    role: 'user',
    isPremium: false,
    premiumExpiry: null,
    eplCoins: 0,
    permissions: [],
    isBanned: false,
    createdAt: FieldValue.serverTimestamp()
  }, { merge: true });
});
