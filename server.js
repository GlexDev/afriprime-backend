import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import authRoutes from "./routes/auth.js";
import profileRoutes from "./routes/profile.js";

const app = express();

const PORT = process.env.PORT || 8080;
const NODE_ENV = process.env.NODE_ENV || "production";
const ORIGIN = process.env.ORIGIN;

if (!ORIGIN) {
  console.warn("WARNING: ORIGIN is not set. CORS will be wide open in development.");
}

app.use(
  cors({
    origin: ORIGIN || true,
    credentials: true,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
  })
);
app.use(helmet());
app.use(express.json());
app.use(morgan(NODE_ENV === "production" ? "combined" : "dev"));

app.get("/health", (req, res) => {
  res.json({ ok: true, service: "afriprime-backend", env: NODE_ENV });
});

app.use("/auth", authRoutes);
app.use("/api", profileRoutes);

app.listen(PORT, () => {
  console.log(`Afriprime backend listening on :${PORT}`);
});