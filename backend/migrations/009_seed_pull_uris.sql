-- 009_seed_pull_uris.sql
-- Seed ollama_pull_uri + download_size_bytes for the active catalog.
--
-- Pull URIs verified 2026-05-11:
--   - Native Ollama library models use bare tags (e.g. 'qwen3:4b')
--   - Arabic-specific models pull via Ollama's HuggingFace passthrough:
--     `hf.co/<user>/<repo>` — supported since Ollama 0.4
--
-- Size estimates are for Q4_K_M GGUFs (the default community quant).
-- Bytes used to gate pulls against provider disk.

-- ── Arabic-specific (community Q4 GGUFs on HF) ────────────────────────────
UPDATE model_registry SET
  ollama_pull_uri = 'hf.co/Omartificial-Intelligence-Space/ALLaM-7B-Instruct-preview-Q4_K_M-GGUF',
  vllm_model_uri = 'humain-ai/ALLaM-7B-Instruct-preview',
  download_size_bytes = 4500000000
WHERE model_id IN ('allam-7b', 'ALLaM-AI/ALLaM-7B-Instruct-preview', 'allam-7b-instruct')
  AND ollama_pull_uri IS NULL;

UPDATE model_registry SET
  ollama_pull_uri = 'hf.co/MaziyarPanahi/jais-13b-chat-GGUF',
  vllm_model_uri = 'inceptionai/jais-13b-chat',
  download_size_bytes = 8200000000
WHERE model_id LIKE 'jais%' AND ollama_pull_uri IS NULL;

UPDATE model_registry SET
  ollama_pull_uri = 'hf.co/QuantFactory/Falcon3-7B-Instruct-GGUF',
  vllm_model_uri = 'tiiuae/Falcon3-7B-Instruct',
  download_size_bytes = 4800000000
WHERE model_id LIKE 'falcon-h1%' AND ollama_pull_uri IS NULL;

-- ── Ollama-native library models ──────────────────────────────────────────
UPDATE model_registry SET ollama_pull_uri = 'qwen3:4b',        download_size_bytes = 2500000000 WHERE model_id IN ('qwen3-4b', 'qwen3:4b') AND ollama_pull_uri IS NULL;
UPDATE model_registry SET ollama_pull_uri = 'qwen3:8b',        download_size_bytes = 5200000000 WHERE model_id IN ('qwen3-8b', 'qwen3:8b') AND ollama_pull_uri IS NULL;
UPDATE model_registry SET ollama_pull_uri = 'qwen3:14b',       download_size_bytes = 9000000000 WHERE model_id = 'qwen3:14b' AND ollama_pull_uri IS NULL;
UPDATE model_registry SET ollama_pull_uri = 'qwen2.5:7b',      download_size_bytes = 4700000000 WHERE model_id = 'qwen2.5:7b' AND ollama_pull_uri IS NULL;
UPDATE model_registry SET ollama_pull_uri = 'qwen2.5:14b',     download_size_bytes = 9000000000 WHERE model_id = 'qwen2.5:14b' AND ollama_pull_uri IS NULL;
UPDATE model_registry SET ollama_pull_uri = 'llama3.1:8b',     download_size_bytes = 4900000000 WHERE model_id = 'llama3.1:8b' AND ollama_pull_uri IS NULL;
UPDATE model_registry SET ollama_pull_uri = 'mistral:7b',      download_size_bytes = 4400000000 WHERE model_id = 'mistral:7b' AND ollama_pull_uri IS NULL;
UPDATE model_registry SET ollama_pull_uri = 'gemma3:27b',      download_size_bytes = 16000000000 WHERE model_id = 'gemma3:27b' AND ollama_pull_uri IS NULL;
UPDATE model_registry SET ollama_pull_uri = 'glm4:9b',         download_size_bytes = 5800000000 WHERE model_id = 'glm4:9b' AND ollama_pull_uri IS NULL;
UPDATE model_registry SET ollama_pull_uri = 'deepseek-r1:7b',  download_size_bytes = 4700000000 WHERE model_id = 'deepseek-r1:7b' AND ollama_pull_uri IS NULL;
UPDATE model_registry SET ollama_pull_uri = 'nemotron:30b-a3b',download_size_bytes = 18000000000 WHERE model_id = 'nemotron:30b-a3b' AND ollama_pull_uri IS NULL;
UPDATE model_registry SET ollama_pull_uri = 'qwen3:30b-a3b',   download_size_bytes = 18000000000 WHERE model_id IN ('qwen3:30b-a3b', 'qwen3-30b-a3b') AND ollama_pull_uri IS NULL;

-- ── Embeddings / rerankers (smaller) ─────────────────────────────────────
UPDATE model_registry SET
  ollama_pull_uri = 'hf.co/BAAI/bge-m3:latest',
  vllm_model_uri = 'BAAI/bge-m3',
  download_size_bytes = 2300000000
WHERE model_id = 'BAAI/bge-m3' AND ollama_pull_uri IS NULL;

UPDATE model_registry SET
  vllm_model_uri = 'BAAI/bge-reranker-v2-m3',
  download_size_bytes = 580000000
WHERE model_id = 'BAAI/bge-reranker-v2-m3' AND ollama_pull_uri IS NULL;
-- Reranker has no Ollama path; vLLM only.
