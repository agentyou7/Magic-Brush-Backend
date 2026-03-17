import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { env } from "./lib/env";
import { authRouter } from "./routes/auth";
import { contactRouter } from "./routes/contact";
import { adminRouter } from "./routes/admin";
import { servicesRouter } from "./routes/services";

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: env.CORS_ORIGIN.split(",").map((origin) => origin.trim()),
    credentials: true,
  })
);
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

app.get("/api/health", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "API is healthy",
  });
});

app.use("/api/auth", authRouter);
app.use("/api/contact", contactRouter);
app.use("/api/services", servicesRouter);
app.use("/api/admin", adminRouter);

app.use((_req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

app.listen(env.PORT, () => {
  console.log(`MagicBrush backend listening on http://localhost:${env.PORT}`);
});
