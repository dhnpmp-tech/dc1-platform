FROM python:3.11-slim

WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy P2P source files
COPY config.py .
COPY bootstrap_server.py .
COPY provider_node.py .
COPY renter_client.py .

CMD ["python3", "--version"]
