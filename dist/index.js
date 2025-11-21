var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// vite.config.ts
var vite_config_exports = {};
__export(vite_config_exports, {
  default: () => vite_config_default
});
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
var vite_config_default;
var init_vite_config = __esm({
  async "vite.config.ts"() {
    "use strict";
    vite_config_default = defineConfig({
      plugins: [
        react(),
        ...process.env.NODE_ENV !== "production" ? [
          (await import("@replit/vite-plugin-runtime-error-modal")).default(),
          ...process.env.REPL_ID !== void 0 ? [
            await import("@replit/vite-plugin-cartographer").then(
              (m) => m.cartographer()
            ),
            await import("@replit/vite-plugin-dev-banner").then(
              (m) => m.devBanner()
            )
          ] : []
        ] : []
      ],
      resolve: {
        alias: {
          "@": path.resolve(import.meta.dirname, "client", "src"),
          "@shared": path.resolve(import.meta.dirname, "shared"),
          "@assets": path.resolve(import.meta.dirname, "attached_assets")
        }
      },
      root: path.resolve(import.meta.dirname, "client"),
      build: {
        outDir: path.resolve(import.meta.dirname, "dist/public"),
        emptyOutDir: true
      },
      server: {
        fs: {
          strict: true,
          deny: ["**/.*"]
        }
      }
    });
  }
});

// server/index.ts
import "dotenv/config";
import express2 from "express";

// server/routes.ts
import { createServer } from "http";

// server/storage.ts
import { randomUUID } from "crypto";
var MemStorage = class {
  users;
  contacts;
  constructor() {
    this.users = /* @__PURE__ */ new Map();
    this.contacts = /* @__PURE__ */ new Map();
  }
  async getUser(id) {
    return this.users.get(id);
  }
  async getUserByUsername(username) {
    return Array.from(this.users.values()).find(
      (user) => user.username === username
    );
  }
  async createUser(insertUser) {
    const id = randomUUID();
    const user = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }
  async createContact(insertContact) {
    const id = randomUUID();
    const contact = {
      ...insertContact,
      phone: insertContact.phone ?? null,
      id,
      createdAt: /* @__PURE__ */ new Date()
    };
    this.contacts.set(id, contact);
    return contact;
  }
  async getAllContacts() {
    return Array.from(this.contacts.values()).sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );
  }
};
var storage = new MemStorage();

// shared/schema.ts
import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
var users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull()
});
var insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true
});
var contacts = pgTable("contacts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: varchar("phone"),
  message: text("message").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull()
});
var insertContactSchema = createInsertSchema(contacts).omit({
  id: true,
  createdAt: true
}).extend({
  email: z.string().email("Please enter a valid email address"),
  name: z.string().min(2, "Name must be at least 2 characters"),
  phone: z.string().transform((v) => v.trim()).transform((v) => v.replace(/[^\d+]/g, "")).refine(
    (v) => v.length === 0 || /^\+?[1-9]\d{6,14}$/.test(v),
    {
      message: "Invalid phone number format. Use E.164 (e.g., +919876543210)"
    }
  ).optional(),
  message: z.string().min(10, "Message must be at least 10 characters")
});

// server/routes.ts
import { fromZodError } from "zod-validation-error";

// server/mailer.ts
import nodemailer from "nodemailer";
function getEnv(name, fallback = "") {
  return (process.env[name] || fallback).trim();
}
var CONTACT_RECEIVER = getEnv(
  "CONTACT_RECEIVER_EMAIL",
  "sundhararajan.offical@gmail.com"
);
async function sendContactEmail(contact) {
  const host = getEnv("EMAIL_HOST");
  const portStr = getEnv("EMAIL_PORT");
  const service = getEnv("EMAIL_SERVICE");
  const user = getEnv("EMAIL_USER");
  const pass = getEnv("EMAIL_PASS");
  let transporter;
  let usingTest = false;
  if (!user || !pass) {
    const env = (process.env.NODE_ENV || "").toLowerCase();
    if (env === "development") {
      const testAccount = await nodemailer.createTestAccount();
      usingTest = true;
      transporter = nodemailer.createTransport({
        host: "smtp.ethereal.email",
        port: 587,
        secure: false,
        auth: { user: testAccount.user, pass: testAccount.pass }
      });
      console.warn(
        "Email not configured. Using Ethereal test SMTP for development. Set EMAIL_USER and EMAIL_PASS for real emails."
      );
    } else {
      console.warn(
        "Email not configured: set EMAIL_USER and EMAIL_PASS (and optionally EMAIL_HOST/EMAIL_PORT). Skipping send."
      );
      return { success: false };
    }
  } else {
    if (service) {
      transporter = nodemailer.createTransport({
        service,
        auth: { user, pass }
      });
    } else {
      const port = portStr ? parseInt(portStr, 10) : 465;
      transporter = nodemailer.createTransport({
        host: host || "smtp.gmail.com",
        port,
        secure: port === 465,
        // true for 465, false for other ports
        auth: { user, pass }
      });
    }
  }
  const subject = `New contact message from ${contact.name}`;
  const normalizedPhone = (contact.phone || "").replace(/[^\d+]/g, "");
  const textLines = [
    `Name: ${contact.name}`,
    contact.phone ? `Phone Number: ${contact.phone}` : void 0,
    `Email: ${contact.email}`,
    "",
    "Message:",
    contact.message
  ].filter(Boolean);
  const text2 = textLines.join("\n");
  const html = `
    <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; line-height:1.6;">
      <h2 style="margin:0 0 12px;">New contact message</h2>
      <p><strong>Name:</strong> ${contact.name}</p>
      ${normalizedPhone ? `<p><strong>Phone Number:</strong> ${normalizedPhone}</p>` : ""}
      <p><strong>Email:</strong> ${contact.email}</p>
      <p style="white-space:pre-line"><strong>Message:</strong><br/>${contact.message}</p>
    </div>
  `;
  const info = await transporter.sendMail({
    from: {
      name: contact.name || "Portfolio Contact",
      address: user || "no-reply@example.com"
    },
    to: CONTACT_RECEIVER,
    replyTo: contact.email,
    subject,
    text: text2,
    html
  });
  if (usingTest) {
    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) {
      console.log(`\u{1F4E7} Ethereal preview URL: ${previewUrl}`);
      return { success: true, messageId: info.messageId, previewUrl };
    }
  }
  return { success: true, messageId: info.messageId };
}

// server/routes.ts
async function registerRoutes(app2) {
  app2.post("/api/contacts", async (req, res) => {
    try {
      const validatedData = insertContactSchema.parse(req.body);
      const contact = await storage.createContact(validatedData);
      try {
        const result = await sendContactEmail(validatedData);
        if (!result.success) {
          console.warn("Contact created, but email not sent.");
        }
      } catch (mailError) {
        console.error("Failed to send contact email:", mailError);
      }
      res.status(201).json(contact);
    } catch (error) {
      if (error.name === "ZodError") {
        const validationError = fromZodError(error);
        return res.status(400).json({
          error: "Validation failed",
          details: validationError.message
        });
      }
      console.error("Error creating contact:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
  app2.get("/api/contacts", async (_req, res) => {
    try {
      const contacts2 = await storage.getAllContacts();
      res.json(contacts2);
    } catch (error) {
      console.error("Error fetching contacts:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
  const httpServer = createServer(app2);
  return httpServer;
}

// server/vite.ts
import express from "express";
import fs from "fs";
import path2 from "path";
import { nanoid } from "nanoid";
function log(message, source = "express") {
  const formattedTime = (/* @__PURE__ */ new Date()).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}
async function setupVite(app2, server) {
  const { createServer: createViteServer, createLogger } = await import("vite");
  const viteLogger = createLogger();
  const viteConfigModule = await init_vite_config().then(() => vite_config_exports);
  const viteConfig = viteConfigModule.default;
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true
  };
  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      }
    },
    server: serverOptions,
    appType: "custom"
  });
  app2.use(vite.middlewares);
  app2.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    try {
      const clientTemplate = path2.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html"
      );
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e);
      next(e);
    }
  });
}
function serveStatic(app2) {
  const distPath = path2.resolve(import.meta.dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }
  app2.use(express.static(distPath));
  app2.use("*", (_req, res) => {
    res.sendFile(path2.resolve(distPath, "index.html"));
  });
}

// server/index.ts
var app = express2();
app.use(
  express2.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    }
  })
);
app.use(express2.urlencoded({ extended: false }));
app.use((req, res, next) => {
  const allowedOrigin = process.env.CORS_ORIGIN;
  const origin = req.headers.origin;
  if (allowedOrigin && origin === allowedOrigin) {
    res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
    if (req.method === "OPTIONS") return res.sendStatus(204);
  }
  next();
});
app.use((req, res, next) => {
  const start = Date.now();
  const path3 = req.path;
  let capturedJsonResponse;
  const originalJson = res.json;
  res.json = function(bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalJson.apply(res, [bodyJson, ...args]);
  };
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path3.startsWith("/api")) {
      let logLine = `${req.method} ${path3} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      const maxLen = path3 === "/api/contacts" ? 300 : 100;
      if (logLine.length > maxLen) logLine = logLine.slice(0, maxLen - 1) + "\u2026";
      log(logLine);
    }
  });
  next();
});
(async () => {
  const server = await registerRoutes(app);
  app.use((err, _req, res, _next) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
    log(`\u274C ${message}`);
  });
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }
  const port = parseInt(process.env.PORT || "5000", 10);
  const host = process.env.HOST || "localhost";
  server.listen(port, host, () => {
    log(`\u2705 Server running at http://${host}:${port}`);
  });
})();
