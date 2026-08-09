const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, "data");
const ADMINS_FILE = path.join(DATA_DIR, "admins.json");
const REVIEWS_FILE = path.join(DATA_DIR, "reviews.json");

const GITHUB_TOKEN = process.env.GITHUB_TOKEN || "";
const GITHUB_REPO = process.env.GITHUB_REPO || ""; // owner/repo
const GITHUB_REVIEWS_PATH = process.env.GITHUB_REVIEWS_PATH || "data/reviews.json";

app.use(cors());
app.use(express.json({ limit: "256kb" }));
app.use(express.static(path.join(__dirname, "public")));

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8");
}

function sanitize(text, max = 2000) {
  return String(text || "")
    .replace(/\r\n/g, "\n")
    .trim()
    .slice(0, max);
}

function withAdminStats(admins, reviews) {
  return admins
    .map((admin) => {
      const adminReviews = reviews.filter((r) => r.adminId === admin.id);
      const count = adminReviews.length;
      const avg =
        count === 0
          ? 0
          : adminReviews.reduce((sum, r) => sum + r.rating, 0) / count;

      return {
        ...admin,
        reviewCount: count,
        averageRating: Math.round(avg * 10) / 10,
      };
    })
    .sort((a, b) => {
      if (b.averageRating !== a.averageRating) {
        return b.averageRating - a.averageRating;
      }
      if (b.reviewCount !== a.reviewCount) {
        return b.reviewCount - a.reviewCount;
      }
      return a.name.localeCompare(b.name, "ar");
    });
}

async function githubGetReviews() {
  if (!GITHUB_TOKEN || !GITHUB_REPO) return null;

  const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/${GITHUB_REVIEWS_PATH}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "star-group-app",
    },
  });

  if (res.status === 404) return [];
  if (!res.ok) {
    console.error("GitHub read failed:", res.status, await res.text());
    return null;
  }

  const data = await res.json();
  const content = Buffer.from(data.content, "base64").toString("utf8");
  return { reviews: JSON.parse(content || "[]"), sha: data.sha };
}

async function githubSaveReviews(reviews, sha) {
  if (!GITHUB_TOKEN || !GITHUB_REPO) return false;

  const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/${GITHUB_REVIEWS_PATH}`;
  const body = {
    message: `chore: update reviews (${reviews.length})`,
    content: Buffer.from(JSON.stringify(reviews, null, 2), "utf8").toString("base64"),
    sha,
  };

  const res = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      "User-Agent": "star-group-app",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    console.error("GitHub write failed:", res.status, await res.text());
    return false;
  }
  return true;
}

async function loadReviews() {
  const remote = await githubGetReviews();
  if (remote && Array.isArray(remote.reviews)) {
    writeJson(REVIEWS_FILE, remote.reviews);
    return { reviews: remote.reviews, sha: remote.sha };
  }
  return { reviews: readJson(REVIEWS_FILE, []), sha: remote?.sha };
}

async function saveReviews(reviews, sha) {
  writeJson(REVIEWS_FILE, reviews);
  await githubSaveReviews(reviews, sha);
}

app.get("/api/admins", async (_req, res) => {
  try {
    const admins = readJson(ADMINS_FILE, []);
    const { reviews } = await loadReviews();
    res.json(withAdminStats(admins, reviews));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "تعذر تحميل الأدمنية" });
  }
});

app.get("/api/reviews", async (req, res) => {
  try {
    const { reviews } = await loadReviews();
    const adminId = req.query.adminId;
    const filtered = adminId
      ? reviews.filter((r) => r.adminId === adminId)
      : reviews.slice();

    filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json(filtered);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "تعذر تحميل الآراء" });
  }
});

app.post("/api/reviews", async (req, res) => {
  try {
    const admins = readJson(ADMINS_FILE, []);
    const loaded = await loadReviews();
    const reviews = loaded.reviews;

    const adminId = sanitize(req.body.adminId, 64);
    const authorRaw = sanitize(req.body.author, 80);
    const text = sanitize(req.body.text, 5000);
    const rating = Number(req.body.rating);

    const admin = admins.find((a) => a.id === adminId);
    if (!admin) {
      return res.status(400).json({ error: "الأدمن غير موجود" });
    }

    const author = authorRaw || "زائر تلقائي";

    if (!text) {
      return res.status(400).json({ error: "اكتب رأيك (حتى حرف واحد يكفي)" });
    }

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ error: "لازم تختار تقييم بالنجوم" });
    }

    const review = {
      id: `rev-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      adminId: admin.id,
      adminName: admin.name,
      author,
      text,
      rating,
      createdAt: new Date().toISOString(),
    };

    reviews.unshift(review);
    await saveReviews(reviews, loaded.sha);

    res.status(201).json(review);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "تعذر حفظ الرأي" });
  }
});

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    brand: "STAR",
    persistence: Boolean(GITHUB_TOKEN && GITHUB_REPO),
  });
});

app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`STAR site running at http://localhost:${PORT}`);
});
