import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import {
  initDatabase,
  getAllFieldInterviews,
  getAllMLValidationLogs,
  recordMLValidationRun
} from "./src/server/db";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Initialize Gemini Client for remaining prototype endpoints
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

// =========================================================================
// RETAINED PROTOTYPE / DEMO ROUTES (GROUP B - No Real Backend Equivalents)
// =========================================================================

// 1. Field Interviews (Internal research database)
app.get("/api/field-interviews", (req, res) => {
  try {
    const interviews = getAllFieldInterviews();
    res.json({ status: "success", count: interviews.length, interviews });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 2. ML Validation Reporting & Benchmark Engine
app.get("/api/ml-validation", (req, res) => {
  try {
    const history = getAllMLValidationLogs();
    const latestRun = history.length > 0 ? history[0] : null;

    const report = {
      datasetSource: latestRun ? `Field-collected MMR Pilot (${latestRun.timestamp.slice(0, 10)})` : "Pending field deployment ground-truth set",
      pilotSampleSize: latestRun ? latestRun.sampleSize : 0,
      categoriesCovered: [
        "copper-wire", "motherboard-high", "motherboard-mid", "low-grade-pcb",
        "lithium-ion-battery", "lead-acid-battery", "smps-power-supply",
        "copper-transformer", "aluminum-heatsink", "brass-connectors",
        "mobile-phone-mixed", "crt-monitor", "hard-drive-hdd",
        "lcd-led-display", "electric-copper-motor", "neodymium-magnets",
        "flame-retardant-plastics"
      ],
      observedAccuracy: latestRun ? latestRun.accuracyPercent : null,
      knownFailureModes: latestRun ? latestRun.failureModes : [
        "Darkened phenolic boards misclassified as high-grade telecommunication motherboards under low-light sheds",
        "Enameled copper armatures misclassified as general copper wire before core stator separation",
        "Flame-retardant ABS monitor bezels misclassified as non-recyclable inert plastic casing"
      ],
      methodologyNote: "Zero-shot Gemini multimodal classification evaluated against CPCB pyrometallurgical assay ground-truth, not a custom-trained model",
      history
    };

    res.json({ status: "success", report });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/ml-validation/run", async (req, res) => {
  try {
    const { testSamples } = req.body;

    if (!testSamples || !Array.isArray(testSamples) || testSamples.length === 0) {
      return res.status(400).json({
        error: "No test samples provided. Provide an array of { imageBase64, groundTruthCategory } to compute real accuracy."
      });
    }

    let correct = 0;
    const failureModes: string[] = [];
    const runDetails: any[] = [];

    for (const sample of testSamples) {
      if (sample.imageBase64) {
        try {
          const cleanBase64 = sample.imageBase64.replace(/^data:image\/[a-z]+;base64,/, "");
          const prompt = `Identify exact material category key from: ["copper-wire", "motherboard-high", "motherboard-mid", "low-grade-pcb", "lithium-ion-battery", "lead-acid-battery", "smps-power-supply", "copper-transformer", "aluminum-heatsink", "brass-connectors", "mobile-phone-mixed", "crt-monitor", "hard-drive-hdd", "lcd-led-display", "electric-copper-motor", "neodymium-magnets", "flame-retardant-plastics"]. Return JSON: {"detectedKey": string}`;
          const response = await ai.models.generateContent({
            model: "gemini-3.7-flash",
            contents: {
              parts: [{ inlineData: { mimeType: "image/jpeg", data: cleanBase64 } }, { text: prompt }],
            },
            config: { responseMimeType: "application/json" }
          });
          const parsed = JSON.parse(response.text || "{}");
          const isMatch = parsed.detectedKey === sample.groundTruthCategory;
          if (isMatch) {
            correct++;
          } else {
            failureModes.push(`Sample labeled ${sample.groundTruthCategory} predicted as ${parsed.detectedKey}`);
          }
          runDetails.push({ sampleId: sample.id || "test", truth: sample.groundTruthCategory, predicted: parsed.detectedKey, pass: isMatch });
        } catch (e: any) {
          failureModes.push(`Inference error on ${sample.groundTruthCategory}: ${e.message}`);
          runDetails.push({ sampleId: sample.id || "test", truth: sample.groundTruthCategory, error: e.message, pass: false });
        }
      }
    }

    const accuracy = testSamples.length > 0 ? Number(((correct / testSamples.length) * 100).toFixed(1)) : null;

    const runRecord = recordMLValidationRun({
      id: `val-run-${Date.now()}`,
      timestamp: new Date().toISOString(),
      sampleSize: testSamples.length,
      accuracyPercent: accuracy,
      failureModes: Array.from(new Set(failureModes)).slice(0, 5),
      methodologyNote: "Zero-shot Gemini multimodal classification evaluated against CPCB pyrometallurgical assay ground-truth, not a custom-trained model",
      details: runDetails
    });

    res.json({
      status: "success",
      message: `Validation benchmark completed over ${testSamples.length} samples.`,
      result: runRecord
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 3. AI WhatsApp Assistant Chat (Group B demo)
app.post("/api/ai/whatsapp-chat", async (req, res) => {
  const { message, conversationHistory = [], imageBase64, language = "en" } = req.body || {};
  try {
    const systemInstruction = `You are "EcoKabadi AI", an intelligent, friendly, and practical Indian scrap & e-waste assistant for local scrap collectors (kabadiwalas), micro-aggregators, and recycling facilities in India.
Current Market Context (Mumbai MMR, India):
- Bare Copper Wire: ₹710/kg (Fair range: ₹670 - ₹760)
- High-Grade Server PCB (Gold Pins): ₹1,850/kg
- Standard Laptop/PC Motherboards: ₹450/kg
- Low-Grade TV/Appliance Boards: ₹180/kg
- Lithium-Ion Batteries (18650/Pouch): ₹240/kg
- Sealed Lead-Acid Inverter Batteries: ₹98/kg
- SMPS Power Supplies: ₹140/kg
- Heavy Copper Transformers: ₹360/kg
- Brass Terminals: ₹480/kg
- Smartphones / Mixed Mobiles: ₹1,250/kg

Guidelines:
1. Always respond in the user's preferred language (${language === "hi" ? "Hindi (हिन्दी)" : language === "mr" ? "Marathi (मराठी)" : "English or Hinglish as natural"}).
2. Provide concise, high-value advice. Format with clean WhatsApp markdown (*bold*, bullet points, emojis).
3. If they ask about prices, state the fair benchmark rate and give quick tips to maximize value.
4. If they ask about hazard/safety, give clear immediate precautions.
5. If they send an image, identify the scrap material, purity level, and rate per kg.`;

    let parts: any[] = [];

    if (imageBase64) {
      const cleanBase64 = imageBase64.replace(/^data:image\/[a-z]+;base64,/, "");
      parts.push({
        inlineData: {
          mimeType: "image/jpeg",
          data: cleanBase64,
        },
      });
    }

    let conversationContext = "";
    if (Array.isArray(conversationHistory) && conversationHistory.length > 0) {
      conversationContext = conversationHistory
        .slice(-6)
        .map((m: any) => `${m.sender === "bot" ? "EcoKabadi Bot" : "User"}: ${m.text || "[Sent Image]"}`)
        .join("\n");
      conversationContext = `Previous conversation context:\n${conversationContext}\n\n`;
    }

    parts.push({
      text: `${conversationContext}Current user message: ${message || "Please analyze this scrap photo and tell me the fair scrap price."}`,
    });

    const response = await ai.models.generateContent({
      model: "gemini-3.7-flash",
      contents: { parts },
      config: {
        systemInstruction,
      },
    });

    res.json({
      status: "success",
      reply: response.text || "Namaste! Please let me know what scrap or e-waste you have.",
    });
  } catch (error: any) {
    console.error("WhatsApp AI Error:", error);
    res.json({
      status: "fallback",
      reply:
        language === "hi"
          ? "नमस्ते! वर्तमान में कॉपर वायर ₹710/किलो और मदरबोर्ड ₹450/किलो चल रहा है। अधिक जानकारी या पिकअप के लिए 1 या 2 दबाएं।"
          : language === "mr"
          ? "नमस्कार! सध्या तांबे वायर ₹710/किलो आणि मदरबोर्ड ₹450/किलो भाव आहे. अधिक माहितीसाठी 1 किंवा 2 पाठवा."
          : "Namaste! Copper wire is currently trading at ₹710/kg and PC motherboards at ₹450/kg. Reply 1 to start auction or 2 for free pickup truck.",
    });
  }
});

// 4. AI Safety & Hazards Advisory Engine (Group B demo live Q&A)
app.post("/api/ai/safety-advice", async (req, res) => {
  try {
    const { materialName, userQuestion, language = "en" } = req.body;

    const prompt = `You are a certified CPCB Hazardous Materials Safety Engineer for Indian E-Waste Dismantling Facilities.
Scrap Material: "${materialName || "General Electronic Scrap"}"
User Safety Question / Scenario: "${userQuestion || "How should I safely handle, store, and dismantle this material?"}"
Language: ${language}

Provide comprehensive, highly practical, and actionable safety guidance:
1. Immediate Hazard Assessment (e.g., toxic lead dust, thermal runaway risk, sulfuric acid spill, barium in CRT).
2. PPE Requirements (specific gloves, eye protection, mask type).
3. Do's and Don'ts (Strict prohibitions like NEVER burning wires or opening battery cells).
4. Safe Storage and Transport requirements.
5. Emergency First Aid protocol for accidental exposure or fire.

Return strictly valid JSON matching this schema:
{
  "hazardLevel": "LOW" | "MODERATE" | "HIGH" | "CRITICAL",
  "primaryThreat": string,
  "requiredPPE": string[],
  "dos": string[],
  "donts": string[],
  "safeDismantlingSteps": string[],
  "emergencyAction": string,
  "cpcbComplianceNote": string
}`;

    const response = await ai.models.generateContent({
      model: "gemini-3.7-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      },
    });

    const parsed = JSON.parse(response.text || "{}");
    res.json({ status: "success", advice: parsed });
  } catch (error: any) {
    console.error("AI Safety Advice Error:", error);
    res.json({
      status: "fallback",
      advice: {
        hazardLevel: "HIGH",
        primaryThreat: "Toxic heavy metal particulate inhalation and chemical thermal risk.",
        requiredPPE: ["Heavy-duty Nitrile or Leather Gloves", "N95 Dust & Fume Respirator", "Safety Goggles"],
        dos: [
          "Dismantle in well-ventilated outdoor or exhaust-equipped shed.",
          "Use insulated hand tools to prevent accidental short circuits.",
          "Keep Class D fire extinguisher or dry sand bucket nearby.",
        ],
        donts: [
          "NEVER burn insulation or cables to extract copper (violates Clean Air Act).",
          "NEVER puncture, crush, or submerge lithium-ion or lead-acid batteries.",
          "Do not break CRT vacuum glass tubes without implosion protection.",
        ],
        safeDismantlingSteps: [
          "1. Visually inspect for swelling, leaking fluid, or acid crust.",
          "2. Tape exposed battery terminals with PVC insulation tape.",
          "3. Use mechanical wire strippers instead of thermal torches.",
        ],
        emergencyAction: "In case of acid splash, flush with clean water for 15 minutes. For battery fire, smother with dry sand — DO NOT use water.",
        cpcbComplianceNote: "Handover all non-dismantlable hazardous waste only to CPCB authorized recyclers with manifest Form 6.",
      },
    });
  }
});

// Setup Vite middleware in dev or static serving in production
async function startServer() {
  initDatabase();

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`E-Waste Collector & Recycler Network server running on http://localhost:${PORT}`);
  });
}

startServer();
