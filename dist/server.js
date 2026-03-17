"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const env_1 = require("./lib/env");
const auth_1 = require("./routes/auth");
const contact_1 = require("./routes/contact");
const admin_1 = require("./routes/admin");
const services_1 = require("./routes/services");
const app = (0, express_1.default)();
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({
    origin: env_1.env.CORS_ORIGIN.split(",").map((origin) => origin.trim()),
    credentials: true,
}));
app.use(express_1.default.json({ limit: "1mb" }));
app.use((0, cookie_parser_1.default)());
app.get("/api/health", (_req, res) => {
    res.status(200).json({
        success: true,
        message: "API is healthy",
    });
});
app.use("/api/auth", auth_1.authRouter);
app.use("/api/contact", contact_1.contactRouter);
app.use("/api/services", services_1.servicesRouter);
app.use("/api/admin", admin_1.adminRouter);
app.use((_req, res) => {
    res.status(404).json({
        success: false,
        message: "Route not found",
    });
});
app.listen(env_1.env.PORT, () => {
    console.log(`MagicBrush backend listening on http://localhost:${env_1.env.PORT}`);
});
