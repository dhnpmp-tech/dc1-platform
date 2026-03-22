FROM nvcr.io/nvidia/pytorch:24.01-py3

ENV PYTHONUNBUFFERED=1 \
    HF_HOME=/opt/dcp/model-cache \
    TRANSFORMERS_CACHE=/opt/dcp/model-cache

WORKDIR /opt/dcp/work

COPY run_payload.py /opt/dcp/bin/run_payload.py
COPY dcp-entrypoint.sh /usr/local/bin/dcp-entrypoint.sh
RUN chmod +x /opt/dcp/bin/run_payload.py /usr/local/bin/dcp-entrypoint.sh

ENTRYPOINT ["/usr/local/bin/dcp-entrypoint.sh"]
