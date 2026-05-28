/* eslint-disable */
// src/services/gymService.js
// 체육관(Gym) 서비스 최소 스텁. 실제 Firestore 연동은 추후 구현.

import { db } from "./firebase";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp,
} from "firebase/firestore";

const COL = "gyms";

export async function listGyms({ regionCode } = {}) {
  try {
    const col = collection(db, COL);
    const q = regionCode ? query(col, where("regionCode", "==", regionCode)) : col;
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (e) {
    return [];
  }
}

export async function getGym(gymId) {
  if (!gymId) return null;
  try {
    const snap = await getDoc(doc(db, COL, gymId));
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
  } catch (e) {
    return null;
  }
}

export async function createGym(data) {
  const ref = await addDoc(collection(db, COL), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateGym(gymId, patch) {
  if (!gymId) return;
  await updateDoc(doc(db, COL, gymId), {
    ...patch,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteGym(gymId) {
  if (!gymId) return;
  await deleteDoc(doc(db, COL, gymId));
}
