import express from "express";
import nodemailer from "nodemailer";
const { Pool } = require("pg");

// PostgreSQL connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Create table if not exists
async function createTable() {
  const query = `
    CREATE TABLE IF NOT EXISTS contacts (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL,
      message TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;

  try {
    await pool.query(query);
    console.log("Contacts table ready");
  } catch (err) {
    console.error("Error creating table:", err);
  }
}

const app = express();
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

// const escapeHtml = (value) =>
//   String(value)
//     .replaceAll("&", "&amp;")
//     .replaceAll("<", "&lt;")
//     .replaceAll(">", "&gt;")
//     .replaceAll('"', "&quot;")
//     .replaceAll("'", "&#039;");

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

// const hasSmtpConfig = () =>
//   process.env.SMTP_HOST &&
//   process.env.SMTP_PORT &&
//   process.env.SMTP_USER &&
//   process.env.SMTP_PASS &&
//   process.env.CONTACT_TO;

// const sendContactEmail = async ({ name, email, message }) => {
//   if (!hasSmtpConfig()) {
//     console.info("Contact message received without SMTP config:", { name, email, message });
//     return;
//   }

//   const transporter = nodemailer.createTransport({
//     host: process.env.SMTP_HOST,
//     port: Number(process.env.SMTP_PORT),
//     secure: process.env.SMTP_SECURE === "true",
//     auth: {
//       user: process.env.SMTP_USER,
//       pass: process.env.SMTP_PASS,
//     },
//   });

//   await transporter.sendMail({
//     from: process.env.CONTACT_FROM || process.env.SMTP_USER,
//     to: process.env.CONTACT_TO,
//     replyTo: email,
//     subject: `New DigitWise contact message from ${name}`,
//     text: `Name: ${name}\nEmail: ${email}\n\nMessage:\n${message}`,
//     html: `
//       <h2>New DigitWise contact message</h2>
//       <p><strong>Name:</strong> ${escapeHtml(name)}</p>
//       <p><strong>Email:</strong> ${escapeHtml(email)}</p>
//       <p><strong>Message:</strong></p>
//       <p>${escapeHtml(message).replaceAll("\n", "<br>")}</p>
//     `,
//   });
// };

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

    const values = [name, email, message];

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

  // try {
  //   await sendContactEmail(contact);
  //   return res.status(202).json({ ok: true, message: "Message received." });
  // } catch (error) {
  //   console.error("Failed to process contact message:", error);
  //   return res.status(500).json({ ok: false, message: "Message could not be sent right now." });
  // }
});

async function startServer() {
  await createTable();
  app.listen(port, "0.0.0.0", () => {
    console.log(`DigitWise contact backend listening on port ${port}`);
  });
}

startServer();
