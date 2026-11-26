require("dotenv").config({quiet: true});
const { error } = require("console");
const express = require("express");
const os = require("os");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const {ADZUNA_APP_ID, ADZUNA_APP_KEY, ADZUNA_COUNTRY = "za"}= process.env;


//Simple in memory cache (10min) so repeated searches don't use up API calls

const cache = new Map();
const TTL = 10 * 60 * 1000;

//Shows which server answered. Useful for the load balancer demo.

app.use((req, res, next) => {
    res.set("X-App-Server", os.hostname());
    next();
});


app.use(express.static(path.join(__dirname, "public")));

app.get("/api/server",(req, res) => res.json({ server:os.hostname() }));

app.get("/api/internships",async (req, res) =>{
    if (!ADZUNA_APP_ID || !ADZUNA_APP_KEY) {
        return res.status(500).json({ error: "The server is missing its Adzuna keys." });
    }

    const what = ("internship " + (req.query.what || "")).trim().slice(0, 100);
    const where = String(req.query.where || "").trim().slice(0,100);
    const key = what + "|" + where;

    const hit = cache.get(key);
    if (hit && Date.now() - hit.time <TTL) return res.json(hit.data);

    const params = new URLSearchParams({
        app_id: ADZUNA_APP_ID,
        app_key: ADZUNA_APP_KEY,
        results_per_page: 30,
        what,
        sort_by: "date"
    });
    if (where) params.set("where", where);

    try {
        const r = await fetch(`https://api.adzuna.com/v1/api/jobs/${ADZUNA_COUNTRY}/search/1?${params}`);
        if (r.status === 401 || r.status ===403) {
            return res.status(502).json({error: "The server's Adzuna keys were rejected."});
        }
        if (r.status === 429) {
            return res.status(429).json({ error: "Too many searches right now. Please wait a minute." });
        }
        if(!r.ok) {
            return res.status(502).json({ error: `The job service returned an error (${r.status}).` });
        }
        const data = await r.json();
        if (!Array.isArray(data.results)) {
            return res.status(502).json({error: "The job service sent an unexpected response." });
        }
        data.results = data.results.filter(j => /intern|trainee|learnership|graduate|apprentice/i.test(j.title || ""));
        cache.set(key, { time: Date.now(), data });
        res.json(data);
    } catch (e) {
        res.status(503).json({error:"Couldn't reach the job service. It may be down." });
    }
});
app.listen(PORT,() => console.log(`InternPath running on port ${PORT}`));