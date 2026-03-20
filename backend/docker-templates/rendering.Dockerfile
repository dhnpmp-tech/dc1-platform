FROM nvidia/cuda:12.3.2-runtime-ubuntu22.04

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONUNBUFFERED=1 \
    HF_HOME=/opt/dcp/model-cache \
    TRANSFORMERS_CACHE=/opt/dcp/model-cache

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    ffmpeg \
    imagemagick \
  && rm -rf /var/lib/apt/lists/* \
  && ln -sf /usr/bin/python3 /usr/bin/python

WORKDIR /opt/dcp/work

COPY run_payload.py /opt/dcp/bin/run_payload.py
COPY dcp-entrypoint.sh /usr/local/bin/dcp-entrypoint.sh
RUN chmod +x /opt/dcp/bin/run_payload.py /usr/local/bin/dcp-entrypoint.sh

ENTRYPOINT ["/usr/local/bin/dcp-entrypoint.sh"]
