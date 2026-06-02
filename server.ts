import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.post("/api/webhooks/art-submission", async (req, res) => {
    const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
    const adminToken = process.env.ADMIN_SECRET_TOKEN;
    const publicAppUrl = process.env.PUBLIC_APP_URL || `http://localhost:${PORT}`;

    if (!webhookUrl) {
      console.error("DISCORD_WEBHOOK_URL is not set");
      return res.status(500).json({ error: "Webhook configuration missing" });
    }

    try {
      const { documentId, gameId, gameTitle, imageUrl } = req.body;

      // Point to our new secure Art Approval Portal
      const reviewUrl = `${publicAppUrl}/admin/art-queue/${documentId}`;

      const embed = {
        title: "🖼️ New Box Art Submission",
        color: 3447003, // Blue
        image: { url: imageUrl },
        fields: [
          { name: "Game Title", value: gameTitle || "Unknown", inline: true },
          { name: "Game ID", value: gameId || "Unknown", inline: true },
          { 
            name: "Admin Actions", 
            value: `[ 🔍 REVIEW IN APP ](${reviewUrl})`, 
            inline: false 
          }
        ],
        timestamp: new Date().toISOString(),
        footer: { text: "CritShelf Art Moderation System" },
      };

      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ embeds: [embed] }),
      });

      if (!response.ok) throw new Error(`Discord API responded with status ${response.status}`);
      res.json({ status: "success" });
    } catch (error) {
      console.error("Error sending Art Submission webhook:", error);
      res.status(500).json({ error: "Failed to send notification" });
    }
  });

  app.post("/api/webhooks/new-game", async (req, res) => {
    const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
    const adminToken = process.env.ADMIN_SECRET_TOKEN;
    const publicAppUrl = process.env.PUBLIC_APP_URL || `http://localhost:${PORT}`;

    if (!webhookUrl) {
      console.error("DISCORD_WEBHOOK_URL is not set");
      return res.status(500).json({ error: "Webhook configuration missing" });
    }

    try {
      const { gameId, gameTitle, bggId, importedBy } = req.body;

      const approveUrl = `${publicAppUrl}/admin/moderate-game?gameId=${gameId}&action=approve&adminToken=${adminToken}`;
      const rejectUrl = `${publicAppUrl}/admin/moderate-game?gameId=${gameId}&action=reject&adminToken=${adminToken}`;

      const embed = {
        title: "🎲 New Game Imported",
        color: 5763719, // Green
        fields: [
          { name: "Game Title", value: gameTitle || "Unknown", inline: true },
          { name: "BGG ID", value: String(bggId) || "Unknown", inline: true },
          { name: "Imported By", value: importedBy || "System", inline: true },
          { 
            name: "Admin Actions", 
            value: `[ ✅ APPROVE GAME ](${approveUrl}) ㅤ|ㅤ [ ❌ REJECT GAME ](${rejectUrl})`, 
            inline: false 
          }
        ],
        timestamp: new Date().toISOString(),
        footer: { text: "CritShelf Game Moderation" },
      };

      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ embeds: [embed] }),
      });

      if (!response.ok) throw new Error(`Discord API responded with status ${response.status}`);
      res.json({ status: "success" });
    } catch (error) {
      console.error("Error sending New Game webhook:", error);
      res.status(500).json({ error: "Failed to send notification" });
    }
  });

  app.post("/api/webhooks/discord", async (req, res) => {
    const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
    if (!webhookUrl) {
      console.error("DISCORD_WEBHOOK_URL is not set");
      return res.status(500).json({ error: "Webhook configuration missing" });
    }

    try {
      const { gameId, gameTitle, category, description, reportedBy } = req.body;

      const embed = {
        title: "🚨 New Game Data Report",
        color: 16724736, // Warning Orange/Red
        fields: [
          { name: "Game Title", value: gameTitle || "Unknown", inline: true },
          { name: "Game ID", value: gameId || "Unknown", inline: true },
          { name: "Category", value: category || "Unknown", inline: true },
          { name: "User UID", value: reportedBy || "Anonymous", inline: false },
          { name: "Description", value: description || "No description provided", inline: false },
        ],
        timestamp: new Date().toISOString(),
        footer: {
          text: "CritShelf Beta Feedback System",
        },
      };

      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ embeds: [embed] }),
      });

      if (!response.ok) {
        throw new Error(`Discord API responded with status ${response.status}`);
      }

      res.json({ status: "success" });
    } catch (error) {
      console.error("Error sending Discord webhook:", error);
      res.status(500).json({ error: "Failed to send notification" });
    }
  });

  app.post("/api/admin/seed", async (req, res) => {
    try {
      const { seedGames } = await import("./src/services/seedingService.js");
      const count = await seedGames();
      res.json({ status: "success", message: `Seeded ${count} games.` });
    } catch (error) {
      console.error("Seeding error:", error);
      res.status(500).json({ status: "error", message: error instanceof Error ? error.message : String(error) });
    }
  });

  app.post("/api/admin/enrich", async (req, res) => {
    try {
      const { enrichGames } = await import("./src/services/enrichmentService.js");
      const results = await enrichGames();
      res.json({ status: "success", results });
    } catch (error) {
      console.error("Enrichment error:", error);
      res.status(500).json({ status: "error", message: error instanceof Error ? error.message : String(error) });
    }
  });

  app.get("/api/wikidata/sparql", async (req, res) => {
    try {
      const query = req.query.query;
      if (!query) return res.status(400).json({ error: 'Missing query' });
      
      const WIKIDATA_SPARQL_URL = "https://query.wikidata.org/sparql";
      const targetUrl = `${WIKIDATA_SPARQL_URL}?query=${encodeURIComponent(query as string)}`;
      
      const response = await fetch(targetUrl, {
        headers: {
          "Accept": "application/sparql-results+json",
          "User-Agent": "CritShelf/1.0 (coreykern2040@gmail.com)",
        },
      });

      if (!response.ok) {
        throw new Error(`Wikidata Fetch Failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      res.json(data);
    } catch (err: any) {
      console.error("Wikidata SPARQL error:", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
