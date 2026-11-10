const functions = require("firebase-functions");
const admin = require("firebase-admin");
const express = require("express");

admin.initializeApp();
const db = admin.firestore();
const auth = admin.auth();
const app = express();
app.use(express.json());

// Endpoint testowy
app.get("/api/hello", (req, res) => {
  res.json({ message: "Działa bezpiecznie w chmurze!" });
});

// Rejestracja użytkownika
app.post("/api/register", async (req, res) => {
  try {
    const { email, password, displayName } = req.body;
    const user = await auth.createUser({ email, password, displayName });
    await db.collection("users").doc(user.uid).set({ email, displayName, role: "user" });
    res.status(201).json({ uid: user.uid, message: "Zarejestrowano pomyślnie!" });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Pobieranie sprzętu (publiczne)
app.get("/api/equipment", async (req, res) => {
  const snapshot = await db.collection("equipment").get();
  res.json(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
});

exports.api = functions.https.onRequest(app);
