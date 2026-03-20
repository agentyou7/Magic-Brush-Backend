"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const http_1 = require("http");
const url_1 = require("url");
const next_1 = __importDefault(require("next"));
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const path_1 = __importDefault(require("path"));
const env_1 = require("./lib/env");
const auth_1 = require("./routes/auth");
const contact_1 = require("./routes/contact");
const admin_1 = require("./routes/admin");
const services_1 = require("./routes/services");
const dev = process.env.NODE_ENV !== "production";
const hostname = dev ? "localhost" : "0.0.0.0";
const port = env_1.env.PORT;
// Initialize Next.js app
const app = (0, next_1.default)({ dev, hostname, port });
const handle = app.getRequestHandler();
app.prepare().then(() => {
    const server = (0, express_1.default)();
    server.set("trust proxy", 1);
    const isDev = process.env.NODE_ENV !== "production";
    // Middleware
    server.use((0, helmet_1.default)({
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
    }));
    server.use((0, cors_1.default)({
        origin: env_1.env.CORS_ORIGIN.split(",").map((origin) => origin.trim()),
        credentials: true,
    }));
    server.use(express_1.default.json({ limit: "1mb" }));
    server.use((0, cookie_parser_1.default)());
    // Serve static files from public directory
    server.use(express_1.default.static(path_1.default.join(__dirname, '../public')));
    // API Routes
    server.get("/api/health", (_req, res) => {
        res.status(200).json({
            success: true,
            message: "API is healthy",
        });
    });
    server.use("/api/auth", auth_1.authRouter);
    server.use("/api/contact", contact_1.contactRouter);
    server.use("/api/services", services_1.servicesRouter);
    server.use("/api/admin", admin_1.adminRouter);
    // Handle all other requests with Next.js
    server.use((req, res) => {
        const parsedUrl = (0, url_1.parse)(req.url, true);
        handle(req, res, parsedUrl);
    });
    (0, http_1.createServer)(server).listen(port);
});
