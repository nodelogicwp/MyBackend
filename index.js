const admin = require("firebase-admin");
const express = require("express");

// Wczytanie pliku klucza (Secret File z Rendera)
const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const auth = admin.auth();
const app = express();
app.use(express.json());

// Pośrednik (Middleware) sprawdzający tokeny JWT wysłane z WPF
async function checkAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing token" });
  }
  const token = authHeader.split("Bearer ")[1];
  try {
    req.user = await auth.verifyIdToken(token);
    next();
  } catch (err) {
    res.status(403).json({ error: "Invalid token" });
  }
}

// 1. REJESTRACJA UŻYTKOWNIKA (Firebase Auth + Profil w Firestore)
app.post("/api/register", async (req, res) => {
  try {
    const { email, password, displayName } = req.body;
    const user = await auth.createUser({ email, password, displayName });
    await db.collection("users").doc(user.uid).set({ email, displayName, role: "user" });
    res.status(201).json({ uid: user.uid, message: "User registered!" });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 2. POBIERANIE SPRZĘTU (Publiczne)
app.get("/api/equipment", async (req, res) => {
  const snapshot = await db.collection("equipment").get();
  res.json(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
});

// 3. AKTUALIZACJA SPRZĘTU (Chronione)
app.patch("/api/equipment/:id", checkAuth, async (req, res) => {
  try {
    await db.collection("equipment").doc(req.params.id).update({ status: req.body.status });
    res.json({ message: "Equipment status updated!" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. POBIERANIE WYPOŻYCZEŃ ZALOGOWANEGO UŻYTKOWNIKA (Filtrowanie JWT)
app.get("/api/rentals/my", checkAuth, async (req, res) => {
  try {
    const snapshot = await db.collection("rentals").where("userId", "==", req.user.uid).get();
    res.json(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. DODAWANIE WYPOŻYCZENIA (Przypisuje userId z tokenu JWT)
app.post("/api/rentals", checkAuth, async (req, res) => {
  try {
    const docRef = await db.collection("rentals").add({
      equipmentId: req.body.equipmentId,
      userId: req.user.uid,
      rentalDate: req.body.rentalDate,
      status: "active"
    });
    res.status(201).json({ id: docRef.id, message: "Rental created!" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 6. AKTUALIZACJA WYPOŻYCZENIA (Chronione)
app.patch("/api/rentals/:id", checkAuth, async (req, res) => {
  try {
    await db.collection("rentals").doc(req.params.id).update(req.body);
    res.json({ message: "Rental updated!" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Domyślny port przypisywany przez hosting lub 5000 do testów lokalnych
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Backend server listening on port ${PORT}`));
