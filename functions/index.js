/* eslint-disable */
// functions/index.js
// Minimal HTTP Functions: health
// Social auth handlers are exported from separate files (kakao.js, naver.js)
// SMS handlers are exported from sms.js (sendSms, pingIp)
// ✅ OTP(onCall) handlers are exported from otp.js (sendOtp, verifyOtp)

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const express = require("express");

// ---- Firebase Admin
if (!admin.apps.length) admin.initializeApp();

// ---- CORS (minimal)
const ALLOW = new Set(
  (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
);

function corsMinimal(req, res, next) {
  const origin = req.headers.origin;
  if (origin && ALLOW.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Credentials", "true");
  }
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS,GET");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(204).end();
  next();
}

// ---------------- otp (gen2: onCall) ----------------
exports.sendSms = require("./sms").sendSms;

