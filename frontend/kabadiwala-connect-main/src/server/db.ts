import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";
import { createHash } from "node:crypto";

export function computeServerSha256(payload: {
  collectorName: string;
  finalPriceInr: number;
  materialKey: string;
  ratePerKgInr: number;
  receiptNumber: string;
  recyclerLicense: string;
  timestamp: string;
  weightKg: number;
}): string {
  const sorted = JSON.stringify({
    collectorName: (payload.collectorName || "").trim(),
    finalPriceInr: Number(payload.finalPriceInr || 0),
    materialKey: (payload.materialKey || "").trim(),
    ratePerKgInr: Number(payload.ratePerKgInr || 0),
    receiptNumber: (payload.receiptNumber || "").trim(),
    recyclerLicense: (payload.recyclerLicense || "").trim(),
    timestamp: (payload.timestamp || "").trim(),
    weightKg: Number(payload.weightKg || 0),
  });
  return createHash("sha256").update(sorted).digest("hex");
}

// Ensure data directory exists
const DB_PATH = path.join(process.cwd(), "kabadiwala.db");
export const db = new Database(DB_PATH);

// Initialize schema
export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS materials (
      key TEXT PRIMARY KEY,
      name_en TEXT NOT NULL,
      name_hi TEXT NOT NULL,
      name_mr TEXT NOT NULL,
      fair_price REAL NOT NULL,
      min_price REAL NOT NULL,
      max_price REAL NOT NULL,
      unit TEXT NOT NULL,
      category TEXT NOT NULL,
      description_en TEXT NOT NULL,
      description_hi TEXT NOT NULL,
      description_mr TEXT NOT NULL,
      sample_image TEXT NOT NULL,
      purity_benchmark TEXT NOT NULL,
      recoverable_metals_json TEXT NOT NULL,
      hazard_level TEXT NOT NULL,
      price_history_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS recyclers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      license_no TEXT NOT NULL,
      cpcb_certified INTEGER NOT NULL,
      distance_km REAL NOT NULL,
      rating REAL NOT NULL,
      reviews_count INTEGER NOT NULL,
      phone TEXT NOT NULL,
      whatsapp TEXT NOT NULL,
      address TEXT NOT NULL,
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      accepted_materials_json TEXT NOT NULL,
      pickup_min_weight_kg REAL NOT NULL,
      provides_free_pickup INTEGER NOT NULL,
      price_bonus_percent REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS receipts (
      id TEXT PRIMARY KEY,
      lot_id TEXT NOT NULL,
      date TEXT NOT NULL,
      collector_name TEXT NOT NULL,
      collector_phone TEXT NOT NULL,
      recycler_name TEXT NOT NULL,
      recycler_license TEXT NOT NULL,
      material_key TEXT NOT NULL,
      material_name TEXT NOT NULL,
      weight_kg REAL NOT NULL,
      purity_grade TEXT NOT NULL,
      rate_per_kg REAL NOT NULL,
      final_price_inr REAL NOT NULL,
      payment_method TEXT NOT NULL,
      status TEXT NOT NULL,
      qr_verification_code TEXT NOT NULL,
      photo_url TEXT,
      cpcb_manifest_number TEXT NOT NULL,
      gps_lat REAL,
      gps_lng REAL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS field_interviews (
      id TEXT PRIMARY KEY,
      collector_name TEXT NOT NULL,
      location TEXT NOT NULL,
      years_in_trade INTEGER,
      daily_volume_kg TEXT NOT NULL,
      middleman_rate_note TEXT NOT NULL,
      pain_points_json TEXT NOT NULL,
      quotes_raw_json TEXT NOT NULL,
      photo_refs_json TEXT NOT NULL,
      interview_date TEXT NOT NULL,
      interviewer_notes TEXT,
      status TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ml_validation_log (
      id TEXT PRIMARY KEY,
      timestamp TEXT NOT NULL,
      sample_size INTEGER NOT NULL,
      accuracy_percent REAL,
      failure_modes_json TEXT NOT NULL,
      methodology_note TEXT NOT NULL,
      details_json TEXT NOT NULL
    );
  `);

  // Seed baseline data if tables are empty
  seedBaselineData();
}

function seedBaselineData() {
  const countMaterials = db.prepare("SELECT COUNT(*) as cnt FROM materials").get() as { cnt: number };
  if (countMaterials.cnt === 0) {
    console.log("Seeding SQLite database with 16 CPCB material categories...");
    const insertMat = db.prepare(`
      INSERT INTO materials (
        key, name_en, name_hi, name_mr, fair_price, min_price, max_price,
        unit, category, description_en, description_hi, description_mr,
        sample_image, purity_benchmark, recoverable_metals_json, hazard_level, price_history_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const SEED_MATERIALS = [
      {
        key: "copper-wire",
        name: { en: "Copper Wire & Transformer Windings", hi: "तांबे का तार और वाइंडिंग", mr: "तांब्याची वायर आणि वाइंडिंग" },
        fair: 710, min: 670, max: 760, unit: "kg", category: "Precious & Base Metals",
        desc: { en: "Pure 99.9% Electrolytic Copper wiring from power cables and transformers.", hi: "बिजली के तारों और ट्रांसफार्मर से 99.9% शुद्ध कॉपर वायर।", mr: "पॉवर केबल्समधील शुद्ध तांब्याची वायर." },
        img: "https://images.unsplash.com/photo-1590496793929-36417d3117de?auto=format&fit=crop&w=600&q=80",
        purity: "Grade-1 Bare Bright (99.2% Cu)", metals: ["Copper 99%", "Silver Trace"], hazard: "LOW", history: [685, 690, 695, 705, 700, 715, 710]
      },
      {
        key: "motherboard-high",
        name: { en: "High-Grade Server & Telecom Motherboard", hi: "हाई-ग्रेड सर्वर व टेलीकॉम मदरबोर्ड", mr: "हाय-ग्रेड सर्व्हर व टेलिकॉम मदरबोर्ड" },
        fair: 1850, min: 1650, max: 2100, unit: "kg", category: "Circuit Boards",
        desc: { en: "Gold-plated edge connectors, multi-layer server motherboards, dense BGA chipsets.", hi: "सोने की परत वाले सर्वर मदरबोर्ड और उच्च चिपसेट।", mr: "सोन्याचा मुलामा असलेले सर्व्हर मदरबोर्ड्स." },
        img: "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=600&q=80",
        purity: "Gold Flash > 0.8g/kg, Palladium 0.05g/kg", metals: ["Gold", "Silver", "Palladium", "Copper"], hazard: "MEDIUM", history: [1780, 1800, 1820, 1810, 1840, 1860, 1850]
      },
      {
        key: "motherboard-mid",
        name: { en: "Standard PC & Laptop Motherboard", hi: "मानक पीसी और लैपटॉप मदरबोर्ड", mr: "स्टँडर्ड कॉम्प्युटर व लॅपटॉप मदरबोर्ड" },
        fair: 450, min: 400, max: 520, unit: "kg", category: "Circuit Boards",
        desc: { en: "Green multi-layer PCB boards from desktop computers and laptops.", hi: "डेस्कटॉप कंप्यूटर और लैपटॉप से ग्रीन पीसीबी बोर्ड।", mr: "डेस्कटॉप आणि लॅपटॉपमधील हिरवे मदरबोर्ड्स." },
        img: "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&w=600&q=80",
        purity: "Commercial Grade B (Gold 0.15g/kg)", metals: ["Copper", "Tin", "Gold Trace"], hazard: "MEDIUM", history: [430, 435, 440, 445, 450, 455, 450]
      },
      {
        key: "low-grade-pcb",
        name: { en: "Single-Sided Phenolic & Brown PCB", hi: "सिंगल-साइडेड ब्राउन पीसीबी", mr: "सिंगल-साइडेड ब्राऊन पीसीबी" },
        fair: 180, min: 150, max: 220, unit: "kg", category: "Circuit Boards",
        desc: { en: "Low grade phenolic paper resin boards from televisions and radios.", hi: "टीवी, रेडियो और साधारण इलेक्ट्रॉनिक उपकरणों से सिंगल लेयर पीसीबी।", mr: "टीव्ही आणि रेडिओमधील सिंगल लेयर ब्राऊन बोर्ड्स." },
        img: "https://images.unsplash.com/photo-1563770660941-20978e870e26?auto=format&fit=crop&w=600&q=80",
        purity: "Phenolic Base (Copper trace < 8%)", metals: ["Copper 8%", "Tin-Lead Solder"], hazard: "MEDIUM", history: [175, 178, 179, 180, 182, 180, 180]
      },
      {
        key: "lithium-ion-battery",
        name: { en: "Lithium-Ion Battery Packs & Cells", hi: "लिथियम-आयन बैटरी पैक", mr: "लिथियम-आयन बॅटरी पॅक" },
        fair: 240, min: 200, max: 290, unit: "kg", category: "Hazardous / Batteries",
        desc: { en: "Laptop battery packs, 18650 cylindrical cells, and mobile phone Li-polymer batteries.", hi: "लैपटॉप और मोबाइल फोन से निकाली गई ली-आयन बैटरी।", mr: "लॅपटॉप आणि मोबाईलमधील ली-आयन बॅटऱ्या." },
        img: "https://images.unsplash.com/photo-1619641782821-75178523cf44?auto=format&fit=crop&w=600&q=80",
        purity: "Black Mass Precursor (Co 12-18%, Li 3-5%)", metals: ["Cobalt 15%", "Lithium 4%", "Nickel", "Manganese"], hazard: "CRITICAL", history: [225, 230, 235, 238, 242, 245, 240]
      },
      {
        key: "lead-acid-battery",
        name: { en: "Sealed Lead-Acid (SLA) & UPS Batteries", hi: "सील्ड लेड-एसिड (यूपीएस) बैटरी", mr: "लेड-अ‍ॅसिड व यूपीएस बॅटरी" },
        fair: 98, min: 88, max: 112, unit: "kg", category: "Hazardous / Batteries",
        desc: { en: "Inverter, automotive, and emergency lighting sealed lead-acid batteries.", hi: "इन्वर्टर और यूपीएस की लेड-एसिड बैटरी।", mr: "इन्व्हर्टर आणि वाहनांमधील लेड-अ‍ॅसिड बॅटऱ्या." },
        img: "https://images.unsplash.com/photo-1563245372-f21724e3856d?auto=format&fit=crop&w=600&q=80",
        purity: "Battery Scrap Rains (Lead content ~ 52%)", metals: ["Lead 52%", "Antimony 2%"], hazard: "HIGH", history: [94, 95, 96, 97, 98, 99, 98]
      },
      {
        key: "smps-power-supply",
        name: { en: "SMPS Computer Power Supply Units", hi: "एसएमपीएस कंप्यूटर पावर सप्लाई", mr: "एसएमपीएस पॉवर सप्लाय" },
        fair: 140, min: 120, max: 165, unit: "kg", category: "Components",
        desc: { en: "Desktop SMPS units with intact aluminum heat sinks and copper coils.", hi: "कंप्यूटर पावर सप्लाई यूनिट जिसमें कॉपर चोक और एल्युमिनियम सिंक होते हैं।", mr: "कॉम्प्युटर पॉवर सप्लाय बॉक्स." },
        img: "https://images.unsplash.com/photo-1587202372775-e229f172b9d7?auto=format&fit=crop&w=600&q=80",
        purity: "Mixed Ferrous & Non-Ferrous Assembly", metals: ["Copper 8%", "Aluminum 12%", "Steel 65%"], hazard: "LOW", history: [135, 138, 137, 140, 142, 141, 140]
      },
      {
        key: "copper-transformer",
        name: { en: "Heavy Copper Wound Transformers", hi: "भारी तांबे का ट्रांसफार्मर", mr: "मोठे तांब्याचे ट्रान्सफॉर्मर" },
        fair: 360, min: 320, max: 410, unit: "kg", category: "Precious & Base Metals",
        desc: { en: "Step-down transformers from microwave ovens and UPS units.", hi: "माइक्रोवेव और भारी यूपीएस से निकाले गए कॉपर ट्रांसफार्मर।", mr: "मायक्रोव्हेव्ह व इन्व्हर्टरमधील कॉपर ट्रान्सफॉर्मर." },
        img: "https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=600&q=80",
        purity: "Copper Core > 32% by total weight", metals: ["Copper 35%", "Silicon Steel 60%"], hazard: "LOW", history: [345, 350, 355, 358, 362, 365, 360]
      },
      {
        key: "aluminum-heatsink",
        name: { en: "Aluminum Heat Sinks & Casings", hi: "एल्युमिनियम हीट सिंक और चेसिस", mr: "अ‍ॅल्युमिनियम हीट सिंक व बॉडी" },
        fair: 165, min: 145, max: 185, unit: "kg", category: "Precious & Base Metals",
        desc: { en: "Clean extruded 6063 alloy aluminum heat fins and processor coolers.", hi: "कंप्यूटर प्रोसेसर और इनवर्टर से साफ एल्युमिनियम फिन्स।", mr: "स्वच्छ अ‍ॅल्युमिनियम फिन्स." },
        img: "https://images.unsplash.com/photo-1555680202-c86f0e12f086?auto=format&fit=crop&w=600&q=80",
        purity: "Extruded 6063 Aluminum (98.5% Al)", metals: ["Aluminum 98.5%"], hazard: "LOW", history: [158, 160, 162, 164, 165, 166, 165]
      },
      {
        key: "brass-connectors",
        name: { en: "Brass Terminals & RF Connectors", hi: "पीतल के कनेक्टर और पिन", mr: "पितळचे कनेक्टर्स आणि पिन्स" },
        fair: 480, min: 440, max: 530, unit: "kg", category: "Precious & Base Metals",
        desc: { en: "Precision machined brass terminals, cable grounding lugs, and plugs.", hi: "तारों और इलेक्ट्रॉनिक्स से निकाले गए भारी पीतल के टर्मिनल।", mr: "इलेक्ट्रिकलमधील पितळी टर्मिनल्स." },
        img: "https://images.unsplash.com/photo-1533090161767-e6ffed986c88?auto=format&fit=crop&w=600&q=80",
        purity: "Yellow Brass 65/35 Alloy", metals: ["Copper 65%", "Zinc 35%"], hazard: "LOW", history: [470, 475, 480, 482, 485, 483, 480]
      },
      {
        key: "mobile-phone-mixed",
        name: { en: "Scrap Mobile Phones (Mixed Grades)", hi: "स्क्रैप मोबाइल फोन (मिश्रित)", mr: "स्क्रॅप मोबाईल फोन (मिश्रित)" },
        fair: 1250, min: 1050, max: 1500, unit: "kg", category: "Electronics",
        desc: { en: "Intact or damaged feature phones and smartphones with circuit boards.", hi: "पुराने और खराब स्मार्टफोन व कीपैड मोबाइल फोन।", mr: "जुने स्मार्टफोन व कीपॅड मोबाईल." },
        img: "https://images.unsplash.com/photo-1580910051074-3eb694886505?auto=format&fit=crop&w=600&q=80",
        purity: "Telecom Scrap Blend (Au 0.4g/kg)", metals: ["Gold", "Silver", "Palladium", "Tantalum"], hazard: "MEDIUM", history: [1200, 1220, 1240, 1260, 1250, 1280, 1250]
      },
      {
        key: "crt-monitor",
        name: { en: "CRT Monitor & TV Picture Tubes", hi: "सीआरटी मॉनिटर व टीवी पिक्चर ट्यूब", mr: "सीआरटी मॉनिटर व टीव्ही पिक्चर ट्यूब" },
        fair: 25, min: 15, max: 35, unit: "kg", category: "Glass / CRT",
        desc: { en: "Cathode Ray Tubes containing heavy leaded funnel glass.", hi: "सीआरटी मॉनिटर और पुराने टीवी की सीसे वाली पिक्चर ट्यूब।", mr: "जुन्या टीव्हीच्या काचेच्या पिक्चर ट्यूब." },
        img: "https://images.unsplash.com/photo-1593305841991-05c297ba4575?auto=format&fit=crop&w=600&q=80",
        purity: "Leaded Funnel Glass (~22% PbO)", metals: ["Lead Oxide", "Barium Glass"], hazard: "HIGH", history: [22, 24, 25, 25, 26, 25, 25]
      },
      {
        key: "hard-drive-hdd",
        name: { en: "Complete Hard Disk Drives (HDD)", hi: "कंप्यूटर हार्ड डिस्क ड्राइव (एचडीडी)", mr: "हार्ड डिस्क ड्राईव्ह (एचडीडी)" },
        fair: 280, min: 250, max: 320, unit: "kg", category: "Components",
        desc: { en: "Unopened mechanical hard disk drives with aluminum alloy chassis.", hi: "कंप्यूटर और लैपटॉप की बंद हार्ड डिस्क।", mr: "कॉम्प्युटरमधील अनओपन हार्ड डिस्क." },
        img: "https://images.unsplash.com/photo-1544652478-6653e09f18a2?auto=format&fit=crop&w=600&q=80",
        purity: "Standard 3.5 & 2.5 inch HDD Mix", metals: ["Cast Aluminum 70%", "Neodymium 3%", "Gold Plating"], hazard: "LOW", history: [270, 275, 280, 282, 285, 280, 280]
      },
      // TIER 2 ADDITIONS:
      {
        key: "lcd-led-display",
        name: { en: "LCD/LED Display Panels & Backlights", hi: "एलसीडी/एलईडी डिस्प्ले पैनल और बैकलाइट", mr: "एलसीडी/एलईडी डिस्प्ले पॅनेल्स आणि बॅकलाइट्स" },
        fair: 110, min: 85, max: 140, unit: "kg", category: "Electronics",
        desc: { en: "Intact TFT-LCD and LED panels containing indium tin oxide (ITO) transparent conductive layers.", hi: "इंडियम टिन ऑक्साइड (ITO) और पीसीबी ड्राइवर स्ट्रिप्स से युक्त टीएफटी-एलसीडी व एलईडी डिस्प्ले पैनल।", mr: "इंडियम टिन ऑक्साइड असलेले टीएफटी-एलसीडी व एलईडी पॅनेल्स." },
        img: "https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&w=600&q=80",
        purity: "Grade-A Shatter-free (Indium trace > 120ppm)", metals: ["Indium", "Gallium", "Aluminum", "Copper Trace"], hazard: "MEDIUM", history: [100, 105, 108, 112, 110, 115, 110]
      },
      {
        key: "electric-copper-motor",
        name: { en: "Electric Copper Motors & Armatures", hi: "इलेक्ट्रिक कॉपर मोटर और आर्मेचर", mr: "इलेक्ट्रिक कॉपर मोटर्स आणि आर्मेचर" },
        fair: 290, min: 250, max: 340, unit: "kg", category: "Components",
        desc: { en: "Heavy-gauge enameled copper wire wound around steel stators and rotors from appliances.", hi: "वॉशिंग मशीन, पंखे और कंप्रेसर से निकाले गए भारी कॉपर वाइंडिंग और स्टील आर्मेचर मोटर।", mr: "वॉशिंग मशीन व पंख्यामधील तांब्याची वाइंडिंग असलेले मोटर्स." },
        img: "https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=600&q=80",
        purity: "Grade-1 Clean Windings (Cu 18-24% by lot weight)", metals: ["Copper 22%", "Silicon Steel 70%", "Cast Aluminum"], hazard: "LOW", history: [275, 280, 285, 290, 288, 295, 290]
      },
      {
        key: "neodymium-magnets",
        name: { en: "Neodymium Rare-Earth Magnet Assemblies", hi: "नियोडिमियम दुर्लभ चुंबक असेंबली", mr: "निओडिमियम दुर्मिळ चुंबक असेंब्ली" },
        fair: 950, min: 800, max: 1150, unit: "kg", category: "Precious & Base Metals",
        desc: { en: "High-coercivity NdFeB sintered magnet blocks salvaged from HDDs and EV motors.", hi: "हार्ड डिस्क, ईवी मोटर और ऑडियो स्पीकर से निकाले गए हाई-पावर नियोडिमियम दुर्लभ पृथ्वी चुंबक।", mr: "हार्ड ड्राईव्ह आणि मोटर्समधील उच्च क्षमतेचे निओडिमियम दुर्मिळ चुंबक." },
        img: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=600&q=80",
        purity: "Sintered N42-N52 Grade (Nd+Pr > 30wt%)", metals: ["Neodymium 28%", "Dysprosium 3%", "Praseodymium", "Iron"], hazard: "LOW", history: [910, 920, 930, 940, 935, 960, 950]
      },
      {
        key: "flame-retardant-plastics",
        name: { en: "Flame-Retardant Mixed Plastics (ABS/PC)", hi: "फ्लेम-रिटार्डेंट मिश्रित प्लास्टिक (ABS/PC)", mr: "फ्लेम-रिटार्डंट मिश्रित प्लास्टिक (ABS/PC)" },
        fair: 48, min: 36, max: 60, unit: "kg", category: "Electronics",
        desc: { en: "Rigid plastic casings and monitor bezels molded from ABS and Polycarbonate.", hi: "कंप्यूटर मॉनिटर, प्रिंटर और टीवी कैबिनेट से निकाले गए बीएफआर-स्क्रीन किए गए एबीएस व पॉलीकार्बोनेट प्लास्टिक।", mr: "टीव्ही व कॉम्प्युटरच्या बॉडीमधील एबीएस आणि पॉलीकार्बोनेट प्लास्टिक." },
        img: "https://images.unsplash.com/photo-1563245372-f21724e3856d?auto=format&fit=crop&w=600&q=80",
        purity: "RoHS Compliant Shredded Regrind (<0.1% PBDE)", metals: ["Polycarbonate 45%", "ABS Resin 50%"], hazard: "MEDIUM", history: [44, 45, 46, 48, 47, 50, 48]
      }
    ];

    for (const m of SEED_MATERIALS) {
      insertMat.run(
        m.key, m.name.en, m.name.hi, m.name.mr, m.fair, m.min, m.max,
        m.unit, m.category, m.desc.en, m.desc.hi, m.desc.mr,
        m.img, m.purity, JSON.stringify(m.metals), m.hazard, JSON.stringify(m.history)
      );
    }
  }

  // Seed baseline recyclers
  const countRecyclers = db.prepare("SELECT COUNT(*) as cnt FROM recyclers").get() as { cnt: number };
  if (countRecyclers.cnt === 0) {
    console.log("Seeding SQLite database with authorized recyclers...");
    const insertRec = db.prepare(`
      INSERT INTO recyclers (
        id, name, license_no, cpcb_certified, distance_km, rating, reviews_count,
        phone, whatsapp, address, lat, lng, accepted_materials_json,
        pickup_min_weight_kg, provides_free_pickup, price_bonus_percent
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const SEED_RECYCLERS = [
      {
        id: "rec-101",
        name: "GreenEarth E-Waste Solutions Pvt Ltd",
        licenseNo: "CPCB/EW-REG/MH/2023/0481",
        cpcbCertified: 1,
        distanceKm: 3.2,
        rating: 4.9,
        reviewsCount: 328,
        phone: "+91 98201 44521",
        whatsapp: "+919820144521",
        address: "Plot 42, MIDC Industrial Area, Turbhe, Navi Mumbai, Maharashtra 400705",
        lat: 19.0625,
        lng: 73.0112,
        acceptedMaterials: ["copper-wire", "motherboard-high", "motherboard-mid", "lithium-ion-battery", "mobile-phone-mixed", "hard-drive-hdd", "electric-copper-motor", "neodymium-magnets"],
        pickupMinWeightKg: 25,
        providesFreePickup: 1,
        priceBonusPercent: 5
      },
      {
        id: "rec-102",
        name: "EcoMetals Refining & E-Waste Recyclers",
        licenseNo: "CPCB/EW-REG/MH/2022/0194",
        cpcbCertified: 1,
        distanceKm: 5.8,
        rating: 4.8,
        reviewsCount: 246,
        phone: "+91 98334 11200",
        whatsapp: "+919833411200",
        address: "Shed C-12, Taloja Industrial Estate, Panvel, Maharashtra 410208",
        lat: 19.0833,
        lng: 73.1256,
        acceptedMaterials: ["copper-wire", "copper-transformer", "brass-connectors", "aluminum-heatsink", "smps-power-supply", "electric-copper-motor"],
        pickupMinWeightKg: 50,
        providesFreePickup: 1,
        priceBonusPercent: 3
      },
      {
        id: "rec-103",
        name: "Maharashtra Battery & Hazardous Scrap Recovery",
        licenseNo: "CPCB/HW-AUTH/MH/2021/0882",
        cpcbCertified: 1,
        distanceKm: 7.4,
        rating: 4.7,
        reviewsCount: 189,
        phone: "+91 97022 55891",
        whatsapp: "+919702255891",
        address: "Gate 4, TTC Industrial Corridor, Rabale, Navi Mumbai 400701",
        lat: 19.1458,
        lng: 73.0034,
        acceptedMaterials: ["lithium-ion-battery", "lead-acid-battery", "crt-monitor", "lcd-led-display"],
        pickupMinWeightKg: 30,
        providesFreePickup: 0,
        priceBonusPercent: 2
      },
      {
        id: "rec-104",
        name: "CleanTech Circular Electronics Park",
        licenseNo: "CPCB/EW-REG/MH/2024/0055",
        cpcbCertified: 1,
        distanceKm: 8.9,
        rating: 4.9,
        reviewsCount: 412,
        phone: "+91 99304 88712",
        whatsapp: "+919930488712",
        address: "Survey 118, Bhiwandi-Kalyan Logistics Hub, Thane, Maharashtra 421302",
        lat: 19.2967,
        lng: 73.0645,
        acceptedMaterials: ["motherboard-high", "motherboard-mid", "low-grade-pcb", "hard-drive-hdd", "mobile-phone-mixed", "neodymium-magnets", "flame-retardant-plastics"],
        pickupMinWeightKg: 10,
        providesFreePickup: 1,
        priceBonusPercent: 6
      }
    ];

    for (const r of SEED_RECYCLERS) {
      insertRec.run(
        r.id, r.name, r.licenseNo, r.cpcbCertified, r.distanceKm, r.rating, r.reviewsCount,
        r.phone, r.whatsapp, r.address, r.lat, r.lng, JSON.stringify(r.acceptedMaterials),
        r.pickupMinWeightKg, r.providesFreePickup, r.priceBonusPercent
      );
    }
  }

  // Seed baseline receipts
  const countReceipts = db.prepare("SELECT COUNT(*) as cnt FROM receipts").get() as { cnt: number };
  if (countReceipts.cnt === 0) {
    console.log("Seeding SQLite database with baseline transaction receipts...");
    const insertRcpt = db.prepare(`
      INSERT INTO receipts (
        id, lot_id, date, collector_name, collector_phone, recycler_name,
        recycler_license, material_key, material_name, weight_kg, purity_grade,
        rate_per_kg, final_price_inr, payment_method, status, qr_verification_code,
        photo_url, cpcb_manifest_number, gps_lat, gps_lng, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const SEED_RECEIPTS = [
      {
        id: "rcpt-8711",
        lotId: "LOT-2025-0811",
        date: "2025-05-12",
        collectorName: "Ramesh Pawar (Dharavi Guild)",
        collectorPhone: "+91 98200 12345",
        recyclerName: "GreenEarth E-Waste Solutions",
        recyclerLicense: "CPCB/EW-REG/MH/2023/0481",
        materialKey: "copper-wire",
        materialName: "Pure Copper Wire & Windings",
        weightKg: 14.5,
        purityGrade: "Grade A Bare Bright (99.2%)",
        ratePerKg: 735,
        finalPriceInr: 10657,
        paymentMethod: "UPI Instant (Settled)",
        status: "SETTLED",
        qrVerificationCode: "8922800de9871f0fd3bd11d3d66af2df68992b78ed7ab72fe3ff6942415e02e7",
        photoUrl: "https://images.unsplash.com/photo-1590496793929-36417d3117de?auto=format&fit=crop&w=600&q=80",
        cpcbManifestNumber: "MH-EW-MNF-2025-08912",
        gpsLat: 19.0434,
        gpsLng: 72.8567,
        createdAt: "2025-05-12T14:32:00Z"
      },
      {
        id: "rcpt-8712",
        lotId: "LOT-2025-0819",
        date: "2025-05-10",
        collectorName: "Ramesh Pawar (Dharavi Guild)",
        collectorPhone: "+91 98200 12345",
        recyclerName: "CleanTech Circular Electronics",
        recyclerLicense: "CPCB/EW-REG/MH/2024/0055",
        materialKey: "motherboard-high",
        materialName: "High-Grade Server Motherboards",
        weightKg: 6.2,
        purityGrade: "Gold Flash Telecom Spec",
        ratePerKg: 1920,
        finalPriceInr: 11904,
        paymentMethod: "Bank IMPS Transfer",
        status: "SETTLED",
        qrVerificationCode: "6bcf39039fc714c4f2bc70167a28e1d035e0c2f8f5fae4fa8ae4c4748d27f1ba",
        photoUrl: "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=600&q=80",
        cpcbManifestNumber: "MH-EW-MNF-2025-08919",
        gpsLat: 19.0435,
        gpsLng: 72.8571,
        createdAt: "2025-05-10T11:15:00Z"
      },
      {
        id: "rcpt-8713",
        lotId: "LOT-2025-0822",
        date: "2025-05-08",
        collectorName: "Ramesh Pawar (Dharavi Guild)",
        collectorPhone: "+91 98200 12345",
        recyclerName: "EcoMetals Refining",
        recyclerLicense: "CPCB/EW-REG/MH/2022/0194",
        materialKey: "copper-transformer",
        materialName: "Heavy Copper Wound Transformers",
        weightKg: 28.0,
        purityGrade: "Clean Core (34% Cu)",
        ratePerKg: 375,
        finalPriceInr: 10500,
        paymentMethod: "Cash on Weighing Scale",
        status: "SETTLED",
        qrVerificationCode: "dd8d22b9b40de7387c45057322446ae553c86751929157bc34f4dc52f9360f22",
        photoUrl: "https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=600&q=80",
        cpcbManifestNumber: "MH-EW-MNF-2025-08930",
        gpsLat: 19.0431,
        gpsLng: 72.8569,
        createdAt: "2025-05-08T16:45:00Z"
      }
    ];

    for (const r of SEED_RECEIPTS) {
      insertRcpt.run(
        r.id, r.lotId, r.date, r.collectorName, r.collectorPhone, r.recyclerName,
        r.recyclerLicense, r.materialKey, r.materialName, r.weightKg, r.purityGrade,
        r.ratePerKg, r.finalPriceInr, r.paymentMethod, r.status, r.qrVerificationCode,
        r.photoUrl, r.cpcbManifestNumber, r.gpsLat, r.gpsLng, r.createdAt
      );
    }
  }

  // Seed baseline field interviews
  const countInterviews = db.prepare("SELECT COUNT(*) as cnt FROM field_interviews").get() as { cnt: number };
  if (countInterviews.cnt === 0) {
    console.log("Seeding SQLite database with field interview placeholders...");
    const insertInt = db.prepare(`
      INSERT INTO field_interviews (
        id, collector_name, location, years_in_trade, daily_volume_kg,
        middleman_rate_note, pain_points_json, quotes_raw_json, photo_refs_json,
        interview_date, interviewer_notes, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertInt.run(
      "interview-slot-01",
      "[TODO: Enter Collector Name / Anonymized Guild Handle]",
      "[TODO: e.g., Dharavi 13th Compound Scrap Market, Mumbai]",
      null,
      "[TODO: e.g. 25-40 kg/day mixed electronic and metal scrap]",
      "[TODO: Detail middleman cut, e.g. Middleman pays ₹140/kg for motherboards, sells to terminal smelter for ₹280/kg (50% value capture)]",
      JSON.stringify([
        "[TODO: Document verified field pain point #1 — e.g. predatory scale calibration]",
        "[TODO: Document verified field pain point #2 — e.g. delayed cash settlement or IOUs]",
        "[TODO: Document verified field pain point #3 — e.g. respiratory issues from unregulated stripping/burning]"
      ]),
      JSON.stringify([
        "[TODO: Verbatim recorded quote 1 - transcribing vernacular Marathi/Hindi scrap pricing dispute]",
        "[TODO: Verbatim recorded quote 2 - describing police harassment or lack of formal identity badges]"
      ]),
      JSON.stringify([
        "/field_research/collector_01_scrap_yard.jpg (Pending file upload)",
        "/field_research/collector_01_weighing_scale.jpg (Pending file upload)"
      ]),
      "YYYY-MM-DD [Pending Field Deployment]",
      "Template ready for Dharavi/Kurla ground survey. Survey questionnaire finalized under CPCB informal-transition rubric.",
      "PENDING_REAL_INPUT"
    );

    insertInt.run(
      "interview-slot-02",
      "[TODO: Enter Aggregator / Itinerant Collector Name]",
      "[TODO: e.g., Kurla LBS Marg Scrap Aggregation Cluster, Mumbai]",
      null,
      "[TODO: e.g. 60-90 kg/day semi-sorted circuit boards and wiring]",
      "[TODO: Document middleman payment structure and deduction rates for moisture/dirt]",
      JSON.stringify([
        "[TODO: Document field pain point #1 — e.g. refusal of formal recyclers to accept lots under 500kg]",
        "[TODO: Document field pain point #2 — e.g. price volatility on copper armatures and CRT glass]",
        "[TODO: Document field pain point #3 — e.g. acid exposure during manual IC chip harvesting]"
      ]),
      JSON.stringify([
        "[TODO: Verbatim recorded quote 1 - regarding transport costs to formal MIDC recycling plants]",
        "[TODO: Verbatim recorded quote 2 - on how WhatsApp photo inquiries currently work with scrap dealers]"
      ]),
      JSON.stringify([
        "/field_research/collector_02_sorting_station.jpg (Pending file upload)"
      ]),
      "YYYY-MM-DD [Pending Field Deployment]",
      "Template ready for Kurla/Deonar itinerant picker follow-up. Consent protocol approved for audio recording.",
      "PENDING_REAL_INPUT"
    );
  }
}

// Database helper functions
export function getAllMaterials() {
  const rows = db.prepare("SELECT * FROM materials").all() as any[];
  return rows.map((r) => ({
    key: r.key,
    name: { en: r.name_en, hi: r.name_hi, mr: r.name_mr },
    fairPrice: r.fair_price,
    minPrice: r.min_price,
    maxPrice: r.max_price,
    unit: r.unit,
    category: r.category,
    description: { en: r.description_en, hi: r.description_hi, mr: r.description_mr },
    sampleImage: r.sample_image,
    purityBenchmark: r.purity_benchmark,
    recoverableMetals: JSON.parse(r.recoverable_metals_json),
    hazardLevel: r.hazard_level,
    priceHistory7Days: JSON.parse(r.price_history_json),
  }));
}

export function getAllRecyclers() {
  const rows = db.prepare("SELECT * FROM recyclers").all() as any[];
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    licenseNo: r.license_no,
    cpcbCertified: Boolean(r.cpcb_certified),
    distanceKm: r.distance_km,
    rating: r.rating,
    reviewsCount: r.reviews_count,
    phone: r.phone,
    whatsapp: r.whatsapp,
    address: r.address,
    lat: r.lat,
    lng: r.lng,
    acceptedMaterials: JSON.parse(r.accepted_materials_json),
    pickupMinWeightKg: r.pickup_min_weight_kg,
    providesFreePickup: Boolean(r.provides_free_pickup),
    priceBonusPercent: r.price_bonus_percent,
  }));
}

export function getAllReceipts() {
  const rows = db.prepare("SELECT * FROM receipts ORDER BY created_at DESC").all() as any[];
  return rows.map((r) => ({
    id: r.id,
    lotId: r.lot_id,
    date: r.date,
    collectorName: r.collector_name,
    collectorPhone: r.collector_phone,
    recyclerName: r.recycler_name,
    recyclerLicense: r.recycler_license,
    materialKey: r.material_key,
    materialName: r.material_name,
    weightKg: r.weight_kg,
    purityGrade: r.purity_grade,
    ratePerKg: r.rate_per_kg,
    finalPriceInr: r.final_price_inr,
    paymentMethod: r.payment_method,
    status: r.status,
    qrVerificationCode: r.qr_verification_code,
    photoUrl: r.photo_url,
    cpcbManifestNumber: r.cpcb_manifest_number,
    gpsCoords: r.gps_lat && r.gps_lng ? { latitude: r.gps_lat, longitude: r.gps_lng } : undefined,
    createdAt: r.created_at,
  }));
}

export function insertReceipt(r: any) {
  const stmt = db.prepare(`
    INSERT INTO receipts (
      id, lot_id, date, collector_name, collector_phone, recycler_name,
      recycler_license, material_key, material_name, weight_kg, purity_grade,
      rate_per_kg, final_price_inr, payment_method, status, qr_verification_code,
      photo_url, cpcb_manifest_number, gps_lat, gps_lng, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const manifestNo = r.cpcbManifestNumber || `MH-EW-MNF-${Date.now().toString().slice(-6)}`;
  const timestamp = r.createdAt || new Date().toISOString();
  const realSha256 =
    r.qrVerificationCode && r.qrVerificationCode.length === 64 && /^[0-9a-f]+$/i.test(r.qrVerificationCode)
      ? r.qrVerificationCode
      : computeServerSha256({
          receiptNumber: manifestNo,
          timestamp,
          collectorName: r.collectorName || "Ramesh Pawar (Dharavi Guild)",
          recyclerLicense: r.recyclerLicense || "CPCB/EW-REG/MH/2023/0481",
          materialKey: r.materialKey,
          weightKg: r.weightKg,
          ratePerKgInr: r.ratePerKg,
          finalPriceInr: r.finalPriceInr,
        });

  r.qrVerificationCode = realSha256;
  r.cpcbManifestNumber = manifestNo;

  stmt.run(
    r.id || `rcpt-${Date.now().toString().slice(-4)}`,
    r.lotId || `LOT-${Date.now().toString().slice(-6)}`,
    r.date || new Date().toISOString().split("T")[0],
    r.collectorName || "Ramesh Pawar (Dharavi Guild)",
    r.collectorPhone || "+91 98200 12345",
    r.recyclerName,
    r.recyclerLicense || "CPCB/EW-REG/MH/2023/0481",
    r.materialKey,
    r.materialName,
    r.weightKg,
    r.purityGrade || "Standard CPCB Verified",
    r.ratePerKg,
    r.finalPriceInr,
    r.paymentMethod || "UPI Instant (Settled)",
    r.status || "SETTLED",
    r.qrVerificationCode,
    r.photoUrl || null,
    r.cpcbManifestNumber,
    r.gpsCoords?.latitude || null,
    r.gpsCoords?.longitude || null,
    r.createdAt || timestamp
  );

  return r;
}

export function getAllFieldInterviews() {
  const rows = db.prepare("SELECT * FROM field_interviews").all() as any[];
  return rows.map((r) => ({
    id: r.id,
    collectorName: r.collector_name,
    location: r.location,
    yearsInTrade: r.years_in_trade,
    dailyVolumeKg: r.daily_volume_kg,
    currentMiddlemanRateNote: r.middleman_rate_note,
    painPoints: JSON.parse(r.pain_points_json),
    quotesRaw: JSON.parse(r.quotes_raw_json),
    photoRefs: JSON.parse(r.photo_refs_json),
    interviewDate: r.interview_date,
    interviewerNotes: r.interviewer_notes,
    status: r.status,
  }));
}

export function getAllMLValidationLogs() {
  const rows = db.prepare("SELECT * FROM ml_validation_log ORDER BY timestamp DESC").all() as any[];
  return rows.map((r) => ({
    id: r.id,
    timestamp: r.timestamp,
    sampleSize: r.sample_size,
    accuracyPercent: r.accuracy_percent,
    failureModes: JSON.parse(r.failure_modes_json),
    methodologyNote: r.methodology_note,
    details: JSON.parse(r.details_json),
  }));
}

export function recordMLValidationRun(run: {
  id: string;
  timestamp: string;
  sampleSize: number;
  accuracyPercent: number | null;
  failureModes: string[];
  methodologyNote: string;
  details: any;
}) {
  const stmt = db.prepare(`
    INSERT INTO ml_validation_log (
      id, timestamp, sample_size, accuracy_percent, failure_modes_json,
      methodology_note, details_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    run.id,
    run.timestamp,
    run.sampleSize,
    run.accuracyPercent,
    JSON.stringify(run.failureModes),
    run.methodologyNote,
    JSON.stringify(run.details)
  );

  return run;
}
