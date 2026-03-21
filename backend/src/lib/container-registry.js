const TEMPLATE_IMAGES = [
  'dc1/general-worker:latest',
  'dc1/llm-worker:latest',
  'dc1/sd-worker:latest',
  'dc1/base-worker:latest',
  'pytorch/pytorch:2.1.0-cuda11.8-cudnn8-runtime',
  'pytorch/pytorch:2.2.0-cuda12.1-cudnn8-runtime',
  'nvcr.io/nvidia/pytorch:24.01-py3',
  'nvcr.io/nvidia/tensorflow:24.01-tf2-py3',
  'tensorflow/tensorflow:2.15.0-gpu',
  'vllm/vllm-openai:latest',
  'dcp/pytorch-cuda:latest',
  'dcp/vllm-serve:latest',
  'dcp/training:latest',
  'dcp/rendering:latest',
];

const TEMPLATE_IMAGE_SET = new Set(TEMPLATE_IMAGES.map((ref) => ref.toLowerCase()));
const SHA256_SUFFIX_RE = /@sha256:[a-f0-9]{64}$/i;
const GENERIC_IMAGE_RE = /^[a-z0-9][a-z0-9._/-]*(?::[a-zA-Z0-9._-]{1,128})?(?:@sha256:[a-f0-9]{64})?$/;

function normalizeString(value, { maxLen = 500 } = {}) {
  if (typeof value !== 'string') return null;
  const next = value.trim();
  if (!next) return null;
  return next.slice(0, maxLen);
}

function normalizeImageRef(imageRef) {
  const normalized = normalizeString(imageRef, { maxLen: 300 });
  return normalized || null;
}

function isDockerHubImageRef(imageRef) {
  return String(imageRef || '').toLowerCase().startsWith('hub.docker.com/r/');
}

function validateAndNormalizeImageRef(imageRef) {
  const normalized = normalizeImageRef(imageRef);
  if (!normalized) {
    return { error: 'container_spec.image must be a non-empty string' };
  }

  const lower = normalized.toLowerCase();
  if (isDockerHubImageRef(lower)) {
    const repo = lower.slice('hub.docker.com/r/'.length);
    const hasRepo = repo.includes('/');
    const hasTag = /:[^/@]+/.test(repo);
    const hasDigest = SHA256_SUFFIX_RE.test(lower);
    if (!hasRepo || !hasTag) {
      return { error: 'Docker Hub image must use format hub.docker.com/r/user/image:tag@sha256:<digest>' };
    }
    if (!hasDigest) {
      return { error: 'Docker Hub image must be SHA256-pinned: append @sha256:<64-hex>' };
    }
    return { value: normalized };
  }

  if (!GENERIC_IMAGE_RE.test(lower)) {
    return { error: 'Invalid container image reference' };
  }
  return { value: normalized };
}

function isTemplateImage(imageRef) {
  const normalized = normalizeImageRef(imageRef);
  if (!normalized) return false;
  return TEMPLATE_IMAGE_SET.has(normalized.toLowerCase());
}

function isApprovedImageRef(db, imageRef) {
  const normalized = normalizeImageRef(imageRef);
  if (!normalized) return false;
  if (isTemplateImage(normalized)) return true;

  try {
    const row = db.get(
      'SELECT id FROM allowed_images WHERE lower(image_ref) = lower(?) LIMIT 1',
      normalized
    );
    return !!row;
  } catch (_) {
    return false;
  }
}

function listContainerRegistry(db) {
  const out = [];
  const seen = new Set();

  for (const imageRef of TEMPLATE_IMAGES) {
    const key = imageRef.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      id: null,
      image_ref: imageRef,
      image_type: 'template',
      description: 'Built-in DCP template image',
      approved_at: null,
      source: 'template',
    });
  }

  try {
    const rows = db.all(
      `SELECT id, image_ref, image_type, description, approved_at
       FROM allowed_images
       ORDER BY approved_at DESC, id DESC`
    ) || [];

    for (const row of rows) {
      const key = String(row.image_ref || '').toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push({
        id: row.id,
        image_ref: row.image_ref,
        image_type: row.image_type || 'custom',
        description: row.description || null,
        approved_at: row.approved_at || null,
        source: 'allowed',
      });
    }
  } catch (_) {
    // allowed_images table may not exist during early migrations
  }

  return out;
}

module.exports = {
  TEMPLATE_IMAGES,
  normalizeImageRef,
  validateAndNormalizeImageRef,
  isDockerHubImageRef,
  isTemplateImage,
  isApprovedImageRef,
  listContainerRegistry,
};
