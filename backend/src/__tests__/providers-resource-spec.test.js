const providersRouter = require('../routes/providers');

describe('providers resource_spec helpers', () => {
  const { discoverComputeTypesFromResourceSpec, inferVramGb } = providersRouter.__private;

  it('discovers compute types from compute_environments and resources', () => {
    const discovered = discoverComputeTypesFromResourceSpec({
      compute_environments: [
        {
          id: 'docker-gpu-1',
          tags: ['cuda', 'llm-serving'],
          compute_types: ['training'],
        },
      ],
      resources: [
        {
          id: 'gpu-a',
          type: 'gpu',
          tags: ['render-node'],
          compute_types: ['inference'],
        },
      ],
    });

    expect(Array.from(discovered).sort()).toEqual(['inference', 'rendering', 'training']);
  });

  it('uses max VRAM across all GPU resources', () => {
    const vramGb = inferVramGb({
      resource_spec: JSON.stringify({
        resources: [
          { id: 'gpu-0', type: 'gpu', vram_gb: 8 },
          { id: 'gpu-1', type: 'gpu', vram_gb: 24 },
        ],
      }),
    });

    expect(vramGb).toBe(24);
  });

  it('falls back to memory_mib when vram_gb is absent', () => {
    const vramGb = inferVramGb({
      resource_spec: JSON.stringify({
        resources: [{ id: 'gpu-0', type: 'gpu', memory_mib: 16384 }],
      }),
    });

    expect(vramGb).toBe(16);
  });
});
