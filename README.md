# CRUK Dataset Metadata Catalogue & Semantic Schema Viewer

This repository (`semantic-schema/cruk-semantic-schema`) contains the React component library and interactive documentation viewer for the **CRUK 1.0.0 Semantic Schema**.

---

## 🌟 Architecture & Schema Hydration

To ensure cross-platform compatibility, the catalogue leverages the **HDRUK Health Data Gateway** backend engine. The metadata upload forms and validator interfaces are hydrated dynamically via JSON Schema:

1. **HDRUK Base Schema**: The core structural schema has been agreed with Health Data Research UK (HDRUK) and is maintained in the official [HDRUK Schemata Repository](https://github.com/HDRUK/schemata/tree/main/hdr_schemata/models/CRUK).
2. **CRUK Semantic Schema Overlay**: To provide flexible, easily updated examples, rich domain guidance, and customized field rules without breaking core compatibility, the base HDRUK schema is overlaid with a CRUK Semantic Schema definition.

Together, these schemas merge live to hydrate the complete catalogue dataset forms and interactive documentation viewer.

---

## 🚀 System Setup & Quick Start

### System Architecture Overview

The CRUK Metadata Catalogue consists of five inter-connected repositories:

1. **Frontend Landing Page** (`CRUK_datahub_landing_page`) — [`git@github.com:UOSbioinformaticslab/CRUK_datahub_landing_page.git`](https://github.com/UOSbioinformaticslab/CRUK_datahub_landing_page)
   * **Role**: React/Vite user interface running on `http://localhost:5173`. Provides dataset browsing, search, metadata upload forms, custodian management, and live schema documentation views.
2. **Basic Backend** (`basic/basic_backend`) — [`git@github.com:UOSbioinformaticslab/basic_backend.git`](https://github.com/UOSbioinformaticslab/basic_backend)
   * **Role**: Core FastAPI database backend running on `http://localhost:8000`. Manages Users, Teams, Datasets (JSON metadata blobs & draft states), Projects, Publications, Tools, and Team Invitations.
3. **Middle Layer Proxy** (`middle`) — [`git@github.com:UOSbioinformaticslab/cruk-middle-layer.git`](https://github.com/UOSbioinformaticslab/cruk-middle-layer)
   * **Role**: Administrative FastAPI service running on `http://localhost:8002`. Manages new Data Custodian team request applications (`TeamRequest`) and centralized system error logging (`ErrorLog`).
4. **CRUK Semantic Schema Viewer & Package** (`semantic-schema/cruk-semantic-schema`) — [`git@github.com:UOSbioinformaticslab/cruk-semantic-schema.git`](https://github.com/UOSbioinformaticslab/cruk-semantic-schema) — *(You are here)*
   * **Role**: React component library & standalone interactive UI for rendering the CRUK 1.0.0 semantic schema overlay dynamically fetched from HDRUK schemata.
5. **AI Microservices** (`ai/ai-microservices`) — *Optional / Private Repository* — [`git@github.com:UOSbioinformaticslab/ai-microservices.git`](https://github.com/UOSbioinformaticslab/ai-microservices)
   * **Role**: FastAPI AI microservice running on `http://localhost:8001`. Powered by Google Gemini API for intelligent metadata extraction, automated tagging, and semantic search assistance. Note: This repository is private. If you do not have access to it or do not have a Gemini API key, the rest of the CRUK catalogue will run fully and seamlessly without it.

### Environment Setup (`.env` Configuration)

Each backend service requires a local `.env` configuration file to run:

1. **Automatic `.env` Creation**: Running `./start_all.sh` automatically creates `.env` files from `.env.example` templates if missing.
2. **Manual Setup**:
   ```bash
   cp basic/basic_backend/.env.example basic/basic_backend/.env
   cp middle/.env.example middle/.env
   cp ai/ai-microservices/.env.example ai/ai-microservices/.env  # Optional
   ```
3. **Key Configuration Options**:
   * `basic/basic_backend/.env`: `ADMIN_PASSWORD="your-admin-password"`, `SECRET_KEY`, `DATABASE_URL`.
   * `middle/.env`: `DATABASE_URL`.
   * `ai/ai-microservices/.env`: `GEMINI_API_KEY="your-gemini-key"` *(Optional / Private)*.

### Quick Start (Single Command Setup & Run)

To automatically create a Python virtual environment, install Node & Python dependencies, verify/create `.env` files, and launch all available microservices:

```bash
# Run from workspace root or CRUK_datahub_landing_page
./start_all.sh
```

Press `Ctrl+C` in the terminal to stop all microservices cleanly.

---

## 🌐 Exploring the Live Schema Documentation

- **Live GitHub Pages Site**: You can view the live merged schema, required fields, regex patterns, and guidance on GitHub Pages:
  👉 **[CRUK Semantic Schema Documentation](https://uosbioinformaticslab.github.io/cruk-semantic-schema/)**

- **CRUK Data Holders & Pilot Access**:
  If you are a CRUK data holder and would like to upload your dataset metadata to the catalogue, please get in touch with **Sarah Wooller** ([skw24@sussex.ac.uk](mailto:skw24@sussex.ac.uk)) to request a login for the pilot site. We will then help you onboard and upload your data.
