// server.js
import express from "express";
import cors from "cors";
import crypto from "crypto";
import { supabase } from "./supabase.js";

const app = express();

// Allow only your Mini App origin (Cloudflare Pages)
const ORIGIN = process.env.ORIGIN; // e.g. https://afriprime-mini.pages.dev
app.use(cors({ origin: ORIGIN, credentials: true }));
app.use(express.json());

// -------- Health --------
app.get("/health", (req, res) => res.json({ ok: true }));

// -------- Telegram initData validation --------
// POST /auth/telegram/validate  { initData }
app.post("/auth/telegram/validate", (req, res) => {
  try {
    const { initData } = req.body || {};
    if (!initData) {
      return res.status(400).json({ ok: false, error: "missing_init_data" });
    }

    const botToken = process.env.BOT_TOKEN;
    if (!botToken) {
      return res.status(500).json({ ok: false, error: "bot_token_missing" });
    }

    const params = new URLSearchParams(initData);
    const hash = params.get("hash");
    params.delete("hash");

    const dataCheckString = [...params.entries()]
      .map(([k, v]) => `${k}=${v}`)
      .sort()
      .join("\n");

    const secretKey = crypto
      .createHmac("sha256", "WebAppData")
      .update(botToken)
      .digest();

    const signature = crypto
      .createHmac("sha256", secretKey)
      .update(dataCheckString)
      .digest("hex");

    if (signature !== hash) {
      return res.status(401).json({ ok: false, error: "invalid_init_data" });
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
});

// -------- Profile Read --------
// GET /api/profile?telegram_id=123
app.get("/api/profile", async (req, res) => {
  try {
    const { telegram_id } = req.query;
    if (!telegram_id) {
      return res.status(400).json({ ok: false, error: "missing_telegram_id" });
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("telegram_id", Number(telegram_id))
      .maybeSingle();

    if (error) throw error;
    return res.json({ ok: true, profile: data || null });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
});

// -------- Profile Upsert --------
// POST /api/profile  { telegram_id, display_name, age, location }
app.post("/api/profile", async (req, res) => {
  try {
    const { telegram_id, display_name, age, location } = req.body || {};
    if (!telegram_id) {
      return res.status(400).json({ ok: false, error: "missing_telegram_id" });
    }

    const row = {
      telegram_id: Number(telegram_id),
      display_name: display_name ?? null,
      age: age ?? null,
      location: location ?? null
    };

    const { data, error } = await supabase
      .from("profiles")
      .upsert(row, { onConflict: "telegram_id", ignoreDuplicates: false })
      .select()
      .maybeSingle();

    if (error) throw error;
    return res.json({ ok: true, profile: data });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
});

// -------- Start --------
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`AfriPrime backend listening on :${PORT}`);
});
