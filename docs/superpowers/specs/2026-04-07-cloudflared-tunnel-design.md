# cloudflared Tunnel - Design Specification

## Overview

A shell script to tunnel the local terminal server to the internet using cloudflared, enabling access from anywhere.

## Components

- `tunnel.sh` — Executable script that:
  1. Checks if cloudflared is installed, downloads if not
  2. Creates a tunnel to localhost:3000
  3. Displays the public URL

## Usage

```bash
./tunnel.sh
```

## Output

```
Starting tunnel...
Your terminal is available at:
https://random-subdomain.trycloudflare.com
```

## Security Notes

- Tunnel URL is temporary and changes each time
- No authentication on the cloudflared side (anyone with URL can access)
- For personal use only