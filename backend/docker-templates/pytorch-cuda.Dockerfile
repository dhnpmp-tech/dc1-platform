FROM pytorch/pytorch:2.3.1-cuda12.1-cudnn8-runtime

ENV PYTHONUNBUFFERED=1 \
    HF_HOME=/opt/dcp/model-cache \
    TRANSFORMERS_CACHE=/opt/dcp/model-cache

WORKDIR /opt/dcp/work

COPY run_payload.py /opt/dcp/bin/run_payload.py
COPY dcp-entrypoint.sh /usr/local/bin/dcp-entrypoint.sh
RUN chmod +x /opt/dcp/bin/run_payload.py /usr/local/bin/dcp-entrypoint.sh

ENTRYPOINT ["/usr/local/bin/dcp-entrypoint.sh"]
