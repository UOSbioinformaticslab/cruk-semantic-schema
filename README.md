# CRUK Dataset Metadata Catalogue & Semantic Schema

The **CRUK Metadata Catalogue** is an online website for exploring the metadata from Cancer Research UK (CRUK) datasets and projects, as well as associated publications and tools. It provides facilities for:
- **Data Custodians**: Uploading and updating dataset metadata.
- **End-Users & Researchers**: Browsing, filtering, searching, and deeply exploring dataset structures and rules.
- **Administrators**: Managing requests to establish new data custodian accounts and team hubs.

---

## Architecture & Schema Hydration

To ensure cross-platform compatibility, the catalogue leverages the **HDRUK Health Data Gateway** backend engine. The metadata upload forms and validator interfaces are hydrated dynamically via JSON Schema:

1. **HDRUK Base Schema**: The core structural schema has been agreed with Health Data Research UK (HDRUK) and is maintained in the official [HDRUK Schemata Repository](https://github.com/HDRUK/schemata/tree/main/hdr_schemata/models/CRUK).
2. **CRUK Semantic Schema Overlay**: To provide flexible, easily updated examples, rich domain guidance, and customized field rules without breaking core compatibility, the base HDRUK schema is overlaid with a CRUK Semantic Schema definition.

Together, these schemas merge live to hydrate the complete catalogue dataset forms and interactive documentation viewer.

---

## Exploring the Schema & Getting Started

- **Interactive Schema Documentation**: You can view the live merged schema, required fields, regex patterns, and guidance on the GitHub Pages site:
  👉 **[CRUK Semantic Schema Documentation](https://uosbioinformaticslab.github.io/cruk-semantic-schema/)**

- **CRUK Data Holders & Pilot Access**:
  If you are a CRUK data holder and would like to upload your dataset metadata to the catalogue, please get in touch with **Sarah Wooller** ([skw24@sussex.ac.uk](mailto:skw24@sussex.ac.uk)) to request a login for the pilot site. We will then help you onboard and upload your data.
