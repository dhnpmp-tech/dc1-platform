// DCP Docs content — mirrors https://dcp.sa/docs/* exactly.
// Sources: /docs/api-reference, /docs/quickstart, /docs/architecture-overview (as of 2026-04).
// No invented endpoints, parameters, headers, or numbers.

window.DCP_DOCS = {
  // ─── Sidebar: mirrors the live sidebar ordering on dcp.sa ───
  nav: {
    en: [
      { title: "Get started", items: [
        ["quickstart",          "Quickstart"],
        ["architecture",        "Architecture Overview"],
      ]},
      { title: "Reference", items: [
        ["api-reference",       "API Reference"],
        ["model-cards",         "Model Cards"],
      ]},
      { title: "Models", items: [
        ["models-index",        "DCP Model Catalog"],
        ["model-allam-7b",      "ALLaM 7B Instruct"],
        ["model-falcon-h1-7b",  "Falcon H1 7B Instruct"],
        ["model-jais-13b",      "JAIS 13B Chat"],
        ["model-bge-m3",        "BGE-M3 Embeddings"],
        ["model-bge-reranker",  "BGE Reranker v2 M3"],
        ["model-llama-3-8b",    "Llama 3 8B Instruct"],
        ["model-mistral-7b",    "Mistral 7B Instruct v0.2"],
        ["model-sdxl",          "Stable Diffusion XL 1.0"],
        ["model-tinyllama",     "TinyLlama 1.1B Chat"],
        ["model-phi-2",         "Phi-2"],
      ]},
      { title: "SDKs", items: [
        ["sdk-python",          "SDK · Python"],
        ["sdk-js",              "SDK · JavaScript"],
        ["sdk-cli",             "SDK · CLI"],
      ]},
      { title: "Guides", items: [
        ["renter-guide",        "Renter Guide"],
        ["provider-guide",      "Provider Guide"],
      ]},
      { title: "Enterprise & Ops", items: [
        ["enterprise-sla",      "Enterprise SLA & Trust"],
        ["runtime-verification","Runtime Verification Runbook"],
      ]},
    ],
    ar: [
      { title: "ابدأ هنا", items: [
        ["quickstart",          "البدء السريع"],
        ["architecture",        "نظرة معمارية"],
      ]},
      { title: "المرجع", items: [
        ["api-reference",       "مرجع API"],
        ["model-cards",         "بطاقات النماذج"],
      ]},
      { title: "النماذج", items: [
        ["models-index",        "دليل النماذج"],
        ["model-allam-7b",      "ALLaM 7B Instruct"],
        ["model-falcon-h1-7b",  "Falcon H1 7B Instruct"],
        ["model-jais-13b",      "JAIS 13B Chat"],
        ["model-bge-m3",        "BGE-M3"],
      ]},
      { title: "SDK", items: [
        ["sdk-python",          "Python"],
        ["sdk-js",              "JavaScript"],
        ["sdk-cli",             "CLI"],
      ]},
      { title: "أدلة", items: [
        ["renter-guide",        "دليل المستأجر"],
        ["provider-guide",      "دليل المزود"],
      ]},
    ],
  },

  // ─── Pages — content is lifted verbatim (or close paraphrase) from dcp.sa ───
  pages: {

    // ───────────────────── QUICKSTART ─────────────────────
    quickstart: {
      en: {
        title: "Quickstart for Arabic-ready, container-based GPU compute",
        kicker: "Quickstart",
        summary: "This guide walks you from account setup to workload submission, including model selection for Arabic AI use cases. DCP job execution runs via Ollama (Windows/Linux) or MLX (macOS Apple Silicon) inference engines.",
        toc: ["Choose your role path","How DCP Billing Works","Renter onboarding checklist","Get your API key","Top up your balance","Browse available GPUs","Submit a job","Monitor job status","Verification checklist","Next actions"],
        blocks: [

          { type:"h3", text:"Choose your role path" },
          { type:"p", text:"Start from the flow that matches your role. DCP keeps one consistent trust model: Saudi energy advantage, Arabic AI support, and containerized execution." },
          { type:"cards", items:[
            ["I am a renter",         "Follow the renter checklist and ship your first workload.", "renter-guide"],
            ["I am a provider",       "Register your GPU (NVIDIA or Apple Silicon), download the 4 MB app, and go online. No Docker needed.", "provider-guide"],
            ["I am integrating API",  "Use auth and endpoint contracts for production-safe integration.", "api-reference"],
          ]},

          { type:"h3", text:"How DCP Billing Works" },
          { type:"steps", items:[
            ["1","Before execution, DCP places an estimate hold in halala from your wallet."],
            ["2","After completion, final cost is settled from actual runtime (not the estimate)."],
            ["3","Any unused hold is returned to wallet balance in halala automatically."],
          ]},
          { type:"callout", kind:"note", title:"100 halala = 1 SAR",
            text:"Current flow: wallet top-up in SAR, estimate hold before execution, completion-based settlement, and automatic return of any unused hold." },

          { type:"h3", text:"Renter onboarding checklist" },
          { type:"steps", items:[
            ["1","Register account at dcp.sa/renter/register"],
            ["2","Add wallet balance at dcp.sa/renter/billing"],
            ["3","Choose GPU in the marketplace at dcp.sa/renter/marketplace"],
            ["4","Submit workload from dcp.sa/renter/playground?starter=1"],
            ["5","Monitor output and logs at dcp.sa/renter/jobs"],
          ]},

          { type:"h3", text:"1 · Get your API key" },
          { type:"p", text:"Register a renter account at dcp.sa/renter/register. You'll receive a renter API key — copy it from the dashboard and keep it private." },
          { type:"callout", kind:"warn", title:"Keep your key safe",
            text:"It authenticates all API calls and is shown once." },

          { type:"h3", text:"2 · Top up your balance" },
          { type:"p", text:"Fund wallet in SAR. Use the dashboard at dcp.sa/renter/billing, or call the API directly." },
          { type:"code", tabs:{
            curl: `# Check available models (no auth needed)
curl https://api.dcp.sa/v1/models`,
          }},
          { type:"code", tabs:{
            json: `{
  "data": [
    {
      "id": "qwen3-30b-a3b",
      "name": "Qwen3 30B-A3B (MoE)",
      "provider_count": 1,
      "context_length": 32768,
      "max_vram_gb": 18
    }
  ]
}`,
          }},

          { type:"h3", text:"3 · Browse available GPUs" },
          { type:"p", text:"Fetch live providers from the marketplace and note the id for the compatible provider you choose." },
          { type:"code", tabs:{
            curl: `# Run inference (OpenAI-compatible)
curl -X POST https://api.dcp.sa/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_RENTER_KEY" \\
  -d '{
    "model": "qwen3-30b-a3b",
    "messages": [{"role": "user", "content": "What is the capital of Saudi Arabia?"}],
    "max_tokens": 100
  }'`,
          }},
          { type:"code", tabs:{
            json: `{
  "id": "chatcmpl-abc123",
  "model": "qwen3-30b-a3b",
  "choices": [{
    "message": {
      "role": "assistant",
      "content": "The capital of Saudi Arabia is Riyadh."
    }
  }],
  "usage": {
    "prompt_tokens": 15,
    "completion_tokens": 12,
    "total_tokens": 27
  }
}`,
          }},

          { type:"h3", text:"4 · Submit a job" },
          { type:"p", text:"Submit an LLM job and pass your renter key in the x-renter-key header." },
          { type:"code", tabs:{
            python: `# Python (drop-in OpenAI replacement)
from openai import OpenAI

client = OpenAI(
    base_url="https://api.dcp.sa/v1",
    api_key="YOUR_RENTER_KEY"
)

response = client.chat.completions.create(
    model="qwen3-30b-a3b",
    messages=[{"role": "user", "content": "Hello"}],
    max_tokens=100
)
print(response.choices[0].message.content)`,
            node: `// Node.js
import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "https://api.dcp.sa/v1",
  apiKey: "YOUR_RENTER_KEY"
});

const response = await client.chat.completions.create({
  model: "qwen3-30b-a3b",
  messages: [{ role: "user", content: "Hello" }]
});
console.log(response.choices[0].message.content);`,
          }},
          { type:"callout", kind:"note", title:"Estimate & settlement",
            text:"DCP holds an estimate before execution and reconciles against actual runtime when the job completes." },

          { type:"h3", text:"5 · Monitor job status" },
          { type:"p", text:"Poll the job endpoint until status reaches completed, then fetch the output." },
          { type:"code", tabs:{
            curl: `# Poll status
curl https://api.dcp.sa/api/jobs/job-abc123

# Fetch output (returns 202 while running, 200 when completed)
curl https://api.dcp.sa/api/jobs/job-abc123/output`,
          }},
          { type:"code", tabs:{
            json: `{
  "type": "text",
  "response": "Transformers are a neural network architecture...",
  "billing": {
    "actual_cost_halala": 188,
    "refunded_halala": 12
  }
}`,
          }},
          { type:"p", text:"Status flow: pending → queued → running → completed. Logs are available at GET /api/jobs/:id/logs." },

          { type:"h3", text:"SDK Quickstarts (Node, Python, CLI)" },
          { type:"p", text:"Use one SDK track at a time and verify key, connectivity, and completion before scaling." },
          { type:"code", tabs:{
            node: `// Install
npm install openai

// Submit + wait
import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "https://api.dcp.sa/v1",
  apiKey: process.env.DCP_RENTER_KEY,
});

const response = await client.chat.completions.create({
  model: "qwen3-30b-a3b",
  messages: [{ role: "user", content: "Explain transformer attention in 2 lines." }],
  max_tokens: 100,
});

console.log(response.choices[0].message.content);

// Verify connectivity — check balance
const res = await fetch("https://api.dcp.sa/api/renters/me", {
  headers: { "x-renter-key": process.env.DCP_RENTER_KEY }
});
const data = await res.json();
console.log(data.name, data.balance_halala + " halala");`,
          }},
          { type:"p", text:"Expected: your renter profile JSON with email and balance fields." },

          { type:"h3", text:"Verification checklist" },
          { type:"steps", items:[
            ["✓","Confirm your API key starts with dcp-renter-"],
            ["✓","Confirm top-up response includes success=true and new_balance_halala"],
            ["✓","Capture job_id from submit response before polling status"],
          ]},

          { type:"h3", text:"Next actions" },
          { type:"cards", items:[
            ["API reference",   "Auth, endpoints, error contract",     "api-reference"],
            ["Renter guide",    "End-to-end renter workflow",          "renter-guide"],
            ["Provider guide",  "Register a GPU and earn SAR",         "provider-guide"],
          ]},
        ],
      },
      ar: {
        title: "البدء السريع لحوسبة GPU العربية القائمة على الحاويات",
        kicker: "البدء السريع",
        summary: "هذا الدليل ينقلك من إنشاء الحساب إلى إرسال أوّل حمولة عمل، مع اختيار النموذج المناسب لحالات الذكاء الاصطناعي العربي. تشغيل المهام يتم عبر Ollama (Windows/Linux) أو MLX (macOS Apple Silicon).",
        toc: ["اختر مسارك","آلية الفوترة","قائمة تهيئة المستأجر"],
        blocks: [
          { type:"h3", text:"آلية فوترة DCP" },
          { type:"steps", items:[
            ["١","قبل التشغيل، يحتجز DCP مبلغاً تقديرياً بالهللة من محفظتك."],
            ["٢","بعد الاكتمال، تُحسب التكلفة النهائية من الزمن الفعلي (لا من التقدير)."],
            ["٣","يعود أي مبلغ محجوز غير مستخدم إلى رصيد المحفظة بالهللة تلقائياً."],
          ]},
          { type:"callout", kind:"note", title:"‎١٠٠‎ هللة = ‎١‎ ريال",
            text:"السير الحالي: شحن المحفظة بالريال، حجز تقديري قبل التشغيل، تسوية بعد الاكتمال، وإعادة أي مبلغ غير مستخدم." },
        ],
      },
    },

    // ───────────────────── ARCHITECTURE OVERVIEW ─────────────────────
    architecture: {
      en: {
        title: "Architecture Overview",
        kicker: "Architecture",
        summary: "End-to-end system map for Next.js frontend, Express API, provider daemon, and data synchronization.",
        toc: ["Platform topology","Request flow (renter job)","Core services","Security and trust boundaries","Billing model summary","Operational notes","Related docs"],
        blocks: [

          { type:"h3", text:"Platform topology" },
          { type:"p", text:"DCP runs as a three-plane architecture:" },
          { type:"steps", items:[
            ["1","Control plane (Web + API) — Next.js 14 on dcp.sa and the Express API on api.dcp.sa."],
            ["2","Execution plane (Provider GPUs) — dcp_daemon.py on provider machines polls for jobs, executes workloads in approved container images, and reports heartbeat state."],
            ["3","Data plane (SQLite + Supabase sync) — SQLite is the write source for operational state, with a bridge that mirrors key records to Supabase for faster reads and analytics."],
          ]},

          { type:"h3", text:"Request flow (renter job)" },
          { type:"steps", items:[
            ["1","Renter authenticates with x-renter-key or ?key=."],
            ["2","POST /api/jobs/submit creates a job row and places a prepay estimate in halala."],
            ["3","Provider daemon polls GET /api/providers/:key/jobs for eligible work."],
            ["4","Daemon executes workload in isolated containers and reports result to POST /api/providers/job-result."],
            ["5","Backend runs completion-based settlement (75% provider / 25% platform) once execution finishes."],
            ["6","Renter retrieves output from GET /api/jobs/:id/output for completed jobs."],
          ]},

          { type:"h3", text:"Core services" },
          { type:"table", headers:["Service","Role"], rows:[
            ["Next.js frontend",      "Dashboards, onboarding, docs, and marketplace browsing."],
            ["Express backend",       "Auth, routing, billing, queueing, and admin controls."],
            ["Provider daemon",       "Heartbeat every 30s, readiness checks, and secure containerized execution."],
            ["Supabase sync bridge",  "Periodic replication for analytics and real-time UI views."],
          ]},

          { type:"h3", text:"Security and trust boundaries" },
          { type:"steps", items:[
            ["•","API keys are role-scoped: provider, renter, admin."],
            ["•","Admin operations require x-admin-token."],
            ["•","Job and daemon endpoints enforce role checks and status transitions."],
            ["•","Standard error format across API."],
          ]},
          { type:"code", tabs:{ json: `{ "error": "descriptive message" }` }},

          { type:"h3", text:"Billing model summary" },
          { type:"steps", items:[
            ["•","Currency: SAR, internal unit: halala."],
            ["•","A prepay estimate is reserved at submit time."],
            ["•","Final settlement uses actual completed runtime; unused reserved amount is handled through balance updates."],
            ["•","Revenue split on completed fees: provider 75%, DCP 25%."],
          ]},

          { type:"h3", text:"Operational notes" },
          { type:"steps", items:[
            ["•","Provider heartbeats every 30 seconds drive online/stale/offline state."],
            ["•","Rate limits and CORS protections are enforced at API layer."],
            ["•","Queue visibility is scoped by actor for tenant isolation."],
          ]},

          { type:"h3", text:"Related docs" },
          { type:"cards", items:[
            ["Quickstart",      "Account to first workload",   "quickstart"],
            ["Provider Guide",  "Earn as a GPU provider",       "provider-guide"],
            ["Renter Guide",    "Ship LLM workloads",           "renter-guide"],
            ["API Reference",   "Auth, endpoints, errors",      "api-reference"],
          ]},
        ],
      },
      ar: {
        title: "نظرة معمارية",
        kicker: "المعمارية",
        summary: "خريطة شاملة للنظام: واجهة Next.js، وواجهة Express الخلفية، وخدمة المزوّد، ومزامنة البيانات.",
        toc: ["البنية","تدفّق الطلب","الخدمات","الأمن","الفوترة"],
        blocks: [
          { type:"h3", text:"بنية المنصة" },
          { type:"p", text:"تعمل DCP كبنية ثلاثية المستويات: مستوى التحكّم (الويب + API)، ومستوى التنفيذ (GPU المزوّدين)، ومستوى البيانات (SQLite + مزامنة Supabase)." },
        ],
      },
    },

    // ───────────────────── API REFERENCE ─────────────────────
    "api-reference": {
      en: {
        title: "API Reference",
        kicker: "Reference",
        summary: "Auth model, core endpoint map, runtime examples, and error contract for DCP provider/renter/admin integrations.",
        toc: ["Base URLs","Authentication model","Error contract","/v1 deterministic error envelope","Renter registration","Provider heartbeat","Job submission","Admin dashboard","OpenAPI source"],
        blocks: [

          { type:"h3", text:"Base URLs" },
          { type:"table", headers:["Surface","URL"], rows:[
            ["Public proxy",            "https://dcp.sa/api/dc1"],
            ["Direct API (ops/debug)",  "https://api.dcp.sa/api"],
          ]},

          { type:"h3", text:"Authentication model" },
          { type:"table", headers:["Role","Header / query"], rows:[
            ["Provider", "x-provider-key header or ?key= query"],
            ["Renter",   "x-renter-key header or ?key= query"],
            ["Admin",    "x-admin-token header (or Authorization: Bearer <token>)"],
          ]},
          { type:"p", text:"Key examples:" },
          { type:"code", tabs:{
            shell: `dc1-provider-...
dc1-renter-...`,
          }},

          { type:"h3", text:"Error contract" },
          { type:"p", text:"All failures return JSON:" },
          { type:"code", tabs:{ json: `{ "error": "descriptive message" }` }},
          { type:"p", text:"Example (400):" },
          { type:"code", tabs:{ json: `{ "error": "Missing required fields: job_type, duration_minutes" }` }},

          { type:"h3", text:"/v1 deterministic error envelope" },
          { type:"p", text:"/v1 endpoints (/v1/models, /v1/chat/completions) return a canonical machine-readable envelope:" },
          { type:"code", tabs:{ json: `{
  "error": {
    "message": "Provider failover exhausted after initial error: timeout",
    "type": "timeout_error",
    "code": "upstream_timeout",
    "status": 504,
    "retryable": true
  }
}` }},
          { type:"p", text:"For rate limits (429), retry metadata is always present:" },
          { type:"code", tabs:{ json: `{
  "error": {
    "message": "Rate limit exceeded. Retry after N seconds.",
    "type": "rate_limit_error",
    "code": "rate_limit_exceeded",
    "status": 429,
    "retryable": true,
    "retry_after_seconds": 10,
    "retry_after_ms": 10000
  },
  "retry_after_seconds": 10,
  "retry_after_ms": 10000
}` }},
          { type:"callout", kind:"tip", title:"SDK retry guidance for /v1",
            text:"Retry with backoff when error.code is rate_limit_exceeded, no_capacity_available, provider_unavailable, or upstream_timeout. Use retry_after_seconds when present (especially on 429). Do not retry without request changes on non-retryable validation/auth/billing errors." },

          { type:"h2", text:"Critical endpoint parity examples" },
          { type:"p", text:"The following examples are aligned with production route contracts in backend/src/routes/*.js and docs/openapi.yaml." },

          // ─── 1) Renter registration
          { type:"h3", text:"1) Renter registration — POST /renters/register" },
          { type:"code", tabs:{
            curl: `curl -s -X POST "https://dcp.sa/api/dc1/renters/register" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Fatima Al-Saud",
    "email": "fatima@example.sa",
    "organization": "Riyadh AI Lab",
    "use_case": "llm_inference",
    "phone": "+966500000000"
  }'`,
            node: `const res = await fetch('https://dcp.sa/api/dc1/renters/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'Fatima Al-Saud',
    email: 'fatima@example.sa',
    organization: 'Riyadh AI Lab',
    use_case: 'llm_inference',
    phone: '+966500000000',
  }),
})
const data = await res.json()
if (!res.ok) throw new Error(data.error)`,
            python: `import requests

res = requests.post(
    "https://dcp.sa/api/dc1/renters/register",
    json={
        "name": "Fatima Al-Saud",
        "email": "fatima@example.sa",
        "organization": "Riyadh AI Lab",
        "use_case": "llm_inference",
        "phone": "+966500000000",
    },
    timeout=30,
)
res.raise_for_status()
print(res.json())`,
          }},
          { type:"p", text:"Success response (201):" },
          { type:"code", tabs:{ json: `{
  "success": true,
  "renter_id": 42,
  "api_key": "dc1-renter-abc123...",
  "message": "Welcome Fatima Al-Saud! Save your API key — it won't be shown again."
}` }},

          // ─── 2) Provider heartbeat
          { type:"h3", text:"2) Provider heartbeat — POST /providers/heartbeat" },
          { type:"code", tabs:{
            curl: `curl -s -X POST "https://dcp.sa/api/dc1/providers/heartbeat" \\
  -H "Content-Type: application/json" \\
  -d '{
    "api_key": "dc1-provider-abc123...",
    "gpu_status": {
      "gpu_name": "NVIDIA RTX 4090",
      "gpu_vram_mib": 24576,
      "gpu_util_pct": 12,
      "temp_c": 48,
      "daemon_version": "1.3.0",
      "python_version": "3.11.6",
      "os_info": "Ubuntu 22.04"
    },
    "provider_hostname": "gpu-host-01",
    "cached_models": ["TinyLlama/TinyLlama-1.1B-Chat-v1.0"]
  }'`,
            node: `const hb = await fetch('https://dcp.sa/api/dc1/providers/heartbeat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    api_key: process.env.DC1_PROVIDER_KEY,
    gpu_status: {
      gpu_name: 'NVIDIA RTX 4090',
      gpu_vram_mib: 24576,
      gpu_util_pct: 12,
      temp_c: 48,
      daemon_version: '1.3.0',
    },
  }),
})
const hbData = await hb.json()
if (!hb.ok) throw new Error(hbData.error)`,
            python: `import requests

hb = requests.post(
    "https://dcp.sa/api/dc1/providers/heartbeat",
    json={
        "api_key": "dc1-provider-abc123...",
        "gpu_status": {
            "gpu_name": "NVIDIA RTX 4090",
            "gpu_vram_mib": 24576,
            "gpu_util_pct": 12,
            "temp_c": 48,
            "daemon_version": "1.3.0",
        },
    },
    timeout=30,
)
hb.raise_for_status()
print(hb.json())`,
          }},
          { type:"p", text:"Success response (200):" },
          { type:"code", tabs:{ json: `{
  "success": true,
  "message": "Heartbeat received",
  "timestamp": "2026-04-22T19:30:00.000Z",
  "needs_update": false,
  "latest_version": "1.3.0",
  "update_available": false,
  "min_version": "1.3.0",
  "approval_status": "approved",
  "approved": true,
  "preload_model": null
}` }},

          // ─── 3) Job submission
          { type:"h3", text:"3) Job submission — POST /jobs/submit" },
          { type:"code", tabs:{
            curl: `curl -s -X POST "https://dcp.sa/api/dc1/jobs/submit" \\
  -H "Content-Type: application/json" \\
  -H "x-renter-key: $RENTER_KEY" \\
  -d '{
    "provider_id": 26,
    "job_type": "llm_inference",
    "duration_minutes": 5,
    "max_duration_seconds": 600,
    "container_spec": { "image_type": "vllm-serve" },
    "params": {
      "model": "TinyLlama/TinyLlama-1.1B-Chat-v1.0",
      "prompt": "Summarize DCP in three bullets"
    }
  }'`,
            node: `const submit = await fetch('https://dcp.sa/api/dc1/jobs/submit', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-renter-key': process.env.DC1_RENTER_KEY,
  },
  body: JSON.stringify({
    provider_id: 26,
    job_type: 'llm_inference',
    duration_minutes: 5,
    max_duration_seconds: 600,
    container_spec: { image_type: 'vllm-serve' },
    params: {
      model: 'TinyLlama/TinyLlama-1.1B-Chat-v1.0',
      prompt: 'Summarize DCP in three bullets',
    },
  }),
})
const submitted = await submit.json()
if (!submit.ok) throw new Error(submitted.error)`,
            python: `import requests

submitted = requests.post(
    "https://dcp.sa/api/dc1/jobs/submit",
    headers={
        "Content-Type": "application/json",
        "x-renter-key": "dc1-renter-abc123...",
    },
    json={
        "provider_id": 26,
        "job_type": "llm_inference",
        "duration_minutes": 5,
        "max_duration_seconds": 600,
        "container_spec": {"image_type": "vllm-serve"},
        "params": {
            "model": "TinyLlama/TinyLlama-1.1B-Chat-v1.0",
            "prompt": "Summarize DCP in three bullets",
        },
    },
    timeout=30,
)
submitted.raise_for_status()
print(submitted.json())`,
          }},
          { type:"p", text:"Success response (201):" },
          { type:"code", tabs:{ json: `{
  "success": true,
  "job": {
    "id": 1234,
    "job_id": "job-1234-ab12cd",
    "provider_id": 26,
    "renter_id": 42,
    "job_type": "llm_inference",
    "model": "TinyLlama/TinyLlama-1.1B-Chat-v1.0",
    "status": "pending",
    "submitted_at": "2026-04-22T19:30:00.000Z",
    "duration_minutes": 5,
    "cost_halala": 200,
    "max_duration_seconds": 600,
    "timeout_at": "2026-04-22 19:40:00.000",
    "gpu_requirements": null,
    "container_spec": { "image_type": "vllm-serve", "pricing_class": "standard" },
    "workspace_volume_name": "dcp-job-job-1234-ab12cd",
    "checkpoint_enabled": false,
    "task_spec_signed": true,
    "priority": 0,
    "pricing_class": "standard",
    "prewarm_requested": false,
    "queue_position": null
  }
}` }},

          // ─── 4) Admin dashboard
          { type:"h3", text:"4) Admin dashboard — GET /admin/dashboard" },
          { type:"code", tabs:{
            curl: `curl -s "https://dcp.sa/api/dc1/admin/dashboard" \\
  -H "x-admin-token: $DC1_ADMIN_TOKEN"`,
            node: `const dash = await fetch('https://dcp.sa/api/dc1/admin/dashboard', {
  headers: { 'x-admin-token': process.env.DC1_ADMIN_TOKEN },
})
const dashboard = await dash.json()
if (!dash.ok) throw new Error(dashboard.error)`,
            python: `import requests

dashboard = requests.get(
    "https://dcp.sa/api/dc1/admin/dashboard",
    headers={"x-admin-token": "<DC1_ADMIN_TOKEN>"},
    timeout=30,
)
dashboard.raise_for_status()
print(dashboard.json())`,
          }},
          { type:"p", text:"Success response (200) shape:" },
          { type:"code", tabs:{ json: `{
  "stats": {
    "total_providers": 40,
    "online_now": 28,
    "offline": 12,
    "total_renters": 312,
    "active_renters": 84,
    "total_renter_balance_halala": 1850000,
    "total_jobs": 9400,
    "completed_jobs": 8800,
    "failed_jobs": 120,
    "active_jobs": 18,
    "total_revenue_halala": 3200000,
    "total_dc1_fees_halala": 800000,
    "today_revenue_halala": 42000,
    "today_dc1_fees_halala": 10500,
    "today_jobs": 140,
    "timestamp": "2026-04-22T19:30:00.000Z"
  },
  "gpu_breakdown": [],
  "recent_signups": [],
  "recent_heartbeats": []
}` }},

          { type:"h3", text:"OpenAPI source" },
          { type:"cards", items:[
            ["API docs page",              "Human-readable",                    "api-reference"],
            ["/docs/openapi.yaml",         "Machine-readable",                  "api-reference"],
            ["Runtime Verification",       "Runbook for runtime checks",        "runtime-verification"],
          ]},
        ],
      },
      ar: {
        title: "مرجع API",
        kicker: "المرجع",
        summary: "نموذج المصادقة، وخريطة النقاط الأساسية، وأمثلة زمن التشغيل، وعقد الأخطاء لتكاملات مزوّد/مستأجر/مسؤول DCP.",
        toc: ["عناوين URL","المصادقة","عقد الأخطاء"],
        blocks: [
          { type:"h3", text:"عناوين URL الأساسية" },
          { type:"table", headers:["السطح","العنوان"], rows:[
            ["الوكيل العام", "https://dcp.sa/api/dc1"],
            ["API المباشر",  "https://api.dcp.sa/api"],
          ]},
          { type:"h3", text:"نموذج المصادقة" },
          { type:"p", text:"المفاتيح مقسّمة حسب الدور: x-provider-key للمزوّد، x-renter-key للمستأجر، x-admin-token للمسؤول." },
        ],
      },
    },

    // ───────────────────── MODEL CARDS / CATALOG ─────────────────────
    "model-cards": {
      en: {
        title: "Model Cards",
        kicker: "Reference",
        summary: "Model cards describe each hosted model — intended use, limitations, context length, and pricing class. Pick a specific model from the catalog to see its card.",
        toc: ["Catalog"],
        blocks: [
          { type:"h3", text:"Catalog" },
          { type:"cards", items:[
            ["ALLaM 7B Instruct",       "SDAIA — Arabic instruct model",  "model-allam-7b"],
            ["Falcon H1 7B Instruct",   "TII — reasoning and long context","model-falcon-h1-7b"],
            ["JAIS 13B Chat",           "Inception — Arabic chat",        "model-jais-13b"],
            ["BGE-M3 Embeddings",       "BAAI — multilingual embeddings", "model-bge-m3"],
            ["BGE Reranker v2 M3",      "BAAI — cross-encoder reranker",  "model-bge-reranker"],
            ["Llama 3 8B Instruct",     "Meta — general instruct",        "model-llama-3-8b"],
            ["Mistral 7B Instruct v0.2","Mistral — general instruct",     "model-mistral-7b"],
            ["Stable Diffusion XL 1.0", "Stability — image generation",   "model-sdxl"],
            ["TinyLlama 1.1B Chat",     "Small chat model",               "model-tinyllama"],
            ["Phi-2",                   "Microsoft — small reasoning",    "model-phi-2"],
          ]},
        ],
      },
      ar: {
        title: "بطاقات النماذج",
        kicker: "المرجع",
        summary: "تصف بطاقات النماذج كل نموذج مستضاف — الاستخدام المقصود والقيود وطول السياق وفئة التسعير.",
        toc: ["الدليل"],
        blocks: [],
      },
    },

    "models-index": {
      en: {
        title: "DCP Model Catalog",
        kicker: "Models",
        summary: "The full list of models currently deployable on DCP. Select one to see its card, quota limits, and example requests.",
        toc: ["Catalog"],
        blocks: [
          { type:"p", text:"Models are surfaced via GET /v1/models (no auth required) and through the marketplace UI at dcp.sa/renter/marketplace. The following are the models listed on dcp.sa/docs:" },
          { type:"table", headers:["Model","Org","Best for"], rows:[
            ["ALLaM 7B Instruct",       "SDAIA",      "Arabic instruct"],
            ["Falcon H1 7B Instruct",   "TII",        "Reasoning · long context"],
            ["JAIS 13B Chat",           "Inception",  "Arabic chat"],
            ["BGE-M3 Embeddings",       "BAAI",       "Multilingual embeddings"],
            ["BGE Reranker v2 M3",      "BAAI",       "Cross-encoder reranker"],
            ["Llama 3 8B Instruct",     "Meta",       "General instruct"],
            ["Mistral 7B Instruct v0.2","Mistral AI", "General instruct"],
            ["Stable Diffusion XL 1.0", "Stability",  "Image generation"],
            ["TinyLlama 1.1B Chat",     "TinyLlama",  "Small chat"],
            ["Phi-2",                   "Microsoft",  "Small reasoning"],
          ]},
        ],
      },
      ar: { title:"دليل النماذج", kicker:"النماذج", summary:"قائمة النماذج المتاحة للنشر على DCP.", toc:["الدليل"], blocks:[] },
    },

    // ───── Individual model cards — stubs pointing at the live URL ─────
    "model-allam-7b": {
      en: { title:"ALLaM 7B Instruct", kicker:"Model card",
        summary:"SDAIA's Arabic-tuned 7B instruct model. Full model card is maintained on dcp.sa/docs/models/allam-7b.",
        toc:["See the live model card"],
        blocks:[
          { type:"callout", kind:"note", title:"Model cards live on dcp.sa",
            text:"To avoid drift, individual model cards (intended use, eval, limitations, licensing) are read directly from the live docs. Open dcp.sa/docs/models/allam-7b for the canonical card." },
          { type:"cards", items:[["Back to catalog","All supported models","models-index"]]},
        ]},
      ar: { title:"ALLaM 7B Instruct", kicker:"بطاقة النموذج", summary:"نموذج SDAIA العربي للتعليمات بحجم ‎7B‎.", toc:[], blocks:[] },
    },
    "model-falcon-h1-7b": {
      en: { title:"Falcon H1 7B Instruct", kicker:"Model card",
        summary:"TII's Falcon H1 7B instruct model. Canonical card on dcp.sa/docs/models/falcon-h1-7b.",
        toc:[], blocks:[
          { type:"callout", kind:"note", title:"Model cards live on dcp.sa",
            text:"Individual model cards are read directly from the live docs. Open dcp.sa/docs/models/falcon-h1-7b for the canonical card." },
        ]},
      ar: { title:"Falcon H1 7B Instruct", kicker:"بطاقة النموذج", summary:"نموذج Falcon H1 من TII.", toc:[], blocks:[] },
    },
    "model-jais-13b": {
      en: { title:"JAIS 13B Chat", kicker:"Model card",
        summary:"Inception's JAIS 13B chat model. Canonical card on dcp.sa/docs/models/jais-13b.",
        toc:[], blocks:[
          { type:"callout", kind:"note", title:"Model cards live on dcp.sa",
            text:"Open dcp.sa/docs/models/jais-13b for the canonical card." }] },
      ar: { title:"JAIS 13B Chat", kicker:"بطاقة النموذج", summary:"نموذج JAIS من Inception.", toc:[], blocks:[] },
    },
    "model-bge-m3": {
      en: { title:"BGE-M3 Embeddings", kicker:"Model card",
        summary:"BAAI's BGE-M3 multilingual embedding model. Canonical card on dcp.sa/docs/models/bge-m3.",
        toc:[], blocks:[
          { type:"callout", kind:"note", title:"Model cards live on dcp.sa",
            text:"Open dcp.sa/docs/models/bge-m3 for the canonical card." }] },
      ar: { title:"BGE-M3", kicker:"بطاقة النموذج", summary:"نموذج BGE-M3 من BAAI.", toc:[], blocks:[] },
    },
    "model-bge-reranker": {
      en: { title:"BGE Reranker v2 M3", kicker:"Model card",
        summary:"BAAI's BGE reranker. Canonical card on dcp.sa/docs/models/bge-reranker-v2-m3.",
        toc:[], blocks:[] },
      ar: { title:"BGE Reranker v2 M3", kicker:"بطاقة النموذج", summary:"نموذج إعادة الترتيب من BAAI.", toc:[], blocks:[] },
    },
    "model-llama-3-8b": {
      en: { title:"Llama 3 8B Instruct", kicker:"Model card",
        summary:"Meta's Llama 3 8B instruct model. Canonical card on dcp.sa/docs/models/llama-3-8b-instruct.",
        toc:[], blocks:[] },
      ar: { title:"Llama 3 8B Instruct", kicker:"بطاقة النموذج", summary:"نموذج Llama 3 من Meta.", toc:[], blocks:[] },
    },
    "model-mistral-7b": {
      en: { title:"Mistral 7B Instruct v0.2", kicker:"Model card",
        summary:"Mistral AI's 7B instruct v0.2. Canonical card on dcp.sa/docs/models/mistral-7b-instruct-v0-2.",
        toc:[], blocks:[] },
      ar: { title:"Mistral 7B Instruct v0.2", kicker:"بطاقة النموذج", summary:"Mistral 7B Instruct v0.2.", toc:[], blocks:[] },
    },
    "model-sdxl": {
      en: { title:"Stable Diffusion XL Base 1.0", kicker:"Model card",
        summary:"Stability AI's SDXL base. Canonical card on dcp.sa/docs/models/sdxl-base-1-0.",
        toc:[], blocks:[] },
      ar: { title:"SDXL 1.0", kicker:"بطاقة النموذج", summary:"نموذج توليد الصور SDXL.", toc:[], blocks:[] },
    },
    "model-tinyllama": {
      en: { title:"TinyLlama 1.1B Chat", kicker:"Model card",
        summary:"TinyLlama 1.1B chat. Canonical card on dcp.sa/docs/models/tinyllama-1-1b-chat.",
        toc:[], blocks:[] },
      ar: { title:"TinyLlama 1.1B Chat", kicker:"بطاقة النموذج", summary:"نموذج دردشة صغير.", toc:[], blocks:[] },
    },
    "model-phi-2": {
      en: { title:"Phi-2", kicker:"Model card",
        summary:"Microsoft's Phi-2. Canonical card on dcp.sa/docs/models/phi-2.",
        toc:[], blocks:[] },
      ar: { title:"Phi-2", kicker:"بطاقة النموذج", summary:"نموذج Phi-2 من Microsoft.", toc:[], blocks:[] },
    },

    // ───────────────────── SDKs ─────────────────────
    "sdk-python": {
      en: {
        title: "SDK · Python",
        kicker: "SDK",
        summary: "Install the official OpenAI Python SDK and point it at api.dcp.sa/v1. DCP is OpenAI-compatible so no DCP-specific package is required.",
        toc: ["Install","Inference","Check balance"],
        blocks: [
          { type:"h3", text:"Install" },
          { type:"code", tabs:{ shell: `pip install openai` }},
          { type:"h3", text:"Inference" },
          { type:"code", tabs:{ python:
`from openai import OpenAI

client = OpenAI(
    base_url="https://api.dcp.sa/v1",
    api_key="YOUR_RENTER_KEY"
)

response = client.chat.completions.create(
    model="qwen3-30b-a3b",
    messages=[{"role": "user", "content": "Hello"}],
    max_tokens=100
)
print(response.choices[0].message.content)` }},
          { type:"h3", text:"Check balance" },
          { type:"code", tabs:{ python:
`import os, requests

res = requests.get(
    "https://api.dcp.sa/api/renters/me",
    headers={"x-renter-key": os.environ["DCP_RENTER_KEY"]},
    timeout=30,
)
data = res.json()
print(data["name"], data["balance_halala"], "halala")` }},
        ],
      },
      ar: { title:"Python SDK", kicker:"SDK", summary:"استخدم حزمة openai الرسمية ووجّهها إلى api.dcp.sa/v1.", toc:[], blocks:[] },
    },

    "sdk-js": {
      en: {
        title: "SDK · JavaScript",
        kicker: "SDK",
        summary: "Typed renter workflows from backend services. Install the official OpenAI Node/TS SDK and swap the base URL.",
        toc: ["Install","Inference","Verify connectivity"],
        blocks: [
          { type:"h3", text:"Install" },
          { type:"code", tabs:{ shell: `npm install openai` }},
          { type:"h3", text:"Inference" },
          { type:"code", tabs:{ node:
`import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "https://api.dcp.sa/v1",
  apiKey: process.env.DCP_RENTER_KEY,
});

const response = await client.chat.completions.create({
  model: "qwen3-30b-a3b",
  messages: [{ role: "user", content: "Explain transformer attention in 2 lines." }],
  max_tokens: 100,
});

console.log(response.choices[0].message.content);` }},
          { type:"h3", text:"Verify connectivity" },
          { type:"code", tabs:{ node:
`// Check balance
const res = await fetch("https://api.dcp.sa/api/renters/me", {
  headers: { "x-renter-key": process.env.DCP_RENTER_KEY }
});
const data = await res.json();
console.log(data.name, data.balance_halala + " halala");` }},
          { type:"p", text:"Expected: your renter profile JSON with email and balance fields." },
        ],
      },
      ar: { title:"JavaScript SDK", kicker:"SDK", summary:"استخدم حزمة openai الرسمية لـ Node/TS.", toc:[], blocks:[] },
    },

    "sdk-cli": {
      en: {
        title: "SDK · CLI",
        kicker: "SDK",
        summary: "DCP exposes a CLI for quick renter workflows and smoke tests. Full command reference is maintained on dcp.sa/docs/sdk-cli.",
        toc: ["Install","Common commands"],
        blocks: [
          { type:"callout", kind:"note", title:"Canonical source",
            text:"The authoritative command list lives at dcp.sa/docs/sdk-cli. Use that page for the up-to-date flag list." },
        ],
      },
      ar: { title:"CLI", kicker:"SDK", summary:"أداة سطر الأوامر للمستأجرين.", toc:[], blocks:[] },
    },

    // ───────────────────── GUIDES ─────────────────────
    "renter-guide": {
      en: {
        title: "Renter Guide",
        kicker: "Guide",
        summary: "End-to-end renter workflow: register, fund, choose a GPU, submit a job, monitor output. Full guide on dcp.sa/docs/renter-guide.",
        toc: ["Workflow"],
        blocks: [
          { type:"steps", items:[
            ["1","Register at dcp.sa/renter/register"],
            ["2","Top up in SAR at dcp.sa/renter/billing"],
            ["3","Pick a compatible provider at dcp.sa/renter/marketplace"],
            ["4","Submit a job at dcp.sa/renter/playground?starter=1"],
            ["5","Monitor output & logs at dcp.sa/renter/jobs"],
          ]},
          { type:"callout", kind:"note", title:"Canonical guide",
            text:"Open dcp.sa/docs/renter-guide for the full renter handbook." },
        ],
      },
      ar: { title:"دليل المستأجر", kicker:"دليل", summary:"سير العمل الكامل للمستأجر.", toc:[], blocks:[] },
    },

    "provider-guide": {
      en: {
        title: "Provider Guide",
        kicker: "Guide",
        summary: "Register your GPU (NVIDIA or Apple Silicon), download the 4 MB app, and go online. No Docker needed. Full guide on dcp.sa/docs/provider-guide.",
        toc: ["Supported hardware","Workflow"],
        blocks: [
          { type:"h3", text:"Supported hardware" },
          { type:"p", text:"DCP job execution runs via Ollama (Windows/Linux) or MLX (macOS Apple Silicon) inference engines." },
          { type:"h3", text:"Workflow" },
          { type:"steps", items:[
            ["1","Register at dcp.sa/setup"],
            ["2","Download and run the 4 MB provider app"],
            ["3","Confirm heartbeat approval via GET /providers/heartbeat (every 30 seconds)"],
            ["4","Accept jobs and earn 75% of settled halala per completion"],
          ]},
          { type:"callout", kind:"note", title:"Canonical guide",
            text:"Open dcp.sa/docs/provider-guide for the full provider handbook." },
        ],
      },
      ar: { title:"دليل المزوّد", kicker:"دليل", summary:"سجّل GPU وحمّل التطبيق وابدأ.", toc:[], blocks:[] },
    },

    "enterprise-sla": {
      en: {
        title: "Enterprise SLA and Trust Commitments",
        kicker: "Enterprise",
        summary: "SLA and trust commitments for enterprise renters. Full commitments on dcp.sa/docs/enterprise-trust-package/section-5-sla-trust.",
        toc: [],
        blocks: [
          { type:"callout", kind:"note", title:"Canonical document",
            text:"Open dcp.sa/docs/enterprise-trust-package/section-5-sla-trust for the current, binding commitments." },
        ],
      },
      ar: { title:"اتفاقية مستوى الخدمة والتزامات الثقة للمؤسسات", kicker:"مؤسسات", summary:"التزامات SLA للمستأجرين المؤسسيين.", toc:[], blocks:[] },
    },

    "runtime-verification": {
      en: {
        title: "Runtime Verification Runbook",
        kicker: "Ops",
        summary: "Operational runbook for verifying runtime behaviour against production contracts. Full runbook on dcp.sa/docs/ops/runtime-verification.",
        toc: [],
        blocks: [
          { type:"callout", kind:"note", title:"Canonical runbook",
            text:"Open dcp.sa/docs/ops/runtime-verification for the current runbook." },
        ],
      },
      ar: { title:"Runtime Verification", kicker:"العمليات", summary:"كتيّب تشغيل التحقّق من وقت التشغيل.", toc:[], blocks:[] },
    },
  },
};
