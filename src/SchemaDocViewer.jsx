import React, { useState, useEffect, useMemo } from 'react';
import './SchemaDocViewer.css';
import localSemanticSchema from '../semanticSchema.json';

const HDRUK_MAIN_BASE_URL = "https://raw.githubusercontent.com/HDRUK/schemata/main/hdr_schemata/models/CRUK";
const HDRUK_DEV_BASE_URL = "https://raw.githubusercontent.com/HDRUK/schemata/dev/hdr_schemata/models/CRUK";
const CRUK_SEMANTIC_SCHEMA_URL = "https://raw.githubusercontent.com/UOSbioinformaticslab/cruk-semantic-schema/main/semanticSchema.json";

const SCHEMA_VERSIONS_TO_PROBE = ["3.0.0", "2.1.0", "2.0.0", "1.1.0", "1.0.0"];

async function fetchLatestHDRUKCRUKSchema() {
    for (const ver of SCHEMA_VERSIONS_TO_PROBE) {
        const rawUrl = `${HDRUK_MAIN_BASE_URL}/${ver}/schema.json`;
        try {
            const res = await fetch(rawUrl);
            if (res.ok) {
                const data = await res.json();
                return {
                    data,
                    version: ver,
                    branch: 'main',
                    repoUrl: `https://github.com/HDRUK/schemata/blob/main/hdr_schemata/models/CRUK/${ver}/schema.json`
                };
            }
        } catch (e) {
            // continue probing
        }
    }

    for (const ver of SCHEMA_VERSIONS_TO_PROBE) {
        const rawUrl = `${HDRUK_DEV_BASE_URL}/${ver}/schema.json`;
        try {
            const res = await fetch(rawUrl);
            if (res.ok) {
                const data = await res.json();
                return {
                    data,
                    version: ver,
                    branch: 'dev',
                    repoUrl: `https://github.com/HDRUK/schemata/blob/dev/hdr_schemata/models/CRUK/${ver}/schema.json`
                };
            }
        } catch (e) {
            // continue probing
        }
    }

    return null;
}

// Markdown helper to render links, bold text and linebreaks safely
function renderFormattedText(text) {
    if (!text) return null;
    let formatted = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer" style="color: #00468C; text-decoration: underline; font-weight: 600;">$1</a>');
    formatted = formatted.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    formatted = formatted.replace(/\\n|\n/g, '<br/>');
    return <span dangerouslySetInnerHTML={{ __html: formatted }} />;
}

export default function SchemaDocViewer() {
    const [baseSchemaMeta, setBaseSchemaMeta] = useState({
        version: '1.0.0',
        branch: 'main',
        repoUrl: 'https://github.com/HDRUK/schemata/blob/main/hdr_schemata/models/CRUK/1.0.0/schema.json'
    });
    const [baseSchema, setBaseSchema] = useState(null);
    const [semanticSchema, setSemanticSchema] = useState(localSemanticSchema);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Filter controls: 'all' (default: both required and optional), 'required', or 'optional'
    const [filterMode, setFilterMode] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedSectionKey, setSelectedSectionKey] = useState(null);

    useEffect(() => {
        const loadSchemas = async () => {
            try {
                setLoading(true);
                const baseResult = await fetchLatestHDRUKCRUKSchema();
                if (baseResult && baseResult.data) {
                    setBaseSchema(baseResult.data);
                    setBaseSchemaMeta({
                        version: baseResult.version,
                        branch: baseResult.branch,
                        repoUrl: baseResult.repoUrl
                    });
                }

                try {
                    const semRes = await fetch(CRUK_SEMANTIC_SCHEMA_URL);
                    if (semRes.ok) {
                        const semData = await semRes.json();
                        setSemanticSchema(semData);
                    }
                } catch (e) {
                    console.warn("Using local semantic schema fallback:", e);
                }

                setError(null);
            } catch (err) {
                console.error("Schema load error:", err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        loadSchemas();
    }, []);

    // Build curated amalgamation of base HDRUK/CRUK schema + CRUK Semantic Schema
    // Strictly adheres to:
    // 1. Only sections present in semanticSchema.visibleSections
    // 2. If a section/sub-section key is in semanticSchema.included, only properties in that array are included (others omitted)
    // 3. Includes BOTH optional and required sections/sub-sections
    const amalgamatedSections = useMemo(() => {
        const sem = semanticSchema || localSemanticSchema;
        const semDefs = sem?.$defs || {};
        const semProps = sem?.properties || {};

        const sections = [
            {
                key: 'version',
                title: 'Dataset Version',
                description: semProps.version?.description || 'Dataset metadata version number.',
                guidance: semProps.version?.guidance || 'Dataset metadata version should follow standard SEMVER naming conventions (https://semver.org). For example: 1.1.0 major.minor.patch.',
                isRequired: true,
                properties: [
                    {
                        key: 'version',
                        path: 'version',
                        title: 'Dataset Version',
                        isRequired: true,
                        description: 'Three numbers separated by dots (Major.Minor.Patch e.g. 1.0.0) identifying the release version of this dataset metadata.',
                        guidance: semProps.version?.guidance || 'Major: Significant or breaking changes (e.g. newly populated dataset, change in access conditions).\\nMinor: Incremental additions (e.g. more samples added).\\nPatch: Minor fixes or corrections without new features.',
                        examples: ['1.0.0', '1.1.0', '2.0.0'],
                        format: 'SEMVER string (Major.Minor.Patch e.g. 1.0.0)'
                    }
                ]
            },
            {
                key: 'summary',
                title: 'Summary Information',
                description: 'Core metadata describing the dataset, title, short abstract, custodian organisation, population size, and primary contact points.',
                guidance: semProps.summary?.guidance || 'Please include information on Title, Short Abstract, Dataset Custodian, Contact Points, Dataset Population Size, Keywords, DOI, and Aliases.',
                isRequired: true,
                properties: [
                    {
                        key: 'summary.title',
                        path: 'summary.title',
                        title: 'Dataset Title',
                        isRequired: true,
                        description: 'The title the dataset is best known by.',
                        guidance: semDefs.Summary?.properties?.title?.guidance || '- Use the title the dataset is best known by. Expand acronyms, adding the acronym in brackets.\\n- Use a unique title, adding a prefix with your organisation name or identifier where necessary.',
                        examples: ['National Health Service (NHS) COVID-19 dataset', 'OPTIMAM Mammography Dataset'],
                        format: 'Text (2 - 150 characters)'
                    },
                    {
                        key: 'summary.abstract',
                        path: 'summary.abstract',
                        title: 'Dataset Abstract',
                        isRequired: true,
                        description: 'Free text summary of the dataset background, cohort, and purpose.',
                        guidance: 'Please provide a clear abstract (5-500 characters) summarising the dataset background and findings.',
                        examples: ['OPTIMAM is a database of mammogram images and associated clinical data from multiple NHS Breast Cancer screening sites across the UK...'],
                        format: 'Long Text (5 - 500 characters)'
                    },
                    // dataCustodian sub-properties filtered by semanticSchema.included.dataCustodian: ["identifier", "name", "contactPoint", "description"]
                    {
                        key: 'summary.dataCustodian.name',
                        path: 'summary.dataCustodian.name',
                        title: 'Data Custodian Organisation Name',
                        isRequired: true,
                        description: 'The organisation responsible for running or supporting the data access request process, as well as publishing and maintaining the metadata.',
                        guidance: semDefs.Organisation?.properties?.name?.guidance || 'In most cases this will be the same as the Team you have on the Hub, but may be different.',
                        examples: ['Cancer Research Horizons', 'University of Sussex Pearl Bioinformatics Lab'],
                        format: 'Text (2 - 150 characters)'
                    },
                    {
                        key: 'summary.dataCustodian.identifier',
                        path: 'summary.dataCustodian.identifier',
                        title: 'Data Custodian Identifier (ROR ID)',
                        isRequired: true,
                        description: 'Research Organization Registry (ROR) persistent identifier (see https://ror.org/) for your organisation.',
                        guidance: 'Example: https://ror.org/053fq8t95. If your organisation does not have a ROR identifier please use the suggest an institute function.',
                        examples: ['https://ror.org/00ayhx656', 'https://ror.org/053fq8t95'],
                        format: 'URL / ROR ID (2 - 50 characters)'
                    },
                    {
                        key: 'summary.dataCustodian.contactPoint',
                        path: 'summary.dataCustodian.contactPoint',
                        title: 'Data Custodian Contact Email',
                        isRequired: true,
                        description: 'A contact point email address for queries regarding the Data Custodian organisation.',
                        guidance: 'Please provide an email address for queries regarding the data custodian organisation.',
                        examples: ['data-custodian@horizons.org', 'support@cruk-datahub.ac.uk'],
                        format: 'Email address'
                    },
                    {
                        key: 'summary.dataCustodian.description',
                        path: 'summary.dataCustodian.description',
                        title: 'Data Custodian Description Webpage',
                        isRequired: false,
                        description: 'Please provide a URL that describes the organisation.',
                        guidance: semDefs.Organisation?.properties?.description?.guidance || 'If a description is not provided this will default to the description of the team submitting the metadata.',
                        examples: ['https://www.cancerresearchhorizons.com'],
                        format: 'URL (Web link)'
                    },
                    {
                        key: 'summary.populationSize',
                        path: 'summary.populationSize',
                        title: 'Dataset Population Size',
                        isRequired: true,
                        description: 'The total number of unique individuals, patients, or biological cases in this dataset.',
                        guidance: 'Enter an integer count representing the cohort or participant population size.',
                        examples: [1500, 24500],
                        format: 'Integer'
                    },
                    {
                        key: 'summary.contactPoint',
                        path: 'summary.contactPoint',
                        title: 'Lead Contact Point',
                        isRequired: true,
                        description: 'An email address for queries and data access enquiries about this dataset.',
                        guidance: 'Please provide a monitored email address for dataset enquiries.',
                        examples: ['lead-researcher@institution.ac.uk'],
                        format: 'Email address'
                    },
                    {
                        key: 'summary.leadResearcher',
                        path: 'summary.leadResearcher',
                        title: 'Lead Researcher',
                        isRequired: false,
                        description: 'Primary investigator or lead researcher responsible for the dataset.',
                        guidance: 'Name of the principal investigator or research lead.',
                        examples: ['Prof. Sarah Wooller', 'Dr. John Doe'],
                        format: 'Text (2 - 150 characters)'
                    },
                    {
                        key: 'summary.leadResearchInstitute',
                        path: 'summary.leadResearchInstitute',
                        title: 'Lead Research Institute',
                        isRequired: false,
                        description: 'Primary institution or academic body where research was conducted.',
                        guidance: 'Name of the primary research institute or university.',
                        examples: ['University of Sussex', 'University College London'],
                        format: 'Text (2 - 150 characters)'
                    },
                    {
                        key: 'summary.keywords',
                        path: 'summary.keywords',
                        title: 'Keywords',
                        isRequired: false,
                        description: 'Relevant scientific and clinical keywords to aid discoverability.',
                        guidance: 'Provide keywords representing study themes, techniques, and biological focuses.',
                        examples: ['Mammography', 'Breast Cancer', 'AI Screening', 'Biomarkers'],
                        format: 'List of text keywords'
                    },
                    {
                        key: 'summary.doiName',
                        path: 'summary.doiName',
                        title: 'Digital Object Identifier (DOI)',
                        isRequired: false,
                        description: 'Persistent Digital Object Identifier (DOI) resolving to the dataset or permanent repository entry.',
                        guidance: 'Provide a valid DOI string without https:// prefix.',
                        examples: ['10.5281/zenodo.1234567'],
                        format: 'DOI string (e.g. 10.xxxx/yyyy)'
                    },
                    {
                        key: 'summary.datasetAliases',
                        path: 'summary.datasetAliases',
                        title: 'Dataset & BioSample Aliases',
                        isRequired: false,
                        description: 'Alternate names, acronyms, or identifiers for the Dataset and/or BioSamples.',
                        guidance: 'Alternate name or acronym used in publications or previous versions.',
                        examples: ['OPT-MAM-V2', 'BC-COHORT-2024'],
                        format: 'Comma-separated text'
                    }
                ]
            },
            {
                key: 'accessibility',
                title: 'Accessing the Dataset',
                description: 'Information on how researchers can gain access to the data, application procedures, costs, and access restrictions.',
                guidance: semProps.accessibility?.guidance || 'Upload information on how researchers can gain access to the data and access restrictions.',
                isRequired: true,
                // Filtered by semanticSchema.included.accessibility: ["access"], and included.access: ["accessRights"]
                properties: [
                    {
                        key: 'accessibility.access.accessRights',
                        path: 'accessibility.access.accessRights',
                        title: 'How to Access the Dataset',
                        isRequired: true,
                        description: 'Set out how to access the dataset.',
                        guidance: semDefs.Access?.properties?.accessRights?.guidance || '- If there is a webpage for the data access request process and/or guidance add that here.\\n- Alternatively provide information about the process, restrictions, costs and time delays.\\n- If such a resource or the underlying process doesn’t exist, please provide “In Progress”, until both the process and the documentation are ready.',
                        examples: ['In Progress', 'Apply through the Data Access Committee portal: https://dac.institution.org/apply'],
                        format: 'Long Text (5 - 10000 characters)'
                    }
                ]
            },
            {
                key: 'documentation',
                title: 'Documentation & Methodologies',
                description: 'Background documentation setting out methodologies, protocols, and associated media.',
                guidance: semProps.documentation?.guidance || 'Use this section to upload documentation setting out the background to your dataset including details of the methodologies. This can also include associated media.',
                isRequired: false,
                properties: [
                    {
                        key: 'documentation.description',
                        path: 'documentation.description',
                        title: 'Dataset Documentation & Methodologies',
                        isRequired: false,
                        description: 'Free-text detailed description of dataset collection and processing methodologies.',
                        guidance: semDefs.Documentation?.properties?.description?.guidance || 'Provide clinical, laboratory, or technical background on how data was collected.',
                        examples: ['The automated process of image collection, processing and storage enables easy expansion across new imaging sites...'],
                        format: 'Long Text (2 - 10000 characters)'
                    },
                    {
                        key: 'documentation.associatedMedia',
                        path: 'documentation.associatedMedia',
                        title: 'Associated Media URL',
                        isRequired: false,
                        description: 'URL linking to associated media assets (videos, slides, diagrams).',
                        guidance: 'Media asset can be hosted by the organisation or uploaded to the portal.',
                        examples: ['https://example.org/media/study_walkthrough.mp4'],
                        format: 'URL (Web link)'
                    }
                ]
            },
            {
                key: 'datasetFilters',
                title: 'Dataset Filters & Classifications',
                description: 'Taxonomy categorisations applied to datasets on the CRUK Datahub: Cancer Type (ICD-O-3 / Pan-Cancer), Data Modalities, and Access Conditions.',
                guidance: semProps.datasetFilters?.guidance || 'Datasets in the CRUK datahub are filtered according to three criteria: type of cancer, type of data and access conditions. Use ICD-O terminology to categorise each of the cancers covered, and keywords to include further important details. This is automatically translated to CRUK and TCGA equivalents.',
                isRequired: true,
                properties: [
                    {
                        key: 'datasetFilters.cancerTypes',
                        path: 'datasetFilters.cancerTypes',
                        title: 'Cancer Type (Topography / Histology / Pan-Cancer)',
                        isRequired: true,
                        description: 'Classification of cancer sites or histological subtypes covered in this dataset.',
                        guidance: 'At least one cancer topography (e.g. C50 Breast, C34 Lung) or Pan-Cancer selection is required.',
                        examples: ['C50 Breast', 'C34 Bronchus and lung', 'Pan-Cancer'],
                        format: 'ICD-O-3 Codes / CRUK & TCGA Taxonomy terms'
                    },
                    {
                        key: 'datasetFilters.dataTypes',
                        path: 'datasetFilters.dataTypes',
                        title: 'Data Types',
                        isRequired: true,
                        description: 'Modalities of biological, clinical, or technological data contained in the dataset.',
                        guidance: 'Select all applicable data types. At least one data type selection is required.',
                        examples: ['Medical Imaging', 'Genomics', 'Clinical Data', 'Transcriptomics'],
                        format: 'Controlled Data Type Taxonomy'
                    },
                    {
                        key: 'datasetFilters.accessConditions',
                        path: 'datasetFilters.accessConditions',
                        title: 'Access Conditions',
                        isRequired: true,
                        description: 'Primary access governance model applied to research requests for this dataset.',
                        guidance: 'Choose Open Access, Registered Access, or Managed Access.',
                        examples: ['Managed Access', 'Open Access'],
                        format: 'Controlled governance category'
                    }
                ]
            },
            {
                key: 'structuralMetadata',
                title: 'Structural Metadata (Tables & Columns)',
                description: 'Descriptions of all relational tables and columns within the dataset.',
                guidance: semProps.structuralMetadata?.guidance || 'Identify and describe each table in your dataset, and each column therein. Please provide meaningful descriptions. Including the size of the tables is a very useful indicator of the completeness of the data.',
                isRequired: false,
                properties: [
                    {
                        key: 'structuralMetadata.tables.name',
                        path: 'structuralMetadata.tables.name',
                        title: 'Data Table Name',
                        isRequired: true,
                        description: 'Name of each table or file entity in the dataset.',
                        guidance: semDefs.DataTable?.properties?.name?.guidance || 'Please identify each of the tables in the dataset.',
                        examples: ['Patients', 'Samples', 'Mammograms', 'Genomic_Variants'],
                        format: 'Text (1 - 150 characters)'
                    },
                    {
                        key: 'structuralMetadata.tables.columns.name',
                        path: 'structuralMetadata.tables.columns.name',
                        title: 'Column Name',
                        isRequired: true,
                        description: 'Name of a column in the table.',
                        guidance: semDefs.DataColumn?.properties?.name?.guidance || 'Name of each column within the parent table.',
                        examples: ['patient_id', 'biopsy_result', 'measurement_value'],
                        format: 'Text (1 - 100 characters)'
                    },
                    {
                        key: 'structuralMetadata.tables.columns.dataType',
                        path: 'structuralMetadata.tables.columns.dataType',
                        title: 'Column Data Type',
                        isRequired: false,
                        description: 'The computational data type for values in this column.',
                        guidance: semDefs.DataColumn?.properties?.dataType?.guidance || 'Where necessary it is helpful to specify the language or disambiguate eg True vs true.',
                        examples: ['string', 'integer', 'float', 'boolean', 'date'],
                        format: 'Text (e.g. string, integer, float, date)'
                    },
                    {
                        key: 'structuralMetadata.tables.columns.description',
                        path: 'structuralMetadata.tables.columns.description',
                        title: 'Column Description',
                        isRequired: false,
                        description: 'Meaningful explanation of column contents or code systems.',
                        guidance: semDefs.DataColumn?.properties?.description?.guidance || 'Where values within the column are drawn from another table or coding system, please name it here.',
                        examples: ['Codes are drawn from table 2, listing chEMBL codes for small molecules'],
                        format: 'Text'
                    },
                    {
                        key: 'structuralMetadata.syntheticDataWebLink',
                        path: 'structuralMetadata.syntheticDataWebLink',
                        title: 'Synthetic Data Web Link',
                        isRequired: false,
                        description: 'Web link to synthetic or dummy data files allowing safe preview.',
                        guidance: 'URL pointing to synthetic sample records for testing.',
                        examples: ['https://example.org/synthetic/sample_100_rows.csv'],
                        format: 'URL (Web link)'
                    }
                ]
            },
            {
                key: 'otherDataTypes',
                title: 'Other Data Types',
                description: 'Audio-visual and other non-standard data modalities such as recordings, video, and raw sensor files.',
                guidance: semProps.otherDataTypes?.guidance || 'Datasets often now include audio-visual data such as recordings and images. Please list, describe and identify the format.',
                isRequired: false,
                properties: [
                    {
                        key: 'otherDataTypes.title',
                        path: 'otherDataTypes[].title',
                        title: 'Data Modality Title',
                        isRequired: true,
                        description: 'Name or category of the additional data modality.',
                        guidance: 'Identify the modality type.',
                        examples: ['Audio interview recordings', 'Histopathology Whole Slide Images'],
                        format: 'Text (2 - 150 characters)'
                    },
                    {
                        key: 'otherDataTypes.description',
                        path: 'otherDataTypes[].description',
                        title: 'Data Modality Description',
                        isRequired: true,
                        description: 'Description of the data modality and recording context.',
                        guidance: 'Provide clinical or technical context for the modality.',
                        examples: ['Digital audio recordings of participant cognitive assessments.'],
                        format: 'Long Text (2 - 10000 characters)'
                    },
                    {
                        key: 'otherDataTypes.format',
                        path: 'otherDataTypes[].format',
                        title: 'File Format',
                        isRequired: true,
                        description: 'Computational format of the stored modality.',
                        guidance: 'e.g. MP3, WAV, SVS, DICOM, MP4.',
                        examples: ['WAV', 'SVS', 'DICOM'],
                        format: 'Text'
                    }
                ]
            },
            {
                key: 'erd',
                title: 'Entity Relationship Diagram',
                description: 'Visual relationship diagram illustrating relational connections across data tables.',
                guidance: semProps.erd?.guidance || 'Please upload an image file (max 5MB) showing the relationship between the different tables',
                isRequired: false,
                properties: [
                    {
                        key: 'erd.image',
                        path: 'erd',
                        title: 'Entity Relationship Diagram Image',
                        isRequired: false,
                        description: 'Image file or URL presenting the entity relationship diagram for the dataset.',
                        guidance: 'Please upload an image file (max 5MB) showing the relationship between tables.',
                        examples: ['https://example.org/schemas/patient_study_erd.png'],
                        format: 'URL / Image File (PNG, JPG, SVG - max 5MB)'
                    }
                ]
            },
            {
                key: 'observations',
                title: 'Observations',
                description: 'Noteworthy statistical observations, datapoint counts, or milestone measurements in the dataset.',
                guidance: semProps.observations?.guidance || 'Please provide interesting observations about your dataset. These might for example include the number of datapoints in a particular table of note.',
                isRequired: false,
                properties: [
                    {
                        key: 'observations.observedNode',
                        path: 'observations[].observedNode',
                        title: 'Observed Node / Entity',
                        isRequired: true,
                        description: 'Entity or table where observation was recorded.',
                        guidance: 'Name of the table or node.',
                        examples: ['Patients Table', 'Genomics VCF'],
                        format: 'Text'
                    },
                    {
                        key: 'observations.measuredProperty',
                        path: 'observations[].measuredProperty',
                        title: 'Measured Property',
                        isRequired: true,
                        description: 'Attribute or property being measured.',
                        guidance: 'Property name.',
                        examples: ['Total Somatic Mutations', 'Mammography Image Count'],
                        format: 'Text'
                    },
                    {
                        key: 'observations.measuredValue',
                        path: 'observations[].measuredValue',
                        title: 'Measured Value',
                        isRequired: true,
                        description: 'Observed count or quantitative metric value.',
                        guidance: 'Observed value.',
                        examples: ['45,210', '1,200 participants'],
                        format: 'Text / Number'
                    },
                    {
                        key: 'observations.observationDate',
                        path: 'observations[].observationDate',
                        title: 'Observation Date',
                        isRequired: true,
                        description: 'Date observation was recorded.',
                        guidance: 'Date in YYYY-MM-DD format.',
                        examples: ['2024-05-01'],
                        format: 'Date (YYYY-MM-DD)'
                    }
                ]
            },
            {
                key: 'demographicFrequency',
                title: 'Demographics & Diversity',
                description: 'Information regarding demographic representations in the dataset.',
                guidance: semProps.demographicFrequency?.guidance || 'CRUK is committed to improving the racial diversity of datasets.',
                isRequired: false,
                // Filtered by semanticSchema.included.demographicFrequency: ["ethnicity"] -> age and disease excluded
                properties: [
                    {
                        key: 'demographicFrequency.ethnicity',
                        path: 'demographicFrequency.ethnicity',
                        title: 'Demographic Ethnicity Breakdown',
                        isRequired: false,
                        description: 'Breakdown of participant counts grouped by standard ethnicity bins.',
                        guidance: 'CRUK is committed to improving the racial diversity of datasets.',
                        examples: [{'bin': 'White British', 'count': 850}, {'bin': 'Asian / Asian British', 'count': 230}],
                        format: 'Array of Ethnicity Bins & Counts'
                    }
                ]
            },
            {
                key: 'provenance',
                title: 'Provenance & Temporal Coverage',
                description: 'Time period covered by the dataset, release dates, and update frequencies.',
                guidance: semProps.provenance?.guidance || 'Information on the time period covered by the dataset, including first and last entries, frequency and lag of publication.',
                isRequired: false,
                // Filtered by semanticSchema.included.provenance: ["temporal"] -> origin excluded
                // and included.temporal: ["startDate", "endDate", "timeLag"] -> publishingFrequency and distributionReleaseDate excluded
                properties: [
                    {
                        key: 'provenance.temporal.startDate',
                        path: 'provenance.temporal.startDate',
                        title: 'Coverage Start Date',
                        isRequired: false,
                        description: 'The start of the time period that the dataset provides coverage for.',
                        guidance: 'The start of the time period that the dataset provides coverage for. If there are multiple cohorts in the dataset with varying start dates, please provide the earliest date.',
                        examples: ['2016-01-01'],
                        format: 'Date (YYYY-MM-DD)'
                    },
                    {
                        key: 'provenance.temporal.endDate',
                        path: 'provenance.temporal.endDate',
                        title: 'Coverage End Date',
                        isRequired: false,
                        description: 'The end of the time period that the dataset provides coverage for.',
                        guidance: 'The end of the time period that the dataset provides coverage for. If the dataset is “Continuous” and has no known end date, please leave blank.',
                        examples: ['2023-12-31'],
                        format: 'Date (YYYY-MM-DD)'
                    },
                    {
                        key: 'provenance.temporal.timeLag',
                        path: 'provenance.temporal.timeLag',
                        title: 'Publication Time Lag',
                        isRequired: false,
                        description: 'Typical time-lag between an event and data appearing in the dataset.',
                        guidance: 'Select from: Less than 1 week, 1-2 weeks, 2-4 weeks, 1-2 months, 2-6 months, 6 months plus, Variable.',
                        examples: ['1-2 months', 'Variable'],
                        format: 'Enum choice'
                    }
                ]
            },
            {
                key: 'coverage',
                title: 'Coverage & Demographics',
                description: 'Age range of participants, completeness indicators, and biological sample materials available.',
                guidance: semProps.coverage?.guidance || 'Include the minimum and maximum age of participants, as well as a URL where a researcher can learn more about the completeness of the dataset.',
                isRequired: true,
                // Filtered by semanticSchema.included.coverage: ["materialType", "typicalAgeRangeMin", "typicalAgeRangeMax", "datasetCompleteness"]
                // spatial, followUp, pathway excluded
                properties: [
                    {
                        key: 'coverage.typicalAgeRangeMin',
                        path: 'coverage.typicalAgeRangeMin',
                        title: 'Minimum Participant Age',
                        isRequired: true,
                        description: 'Lowest participant age in years represented in the dataset (or 0 for neonatal/infant studies).',
                        guidance: 'Enter the minimum age in whole years.',
                        examples: [18, 0],
                        format: 'Integer (Years)'
                    },
                    {
                        key: 'coverage.typicalAgeRangeMax',
                        path: 'coverage.typicalAgeRangeMax',
                        title: 'Maximum Participant Age',
                        isRequired: true,
                        description: 'Highest participant age in years represented in the dataset.',
                        guidance: 'Enter the maximum age in whole years.',
                        examples: [85, 99],
                        format: 'Integer (Years)'
                    },
                    {
                        key: 'coverage.materialType',
                        path: 'coverage.materialType',
                        title: 'Biological Sample Material Types',
                        isRequired: false,
                        description: 'Types of biological samples available (e.g. DNA, RNA, Formalin-fixed tissue, Serum).',
                        guidance: semDefs.Coverage?.properties?.materialType?.guidance || 'List all material types available in associated biobanks.',
                        examples: ['Formalin-fixed paraffin-embedded tissue', 'Whole Blood DNA'],
                        format: 'List of biological material types'
                    },
                    {
                        key: 'coverage.datasetCompleteness',
                        path: 'coverage.datasetCompleteness',
                        title: 'Dataset Completeness URL',
                        isRequired: false,
                        description: 'A URL where a researcher can learn more about the completeness and coverage of the dataset.',
                        guidance: 'Link to a public data dictionary, cohort paper, or completeness audit.',
                        examples: ['https://example.org/study-completeness-report.pdf'],
                        format: 'URL (Web link)'
                    }
                ]
            },
            {
                key: 'enrichmentAndLinkage',
                title: 'Related References & Linkages',
                description: 'Linked research software, analytical tools, upstream datasets, and academic publications.',
                guidance: semProps.enrichmentAndLinkage?.guidance || 'If this dataset is derived from, or related to, other datasets please include that information here. You can also link to other tools and publications here.',
                isRequired: false,
                properties: [
                    {
                        key: 'enrichmentAndLinkage.tools',
                        path: 'enrichmentAndLinkage.tools',
                        title: 'Linked Tools & Software',
                        isRequired: false,
                        description: 'Computational tools, algorithms, or pipelines developed for or using this dataset.',
                        guidance: 'Provide links or identifiers for associated tools.',
                        examples: ['https://github.com/example/mammogram-classifier'],
                        format: 'Array of URLs / Tool References'
                    },
                    {
                        key: 'enrichmentAndLinkage.publications',
                        path: 'enrichmentAndLinkage.publications',
                        title: 'Related Publications',
                        isRequired: false,
                        description: 'Academic papers published about or using this dataset.',
                        guidance: 'Provide publication DOIs or titles.',
                        examples: ['10.1038/s41586-020-0000-0'],
                        format: 'Array of DOIs / Paper Citations'
                    },
                    {
                        key: 'enrichmentAndLinkage.derivedFrom',
                        path: 'enrichmentAndLinkage.derivedFrom',
                        title: 'Derived From Datasets',
                        isRequired: false,
                        description: 'Identifiers of upstream datasets from which this data is derived.',
                        guidance: 'List upstream dataset identifiers if applicable.',
                        examples: ['cruk-dataset-001'],
                        format: 'Array of Dataset Identifiers'
                    },
                    {
                        key: 'enrichmentAndLinkage.similarToDatasets',
                        path: 'enrichmentAndLinkage.similarToDatasets',
                        title: 'Similar Datasets',
                        isRequired: false,
                        description: 'Related datasets sharing cohorts, methodologies, or disease focus.',
                        guidance: 'List related dataset identifiers.',
                        examples: ['cruk-dataset-045'],
                        format: 'Array of Dataset Identifiers'
                    }
                ]
            },
            {
                key: 'omics',
                title: 'Omics Assays & Platforms',
                description: 'Information about the assays and platforms used to generate omics information.',
                guidance: semProps.omics?.guidance || 'Information about the assays and platforms used to generate omics information.',
                isRequired: false,
                properties: [
                    {
                        key: 'omics.assay',
                        path: 'omics.assay',
                        title: 'Omics Assay Type',
                        isRequired: false,
                        description: 'Assay technology used (e.g. Whole genome sequencing, RNA-seq, Mass-spectrometry).',
                        guidance: 'Select from standardized assay terms.',
                        examples: ['Whole genome sequencing', 'Transcriptome profiling by array'],
                        format: 'Enum choice'
                    },
                    {
                        key: 'omics.platform',
                        path: 'omics.platform',
                        title: 'Omics Instrument Platform',
                        isRequired: false,
                        description: 'Instrument or sequencing platform name.',
                        guidance: 'e.g. Illumina NovaSeq, Oxford Nanopore, Hi-C.',
                        examples: ['Illumina NovaSeq 6000', 'Oxford Nanopore PromethION'],
                        format: 'Enum choice'
                    }
                ]
            }
        ];

        return sections;
    }, [baseSchema, semanticSchema]);

    // Filter sections and properties according to filterMode ('all' [default], 'required', or 'optional') and searchTerm
    const filteredSections = useMemo(() => {
        const query = searchTerm.trim().toLowerCase();

        return amalgamatedSections
            .map(section => {
                if (selectedSectionKey && section.key !== selectedSectionKey) {
                    return null;
                }

                const matchingProps = section.properties.filter(prop => {
                    // Filter Mode
                    if (filterMode === 'required' && !prop.isRequired) return false;
                    if (filterMode === 'optional' && prop.isRequired) return false;

                    // Text search query
                    if (query) {
                        const inTitle = prop.title.toLowerCase().includes(query);
                        const inKey = prop.path.toLowerCase().includes(query);
                        const inDesc = (prop.description || '').toLowerCase().includes(query);
                        const inGuidance = (prop.guidance || '').toLowerCase().includes(query);
                        const inFormat = (prop.format || '').toLowerCase().includes(query);
                        return inTitle || inKey || inDesc || inGuidance || inFormat;
                    }

                    return true;
                });

                if (matchingProps.length === 0) return null;

                return {
                    ...section,
                    properties: matchingProps
                };
            })
            .filter(Boolean);
    }, [amalgamatedSections, filterMode, searchTerm, selectedSectionKey]);

    // Statistics
    const stats = useMemo(() => {
        let totalProps = 0;
        let reqProps = 0;
        amalgamatedSections.forEach(s => {
            s.properties.forEach(p => {
                totalProps++;
                if (p.isRequired) reqProps++;
            });
        });
        return {
            totalSections: amalgamatedSections.length,
            totalProps,
            reqProps,
            optionalProps: totalProps - reqProps
        };
    }, [amalgamatedSections]);

    if (loading) {
        return (
            <div className="sdv-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
                <div style={{ textAlign: 'center' }} role="status" aria-live="polite">
                    <div style={{ width: '48px', height: '48px', border: '4px solid #00468C', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 1rem auto' }}></div>
                    <p style={{ color: '#2A2A2A', fontWeight: 600 }}>Loading CRUK Semantic Schema Amalgamation...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="sdv-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '2rem' }}>
                <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '16px', padding: '2rem', maxWidth: '500px', textAlign: 'center' }} role="alert">
                    <h2 style={{ color: '#D10A6F', fontSize: '1.25rem', fontWeight: 800, marginBottom: '0.5rem' }}>Schema Loading Failed</h2>
                    <p style={{ color: '#991b1b', marginBottom: '1rem', fontSize: '0.9rem' }}>{error}</p>
                    <button onClick={() => window.location.reload()} className="sdv-btn-link sdv-btn-primary" style={{ cursor: 'pointer' }}>
                        Retry Loading
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="sdv-container">
            {/* Keyboard Skip to Content Link */}
            <a href="#sdv-main-content" className="sdv-skip-link">
                Skip to main content
            </a>

            {/* Header Banner with CRUK Signature Styling */}
            <header className="sdv-header" role="banner">
                <div className="sdv-header-inner">
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                            <span className="sdv-badge-tag" aria-hidden="true">CRUK DATAHUB</span>
                            <span className="sdv-badge-tag" style={{ background: 'rgba(255, 255, 255, 0.3)' }}>SEMANTIC SCHEMA OVERLAY</span>
                            <h1 className="sdv-header-title">Dataset Metadata Requirements & Documentation</h1>
                        </div>
                        <p className="sdv-header-sub" style={{ marginTop: '0.5rem', lineHeight: '1.5', maxWidth: '850px' }}>
                            A unified view of the CRUK metadata schema with <strong>CRUK Semantic Schema</strong> rules.
                            Filtered strictly to visible sections and included sub-sections, displaying both optional and required fields with full guidance, examples, and formats.
                        </p>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                        <a
                            href={baseSchemaMeta.repoUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="sdv-btn-link sdv-btn-base"
                            aria-label={`Open HDRUK Base Schema on GitHub`}
                        >
                            HDRUK Base Schema ↗
                        </a>
                        <a
                            href="https://github.com/UOSbioinformaticslab/cruk-semantic-schema"
                            target="_blank"
                            rel="noreferrer"
                            className="sdv-btn-link sdv-btn-primary"
                            aria-label="Open CRUK Semantic Schema Repository on GitHub"
                        >
                            CRUK Semantic Repo ↗
                        </a>
                    </div>
                </div>
            </header>

            {/* Main Interactive Controls Bar */}
            <div className="sdv-control-bar">
                <div className="sdv-control-inner">
                    {/* Filter Toggle Buttons */}
                    <div className="sdv-filter-tabs" role="tablist" aria-label="Requirement Filter Modes">
                        <button
                            type="button"
                            role="tab"
                            aria-selected={filterMode === 'all'}
                            className={`sdv-tab-btn ${filterMode === 'all' ? 'active' : ''}`}
                            onClick={() => { setFilterMode('all'); setSelectedSectionKey(null); }}
                        >
                            All Included Properties ({stats.totalProps})
                        </button>
                        <button
                            type="button"
                            role="tab"
                            aria-selected={filterMode === 'required'}
                            className={`sdv-tab-btn ${filterMode === 'required' ? 'active' : ''}`}
                            onClick={() => { setFilterMode('required'); setSelectedSectionKey(null); }}
                        >
                            <span className="sdv-tab-star">★</span> Required ({stats.reqProps})
                        </button>
                        <button
                            type="button"
                            role="tab"
                            aria-selected={filterMode === 'optional'}
                            className={`sdv-tab-btn ${filterMode === 'optional' ? 'active' : ''}`}
                            onClick={() => { setFilterMode('optional'); setSelectedSectionKey(null); }}
                        >
                            Optional ({stats.optionalProps})
                        </button>
                    </div>

                    {/* Live Search Input */}
                    <div className="sdv-search-box">
                        <svg className="sdv-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="11" cy="11" r="8"></circle>
                            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                        </svg>
                        <input
                            type="text"
                            placeholder="Filter properties by name, guidance, format..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="sdv-search-input"
                            aria-label="Filter metadata properties"
                        />
                        {searchTerm && (
                            <button
                                type="button"
                                onClick={() => setSearchTerm('')}
                                className="sdv-search-clear"
                                aria-label="Clear search query"
                            >
                                ✕
                            </button>
                        )}
                    </div>
                </div>

                {/* Section Quick-Jump Pills */}
                <div className="sdv-pills-row" role="navigation" aria-label="Section Quick Links">
                    <button
                        type="button"
                        onClick={() => setSelectedSectionKey(null)}
                        className={`sdv-pill-btn ${selectedSectionKey === null ? 'active' : ''}`}
                    >
                        View All Sections ({filteredSections.length})
                    </button>
                    {amalgamatedSections.map(sec => {
                        const count = sec.properties.filter(p => {
                            if (filterMode === 'required') return p.isRequired;
                            if (filterMode === 'optional') return !p.isRequired;
                            return true;
                        }).length;
                        if (count === 0) return null;

                        return (
                            <button
                                key={sec.key}
                                type="button"
                                onClick={() => setSelectedSectionKey(sec.key === selectedSectionKey ? null : sec.key)}
                                className={`sdv-pill-btn ${sec.key === selectedSectionKey ? 'active' : ''}`}
                            >
                                {sec.title} <span className="sdv-pill-badge">{count}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Main Content Area */}
            <main id="sdv-main-content" className="sdv-content-wrapper">
                {filteredSections.length === 0 ? (
                    <div className="sdv-empty-state">
                        <h3>No matching metadata properties found</h3>
                        <p>Try clearing your search query or switching to &ldquo;All Included Properties&rdquo;.</p>
                        <button
                            type="button"
                            onClick={() => { setSearchTerm(''); setFilterMode('all'); setSelectedSectionKey(null); }}
                            className="sdv-btn-link sdv-btn-primary"
                        >
                            Reset Filters
                        </button>
                    </div>
                ) : (
                    filteredSections.map(sec => {
                        // If section has only 1 property (e.g. Dataset Version, ERD), render as a single unified card without redundant wrapper
                        if (sec.properties.length === 1) {
                            const prop = sec.properties[0];
                            const displayTitle = prop.title === sec.title ? sec.title : `${sec.title} — ${prop.title}`;
                            const displayDesc = prop.description || sec.description;
                            const displayGuidance = prop.guidance || sec.guidance;

                            return (
                                <section key={sec.key} className="sdv-amalg-section sdv-single-card" id={`section-${sec.key}`}>
                                    <div className="sdv-card-header">
                                        <div className="sdv-card-title-group">
                                            <h2 className="sdv-card-title" style={{ fontSize: '1.3rem', color: 'var(--cruk-blue)' }}>
                                                {displayTitle}
                                            </h2>
                                            <code className="sdv-card-path">{prop.path}</code>
                                        </div>

                                        <div className="sdv-card-badge-group">
                                            {prop.isRequired ? (
                                                <span className="sdv-badge sdv-badge-req">
                                                    ★ Required
                                                </span>
                                            ) : (
                                                <span className="sdv-badge sdv-badge-opt">
                                                    Not Required
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Description */}
                                    {displayDesc && (
                                        <div className="sdv-card-row sdv-desc-row">
                                            <div className="sdv-field-label">Description</div>
                                            <div className="sdv-desc-text">{displayDesc}</div>
                                        </div>
                                    )}

                                    {/* Guidance & Rules (rendered once!) */}
                                    {displayGuidance && (
                                        <div className="sdv-card-row sdv-guidance-row">
                                            <div className="sdv-guidance-box">
                                                <div className="sdv-guidance-head">
                                                    <span aria-hidden="true">💡</span> Guidance & Rules
                                                </div>
                                                <div className="sdv-guidance-body">
                                                    {renderFormattedText(displayGuidance)}
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Examples */}
                                    {prop.examples && prop.examples.length > 0 && (
                                        <div className="sdv-card-row sdv-examples-row">
                                            <div className="sdv-field-label">Examples</div>
                                            <div className="sdv-examples-container">
                                                {prop.examples.map((ex, i) => (
                                                    <span key={i} className="sdv-example-chip">
                                                        {typeof ex === 'object' ? JSON.stringify(ex) : String(ex)}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Format */}
                                    {prop.format && (
                                        <div className="sdv-card-row sdv-format-row">
                                            <div className="sdv-field-label">Format</div>
                                            <div className="sdv-format-badge">
                                                <code>{prop.format}</code>
                                            </div>
                                        </div>
                                    )}
                                </section>
                            );
                        }

                        // Multi-property sections (Summary, Coverage, Structural Metadata, Filters, etc.)
                        return (
                            <section key={sec.key} className="sdv-amalg-section" id={`section-${sec.key}`}>
                                {/* Section Header */}
                                <div className="sdv-amalg-section-header">
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                                        <h2 className="sdv-amalg-section-title">{sec.title}</h2>
                                        {sec.isRequired ? (
                                            <span className="sdv-badge sdv-badge-req">Required Section</span>
                                        ) : (
                                            <span className="sdv-badge sdv-badge-opt">Optional Section</span>
                                        )}
                                        <span className="sdv-count-label">
                                            {sec.properties.length} properties
                                        </span>
                                    </div>

                                    {sec.description && (
                                        <p className="sdv-amalg-section-desc">{sec.description}</p>
                                    )}

                                    {sec.guidance && (
                                        <div className="sdv-section-guidance-callout">
                                            <strong>Section Overview:</strong> {renderFormattedText(sec.guidance)}
                                        </div>
                                    )}
                                </div>

                                {/* Section Property Cards */}
                                <div className="sdv-amalg-cards-grid">
                                    {sec.properties.map(prop => (
                                        <div key={prop.key} className="sdv-card">
                                            {/* 1. TITLE & (REQUIRED / NOT REQUIRED) */}
                                            <div className="sdv-card-header">
                                                <div className="sdv-card-title-group">
                                                    <h3 className="sdv-card-title">{prop.title}</h3>
                                                    <code className="sdv-card-path">{prop.path}</code>
                                                </div>

                                                <div className="sdv-card-badge-group">
                                                    {prop.isRequired ? (
                                                        <span className="sdv-badge sdv-badge-req">
                                                            ★ Required
                                                        </span>
                                                    ) : (
                                                        <span className="sdv-badge sdv-badge-opt">
                                                            Not Required
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* 2. DESCRIPTION */}
                                            {prop.description && (
                                                <div className="sdv-card-row sdv-desc-row">
                                                    <div className="sdv-field-label">Description</div>
                                                    <div className="sdv-desc-text">{prop.description}</div>
                                                </div>
                                            )}

                                            {/* 3. GUIDANCE */}
                                            {prop.guidance && (
                                                <div className="sdv-card-row sdv-guidance-row">
                                                    <div className="sdv-guidance-box">
                                                        <div className="sdv-guidance-head">
                                                            <span aria-hidden="true">💡</span> Guidance & Rules
                                                        </div>
                                                        <div className="sdv-guidance-body">
                                                            {renderFormattedText(prop.guidance)}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {/* 4. EXAMPLES */}
                                            {prop.examples && prop.examples.length > 0 && (
                                                <div className="sdv-card-row sdv-examples-row">
                                                    <div className="sdv-field-label">Examples</div>
                                                    <div className="sdv-examples-container">
                                                        {prop.examples.map((ex, i) => (
                                                            <span key={i} className="sdv-example-chip">
                                                                {typeof ex === 'object' ? JSON.stringify(ex) : String(ex)}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* 5. FORMAT */}
                                            {prop.format && (
                                                <div className="sdv-card-row sdv-format-row">
                                                    <div className="sdv-field-label">Format</div>
                                                    <div className="sdv-format-badge">
                                                        <code>{prop.format}</code>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </section>
                        );
                    })
                )}

            </main>

            {/* Footer */}
            <footer className="sdv-footer">
                <div className="sdv-footer-inner">
                    <p>CRUK Datahub Metadata Documentation — Unified Semantic Schema & HDRUK Engine</p>
                    <p style={{ fontSize: '0.8rem', color: '#64748B' }}>
                        Displaying {filteredSections.reduce((acc, s) => acc + s.properties.length, 0)} properties across {filteredSections.length} visible sections according to CRUK Semantic Schema rules.
                    </p>
                </div>
            </footer>
        </div>
    );
}
