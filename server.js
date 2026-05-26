import express from "express";
import nodemailer from "nodemailer";
import { Pool } from "pg";
import cors from "cors";

// PostgreSQL connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

// Create table if not exists
async function createTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS contacts (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log("Contacts table ready");
  } catch (err) {
    console.error("DB init error:", err);
  }
}

const app = express();
app.use(cors());
const port = process.env.PORT || 10000;
const allowedOrigins = (process.env.FRONTEND_ORIGIN || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const isOriginAllowed = (origin) => {
  if (!origin) return true;
  if (allowedOrigins.length === 0) return true;
  return allowedOrigins.includes(origin);
};

app.use((req, res, next) => {
  const origin = req.headers.origin;

  if (isOriginAllowed(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin || "*");
    res.setHeader("Vary", "Origin");
  }

  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  return next();
});

app.use(express.json({ limit: "32kb" }));

const normalizeContact = (body = {}) => ({
  name: String(body.name || "").trim(),
  email: String(body.email || "").trim(),
  message: String(body.message || "").trim(),
});

const validateContact = ({ name, email, message }) => {
  const errors = {};
  if (name.length < 2) errors.name = "Please enter your name.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = "Please enter a valid email address.";
  if (message.length < 10) errors.message = "Please enter a message with at least 10 characters.";
  if (message.length > 4000) errors.message = "Please keep your message under 4000 characters.";
  return errors;
};

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/api/contact", async (req, res) => {
  const contact = normalizeContact(req.body);
  const errors = validateContact(contact);

  if (Object.keys(errors).length > 0) {
    return res.status(400).json({ ok: false, errors });
  }

  try {
    const insertQuery = `
      INSERT INTO contacts (name, email, message)
      VALUES ($1, $2, $3)
      RETURNING *;
    `;

    const values = [contact.name, contact.email, contact.message];

    const result = await pool.query(insertQuery, values);

    res.status(201).json({
      success: true,
      data: result.rows[0],
    });
  } catch (err) {
    console.error("Insert error:", err);

    res.status(500).json({
      error: "Internal server error",
    });
  }

});

async function startServer() {
  try {
    const client = await pool.connect();
    console.log("PostgreSQL connected");
    client.release();
  } catch (err) {
    console.error("PostgreSQL connection failed:", err);
  }

  await createTable();
  app.listen(port, "0.0.0.0", () => {
    console.log(`DigitWise contact backend listening on port ${port}`);
  });
}

startServer();
