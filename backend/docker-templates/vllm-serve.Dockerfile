FROM vllm/vllm-openai:v0.5.5

ENV PYTHONUNBUFFERED=1 \
    HF_HOME=/opt/dcp/model-cache \
    TRANSFORMERS_CACHE=/opt/dcp/model-cache \
    VLLM_ALLOW_LONG_MAX_MODEL_LEN=1

WORKDIR /opt/dcp/work

COPY run_payload.py /opt/dcp/bin/run_payload.py
COPY dcp-entrypoint.sh /usr/local/bin/dcp-entrypoint.sh
RUN chmod +x /opt/dcp/bin/run_payload.py /usr/local/bin/dcp-entrypoint.sh

ENTRYPOINT ["/usr/local/bin/dcp-entrypoint.sh"]
