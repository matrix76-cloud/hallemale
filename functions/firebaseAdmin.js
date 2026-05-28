/* eslint-disable */
// functions/firebaseAdmin.js
const admin = require("firebase-admin");

let _inited = false;

function initAdmin() {
  if (_inited) return;
  admin.initializeApp();
  _inited = true;
}

function getDb() {
  initAdmin();
  return admin.firestore();
}

function getAdmin() {
  initAdmin();
  return admin;
}

module.exports = { getDb, getAdmin };
