# Unlimited-OCR gateway

This small HTTP service renders only the scanned PDF pages selected by the
Supabase `process-user-document` Edge Function, then sends each page to a
Baidu Unlimited-OCR vLLM-compatible endpoint. It is an adapter; it does not
download or run the model itself.

## Run the model server

Follow the supported hardware and deployment recipe in the
[Baidu Unlimited-OCR repository](https://github.com/baidu/Unlimited-OCR) and
the [vLLM serving recipe](https://recipes.vllm.ai/baidu/Unlimited-OCR). The
model requires a GPU and its no-repeat n-gram logits processor. A typical
server listens on port 8000 and uses `baidu/Unlimited-OCR` as the model name.

## Build and run the gateway

Build the container in this directory:

```powershell
docker build -t legalens-unlimited-ocr-gateway .
```

Set the gateway key through your deployment's secret manager. Restrict network
access so only the Supabase Edge Function can reach the gateway and the gateway
can reach the vLLM server. Terminate TLS at a private reverse proxy; do not
expose the unauthenticated model endpoint to the public internet. Use a
randomly generated key with at least 32 characters.

```powershell
docker run --detach --name legalens-unlimited-ocr-gateway `
  --restart unless-stopped `
  -p 127.0.0.1:8080:8080 `
  -e OCR_GATEWAY_API_KEY="<secret-from-secret-manager>" `
  -e VLLM_API_BASE_URL="http://<private-vllm-host>:8000/v1" `
  legalens-unlimited-ocr-gateway
```

Set `VLLM_API_KEY` if the model server requires bearer authentication. The
gateway also accepts `VLLM_MODEL` and `OCR_GATEWAY_PORT`; their defaults are
`baidu/Unlimited-OCR` and `8080`. Its `/health` endpoint reports process
readiness. The authenticated `POST /v1/ocr/pdf?pages=1,3` endpoint accepts
`application/pdf` and returns recognized text keyed by PDF page number.

Set `UNLIMITED_OCR_GATEWAY_URL` to the gateway's private HTTPS base URL and
`UNLIMITED_OCR_GATEWAY_KEY` to the same secret in Supabase Edge Function
secrets. Only pages with fewer than 40 extracted characters are sent for OCR,
with a limit of 10 such pages and 200 total PDF pages. The service rejects
pages whose 300-DPI render would exceed its memory guard.

## Tests

With PyMuPDF installed, run:

```powershell
python -m unittest discover -s . -p "test_*.py" -v
```
