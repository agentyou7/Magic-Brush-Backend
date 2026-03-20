import "dotenv/config";
import { createServer } from "http";
import { parse } from "url";
import next from "next";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import path from "path";
import { env } from "./lib/env";
import { authRouter } from "./routes/auth";
import { contactRouter } from "./routes/contact";
import { adminRouter } from "./routes/admin";
import { servicesRouter } from "./routes/services";

const dev = process.env.NODE_ENV !== "production";
const hostname = dev ? "localhost" : "0.0.0.0";
const port = env.PORT;

// Initialize Next.js app
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = express();
  server.set("trust proxy", 1);
  const isDev = process.env.NODE_ENV !== "production";

  // Middleware
  server.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: isDev
            ? ["'self'", "'unsafe-inline'", "'unsafe-eval'"]
            : ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
          imgSrc: ["'self'", "data:", "blob:", "https:"],
          fontSrc: ["'self'", "data:", "https://cdnjs.cloudflare.com"],
          connectSrc: isDev
            ? ["'self'", "https:", "ws:", "wss:"]
            : ["'self'", "https:"],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          frameAncestors: ["'self'"],
          upgradeInsecureRequests: isDev ? null : [],
        },
      },
    })
  );
  server.use(
    cors({
      origin: env.CORS_ORIGIN.split(",").map((origin) => origin.trim()),
      credentials: true,
    })
  );
  server.use(express.json({ limit: "1mb" }));
  server.use(cookieParser());

  // Serve static files from public directory
  server.use(express.static(path.join(__dirname, '../public')));

  // API Routes
  server.get("/api/health", (_req, res) => {
    res.status(200).json({
      success: true,
      message: "API is healthy",
    });
  });

  server.use("/api/auth", authRouter);
  server.use("/api/contact", contactRouter);
  server.use("/api/services", servicesRouter);
  server.use("/api/admin", adminRouter);

  // Handle all other requests with Next.js
  server.use((req, res) => {
    const parsedUrl = parse(req.url!, true);
    handle(req, res, parsedUrl);
  });

  createServer(server).listen(port);
});
