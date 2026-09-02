import React, { useState, useEffect, useMemo } from 'react';
import { deepMerge, resolveRef } from './utils/deepMergeSchema.js';
import './SchemaDocViewer.css';

const HDRUK_MAIN_BASE_URL = "https://raw.githubusercontent.com/HDRUK/schemata/main/hdr_schemata/models/CRUK";
const HDRUK_DEV_BASE_URL = "https://raw.githubusercontent.com/HDRUK/schemata/dev/hdr_schemata/models/CRUK";
const CRUK_SEMANTIC_SCHEMA_URL = "https://raw.githubusercontent.com/UOSbioinformaticslab/cruk-semantic-schema/main/semanticSchema.json";

// Descending list of schema versions to probe
const SCHEMA_VERSIONS_TO_PROBE = ["3.0.0", "2.1.0", "2.0.0", "1.1.0", "1.0.0"];

// Dynamic resolver for HDRUK CRUK Base Schema (checks main first, then dev)
async function fetchLatestHDRUKCRUKSchema() {
    // 1. Probe 'main' branch in descending version order
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
                    rawUrl,
                    repoUrl: `https://github.com/HDRUK/schemata/blob/main/hdr_schemata/models/CRUK/${ver}/schema.json`
                };
            }
        } catch (e) {
            // Ignore and continue probing
        }
    }

    // 2. Probe 'dev' branch if not found on main
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
                    rawUrl,
                    repoUrl: `https://github.com/HDRUK/schemata/blob/dev/hdr_schemata/models/CRUK/${ver}/schema.json`
                };
            }
        } catch (e) {
            // Ignore and continue probing
        }
    }

    throw new Error("Could not locate CRUK schema definition on HDRUK/schemata main or dev branches.");
}

export default function SchemaDocViewer() {
    const [baseSchema, setBaseSchema] = useState(null);
    const [baseSchemaMeta, setBaseSchemaMeta] = useState({
        version: '1.0.0',
        branch: 'dev',
        repoUrl: 'https://github.com/HDRUK/schemata/blob/dev/hdr_schemata/models/CRUK/1.0.0/schema.json'
    });
    const [semanticSchema, setSemanticSchema] = useState(null);
    const [mergedSchema, setMergedSchema] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterMode, setFilterMode] = useState('all'); // 'all', 'required', 'overrides'
    const [navExpandedState, setNavExpandedState] = useState({});
    const [selectedSectionKey, setSelectedSectionKey] = useState(null); // null = View All, or string section/sub-section key

    // Fetch live schemas on load with dynamic main -> dev version detection
    useEffect(() => {
        const fetchSchemas = async () => {
            try {
                setLoading(true);
                
                // Fetch dynamic HDRUK base schema (probing main branch first, then dev)
                const baseResult = await fetchLatestHDRUKCRUKSchema();
                
                // Fetch CRUK Semantic Schema
                const semRes = await fetch(CRUK_SEMANTIC_SCHEMA_URL);
                if (!semRes.ok) throw new Error("Failed to fetch CRUK semantic schema");

                const semData = await semRes.json();

                setBaseSchema(baseResult.data);
                setBaseSchemaMeta({
                    version: baseResult.version,
                    branch: baseResult.branch,
                    repoUrl: baseResult.repoUrl
                });
                setSemanticSchema(semData);

                const merged = deepMerge(baseResult.data, semData);
                setMergedSchema(merged);

                // Default expand top-level sections in nav tree
                const initialNavState = {};
                if (merged.properties) {
                    Object.keys(merged.properties).forEach(key => {
                        initialNavState[key] = true;
                    });
                }
                setNavExpandedState(initialNavState);
                setError(null);
            } catch (err) {
                console.error("Schema fetch error:", err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchSchemas();
    }, []);

    const toggleNavExpand = (sectionKey, e) => {
        e.stopPropagation();
        setNavExpandedState(prev => ({
            ...prev,
            [sectionKey]: !prev[sectionKey]
        }));
    };

    // Helper to format markdown links & bolding in guidance
    const renderFormattedText = (text) => {
        if (!text) return null;
        let formatted = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer" style="color: #00468C; text-decoration: underline; font-weight: 600;">$1</a>');
        formatted = formatted.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        formatted = formatted.replace(/\\n|\n/g, '<br/>');
        return <span dangerouslySetInnerHTML={{ __html: formatted }} />;
    };

    // Deep resolve property schema target ($ref / allOf / anyOf / items)
    const resolveDeepProp = (schema, prop) => {
        if (!prop || typeof prop !== 'object') return prop;
        let merged = { ...prop };

        if (prop.$ref) {
            const target = resolveRef(schema, prop.$ref);
            if (target) merged = deepMerge(merged, resolveDeepProp(schema, target));
        }

        if (prop.allOf && Array.isArray(prop.allOf)) {
            prop.allOf.forEach(item => {
                if (item.$ref) {
                    const target = resolveRef(schema, item.$ref);
                    if (target) merged = deepMerge(merged, resolveDeepProp(schema, target));
                } else {
                    merged = deepMerge(merged, item);
                }
            });
        }

        if (prop.anyOf && Array.isArray(prop.anyOf)) {
            prop.anyOf.forEach(item => {
                if (item.$ref) {
                    const target = resolveRef(schema, item.$ref);
                    if (target) merged = deepMerge(merged, resolveDeepProp(schema, target));
                } else if (item.items && item.items.$ref) {
                    const target = resolveRef(schema, item.items.$ref);
                    if (target) {
                        const resolvedTarget = resolveDeepProp(schema, target);
                        if (resolvedTarget.properties) {
                            merged.properties = resolvedTarget.properties;
                            merged.required = resolvedTarget.required;
                            merged.title = prop.title || resolvedTarget.title || merged.title;
                        }
                    }
                } else if (item.properties) {
                    merged = deepMerge(merged, item);
                }
            });
        }

        if (prop.items) {
            if (prop.items.$ref) {
                const target = resolveRef(schema, prop.items.$ref);
                if (target) {
                    const resolvedTarget = resolveDeepProp(schema, target);
                    if (resolvedTarget.properties) {
                        merged.properties = resolvedTarget.properties;
                        merged.required = resolvedTarget.required;
                        merged.title = prop.title || resolvedTarget.title || merged.title;
                    }
                }
            } else if (prop.items.allOf && Array.isArray(prop.items.allOf)) {
                prop.items.allOf.forEach(item => {
                    if (item.$ref) {
                        const target = resolveRef(schema, item.$ref);
                        if (target) {
                            const resolvedTarget = resolveDeepProp(schema, target);
                            if (resolvedTarget.properties) {
                                merged.properties = resolvedTarget.properties;
                                merged.required = resolvedTarget.required;
                            }
                        }
                    }
                });
            }
        }

        return merged;
    };

    // Helper to extract fields for an object definition
    const extractFields = (propsObj, parentPath, reqArray, semSection) => {
        if (!propsObj) return [];
        return Object.entries(propsObj).map(([fieldKey, fieldProp]) => {
            const resolvedField = resolveDeepProp(mergedSchema, fieldProp);
            const isRequired = reqArray?.includes(fieldKey);
            
            const semField = semSection?.properties?.[fieldKey];
            const guidanceText = resolvedField.guidance || fieldProp.guidance || semField?.guidance;
            const hasOverride = Boolean(guidanceText || semField || (semSection && semSection.guidance));

            return {
                key: fieldKey,
                path: `${parentPath}.${fieldKey}`,
                title: resolvedField.title || fieldKey,
                description: resolvedField.description,
                guidance: guidanceText || semSection?.guidance,
                type: resolvedField.type || (resolvedField.allOf ? 'object' : 'string'),
                pattern: resolvedField.pattern,
                enum: resolvedField.enum,
                examples: resolvedField.examples || fieldProp.examples,
                isRequired,
                hasOverride
            };
        });
    };

    // Process schema into hierarchical sections and nested sub-sections
    const processedSections = useMemo(() => {
        if (!mergedSchema || !mergedSchema.properties) return [];

        const sections = [];

        Object.entries(mergedSchema.properties).forEach(([sectionKey, sectionProp]) => {
            const resolvedSection = resolveDeepProp(mergedSchema, sectionProp);
            const isSectionRequired = mergedSchema.required?.includes(sectionKey);

            const capSection = sectionKey.charAt(0).toUpperCase() + sectionKey.slice(1);
            const semSection = semanticSchema?.$defs?.[sectionKey] || semanticSchema?.$defs?.[capSection] || semanticSchema?.properties?.[sectionKey];

            let directFields = [];
            let subSections = [];

            if (resolvedSection.properties) {
                Object.entries(resolvedSection.properties).forEach(([fieldKey, fieldProp]) => {
                    const resolvedField = resolveDeepProp(mergedSchema, fieldProp);
                    const isRequired = resolvedSection.required?.includes(fieldKey);

                    // Check if property is a nested object/sub-section containing properties
                    if (resolvedField.properties && typeof resolvedField.properties === 'object') {
                        const childSemSection = semanticSchema?.$defs?.[fieldKey] || semanticSchema?.$defs?.[fieldKey.charAt(0).toUpperCase() + fieldKey.slice(1)];
                        const nestedFields = extractFields(resolvedField.properties, `${sectionKey}.${fieldKey}`, resolvedField.required, childSemSection);
                        subSections.push({
                            key: `${sectionKey}-${fieldKey}`,
                            path: `${sectionKey}.${fieldKey}`,
                            title: resolvedField.title || fieldKey,
                            description: resolvedField.description,
                            isRequired,
                            fields: nestedFields
                        });
                    } else {
                        // Primitive field
                        const semField = semSection?.properties?.[fieldKey];
                        const guidanceText = resolvedField.guidance || fieldProp.guidance || semField?.guidance;
                        const hasOverride = Boolean(guidanceText || semField || (semSection && semSection.guidance));

                        directFields.push({
                            key: fieldKey,
                            path: `${sectionKey}.${fieldKey}`,
                            title: resolvedField.title || fieldKey,
                            description: resolvedField.description,
                            guidance: guidanceText || semSection?.guidance,
                            type: resolvedField.type || (resolvedField.allOf ? 'object' : 'string'),
                            pattern: resolvedField.pattern,
                            enum: resolvedField.enum,
                            examples: resolvedField.examples || fieldProp.examples,
                            isRequired,
                            hasOverride
                        });
                    }
                });
            } else {
                const guidanceText = resolvedSection.guidance || sectionProp.guidance || semSection?.guidance;
                const hasOverride = Boolean(guidanceText || semSection);

                directFields.push({
                    key: sectionKey,
                    path: sectionKey,
                    title: resolvedSection.title || sectionKey,
                    description: resolvedSection.description,
                    guidance: guidanceText,
                    type: resolvedSection.type || 'string',
                    pattern: resolvedSection.pattern,
                    enum: resolvedSection.enum,
                    examples: resolvedSection.examples || sectionProp.examples,
                    isRequired: isSectionRequired,
                    hasOverride
                });
            }

            sections.push({
                key: sectionKey,
                title: resolvedSection.title || sectionKey,
                description: resolvedSection.description,
                isRequired: isSectionRequired,
                directFields,
                subSections
            });
        });

        return sections;
    }, [mergedSchema, semanticSchema]);

    // Filter sections and sub-sections based on search, filter mode, AND selected nav item
    const filteredSections = useMemo(() => {
        if (!processedSections) return [];

        const search = searchTerm.toLowerCase().trim();

        return processedSections.map(sec => {
            // Check section matching selectedSectionKey
            const isTopLevelSelected = selectedSectionKey === sec.key;
            const isSubSelected = sec.subSections.some(sub => sub.key === selectedSectionKey);

            if (selectedSectionKey && !isTopLevelSelected && !isSubSelected) {
                return null; // Skip non-selected sections
            }

            const matchingDirect = sec.directFields.filter(f => {
                if (filterMode === 'required' && !f.isRequired) return false;
                if (filterMode === 'overrides' && !f.hasOverride) return false;
                if (!search) return true;
                return (
                    f.key.toLowerCase().includes(search) ||
                    f.path.toLowerCase().includes(search) ||
                    f.title.toLowerCase().includes(search) ||
                    (f.description && f.description.toLowerCase().includes(search)) ||
                    (f.guidance && f.guidance.toLowerCase().includes(search))
                );
            });

            const matchingSubSections = sec.subSections.map(sub => {
                if (selectedSectionKey && selectedSectionKey !== sec.key && selectedSectionKey !== sub.key) {
                    return null;
                }

                const matchingSubFields = sub.fields.filter(f => {
                    if (filterMode === 'required' && !f.isRequired) return false;
                    if (filterMode === 'overrides' && !f.hasOverride) return false;
                    if (!search) return true;
                    return (
                        f.key.toLowerCase().includes(search) ||
                        f.path.toLowerCase().includes(search) ||
                        f.title.toLowerCase().includes(search) ||
                        (f.description && f.description.toLowerCase().includes(search)) ||
                        (f.guidance && f.guidance.toLowerCase().includes(search))
                    );
                });

                return {
                    ...sub,
                    fields: matchingSubFields
                };
            }).filter(Boolean).filter(sub => sub.fields.length > 0);

            // Hide direct fields if a specific sub-section was selected
            const finalDirect = (selectedSectionKey && selectedSectionKey !== sec.key && isSubSelected) ? [] : matchingDirect;

            return {
                ...sec,
                directFields: finalDirect,
                subSections: matchingSubSections
            };
        }).filter(Boolean).filter(sec => sec.directFields.length > 0 || sec.subSections.length > 0);
    }, [processedSections, searchTerm, filterMode, selectedSectionKey]);

    // Total metrics
    const stats = useMemo(() => {
        if (!processedSections) return { totalSections: 0, totalFields: 0, requiredFields: 0, overridesCount: 0 };
        let fields = 0, req = 0, ovr = 0;
        processedSections.forEach(s => {
            fields += s.directFields.length;
            s.directFields.forEach(f => {
                if (f.isRequired) req++;
                if (f.hasOverride) ovr++;
            });

            s.subSections.forEach(sub => {
                fields += sub.fields.length;
                sub.fields.forEach(f => {
                    if (f.isRequired) req++;
                    if (f.hasOverride) ovr++;
                });
            });
        });
        return {
            totalSections: processedSections.length,
            totalFields: fields,
            requiredFields: req,
            overridesCount: ovr
        };
    }, [processedSections]);

    if (loading) {
        return (
            <div className="sdv-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
                <div style={{ textAlign: 'center' }} role="status" aria-live="polite">
                    <div style={{ width: '48px', height: '48px', border: '4px solid #00468C', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 1rem auto' }}></div>
                    <p style={{ color: '#2A2A2A', fontWeight: 600 }}>Probing HDRUK main & dev branches for latest CRUK Base Schema...</p>
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

            {/* Live Announcer for Screen Readers */}
            <div id="sdv-results-region" className="sdv-sr-only" aria-live="polite" aria-atomic="true">
                Showing {stats.totalFields} metadata fields across {filteredSections.length} schema sections.
            </div>

            {/* Header Banner */}
            <header className="sdv-header" role="banner">
                <div className="sdv-header-inner">
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <span className="sdv-badge-tag" aria-hidden="true">CRUK / HDRUK</span>
                            <h1 className="sdv-header-title">Dataset Metadata Schema Documentation</h1>
                        </div>
                        <p className="sdv-header-sub" style={{ marginTop: '0.5rem', lineHeight: '1.5', maxWidth: '800px' }}>
                            The CRUK pilot metadata catalogue is driven by the HDRUK gateway engine using the CRUK {baseSchemaMeta.version} schema ({baseSchemaMeta.branch} branch). To provide flexible guidance and examples this is overlaid with a semantic Schema. Together these result in the schema below.
                        </p>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <a
                            href={baseSchemaMeta.repoUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="sdv-btn-link sdv-btn-base"
                            aria-label={`Open HDRUK Base Schema v${baseSchemaMeta.version} (${baseSchemaMeta.branch} branch) on GitHub`}
                        >
                            HDRUK Base v{baseSchemaMeta.version} ({baseSchemaMeta.branch}) ↗
                        </a>
                        <a
                            href="https://github.com/UOSbioinformaticslab/cruk-semantic-schema"
                            target="_blank"
                            rel="noreferrer"
                            className="sdv-btn-link sdv-btn-primary"
                            aria-label="Open CRUK Semantic Schema Repository on GitHub (opens in new tab)"
                        >
                            CRUK Semantic Repo ↗
                        </a>
                    </div>
                </div>
            </header>

            {/* Stat Cards */}
            <section aria-label="Schema Summary Statistics" className="sdv-stats-grid">
                <div className="sdv-stat-card">
                    <div className="sdv-stat-num">{stats.totalSections}</div>
                    <div className="sdv-stat-label">Total Schema Sections</div>
                </div>
                <div className="sdv-stat-card">
                    <div className="sdv-stat-num">{stats.totalFields}</div>
                    <div className="sdv-stat-label">Total Metadata Fields</div>
                </div>
                <div className="sdv-stat-card">
                    <div className="sdv-stat-num" style={{ color: '#D10A6F' }}>{stats.requiredFields}</div>
                    <div className="sdv-stat-label">Required Fields</div>
                </div>
                <div className="sdv-stat-card">
                    <div className="sdv-stat-num" style={{ color: '#00468C' }}>{stats.overridesCount}</div>
                    <div className="sdv-stat-label">CRUK Semantic Rules</div>
                </div>
            </section>

            {/* Main Content Layout */}
            <div className="sdv-layout">
                
                {/* Expandable Left-Hand Tree Navigation */}
                <aside className="sdv-sidebar" role="complementary" aria-label="Schema Navigation Sidebar">
                    <div className="sdv-sidebar-sticky">
                        <div id="sdv-toc-title" className="sdv-sidebar-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span>Navigation Tree</span>
                            {selectedSectionKey && (
                                <button
                                    onClick={() => setSelectedSectionKey(null)}
                                    style={{ fontSize: '0.7rem', color: '#D10A6F', background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: 700, textDecoration: 'underline' }}
                                >
                                    Show All
                                </button>
                            )}
                        </div>

                        {/* View All Option */}
                        <div
                            onClick={() => setSelectedSectionKey(null)}
                            className={`sdv-nav-item ${selectedSectionKey === null ? 'sdv-nav-active' : ''}`}
                            style={{ marginBottom: '0.5rem', fontWeight: 700, cursor: 'pointer', background: selectedSectionKey === null ? '#EBF3FA' : 'transparent', color: selectedSectionKey === null ? '#00468C' : 'inherit' }}
                        >
                            <span>📋 View All Sections</span>
                            <span className="sdv-nav-count">{processedSections.length}</span>
                        </div>

                        <nav className="sdv-sidebar-nav" aria-labelledby="sdv-toc-title">
                            {processedSections.map(sec => {
                                const hasChildren = sec.subSections && sec.subSections.length > 0;
                                const isExpanded = navExpandedState[sec.key] !== false;
                                const totalCount = sec.directFields.length + sec.subSections.reduce((acc, sub) => acc + sub.fields.length, 0);
                                const isSelected = selectedSectionKey === sec.key;

                                return (
                                    <div key={sec.key} className="sdv-nav-group">
                                        <div
                                            onClick={() => setSelectedSectionKey(sec.key)}
                                            className="sdv-nav-item"
                                            style={{
                                                background: isSelected ? '#D10A6F' : 'transparent',
                                                color: isSelected ? '#ffffff' : 'inherit',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', minWidth: 0 }}>
                                                {hasChildren ? (
                                                    <button
                                                        type="button"
                                                        onClick={(e) => toggleNavExpand(sec.key, e)}
                                                        className="sdv-tree-toggle"
                                                        style={{ color: isSelected ? '#ffffff' : '#00468C' }}
                                                        aria-label={`${isExpanded ? 'Collapse' : 'Expand'} subsection tree for ${sec.title}`}
                                                    >
                                                        {isExpanded ? '▾' : '▸'}
                                                    </button>
                                                ) : (
                                                    <span style={{ width: '1.2rem' }}></span>
                                                )}
                                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {sec.title}
                                                </span>
                                            </div>
                                            <span className="sdv-nav-count" style={{ background: isSelected ? 'rgba(255,255,255,0.2)' : '#f1f5f9', color: isSelected ? '#ffffff' : 'inherit', borderColor: isSelected ? 'transparent' : '#cbd5e1' }}>
                                                {totalCount}
                                            </span>
                                        </div>

                                        {/* Expandable Nested Sub-Section Child Items */}
                                        {hasChildren && isExpanded && (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                                                {sec.subSections.map(sub => {
                                                    const isSubSelected = selectedSectionKey === sub.key;

                                                    return (
                                                        <div
                                                            key={sub.key}
                                                            onClick={() => setSelectedSectionKey(sub.key)}
                                                            className="sdv-nav-subitem"
                                                            style={{
                                                                background: isSubSelected ? '#D10A6F' : 'transparent',
                                                                color: isSubSelected ? '#ffffff' : 'inherit',
                                                                borderLeftColor: isSubSelected ? '#D10A6F' : '#E2E8F0',
                                                                cursor: 'pointer'
                                                            }}
                                                            aria-label={`View sub-section ${sub.title}`}
                                                        >
                                                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                                {sub.title}
                                                            </span>
                                                            <span className="sdv-nav-count" style={{ background: isSubSelected ? 'rgba(255,255,255,0.2)' : '#f1f5f9', color: isSubSelected ? '#ffffff' : 'inherit', borderColor: isSubSelected ? 'transparent' : '#cbd5e1' }}>
                                                                {sub.fields.length}
                                                            </span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </nav>
                    </div>
                </aside>

                {/* Main Schema Content */}
                <main id="sdv-main-content" className="sdv-main" role="main">
                    
                    {/* Search & Filter Toolbar */}
                    <div className="sdv-toolbar" role="region" aria-label="Search and Filter Controls">
                        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                            <div className="sdv-search-box">
                                <label htmlFor="sdv-search-input" className="sdv-sr-only">
                                    Search schema property names, guidance, or descriptions
                                </label>
                                <span className="sdv-search-icon" aria-hidden="true">🔍</span>
                                <input
                                    id="sdv-search-input"
                                    type="text"
                                    placeholder="Search property names, guidance, descriptions..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="sdv-search-input"
                                    aria-controls="sdv-results-region"
                                />
                            </div>

                            {selectedSectionKey && (
                                <button
                                    onClick={() => setSelectedSectionKey(null)}
                                    className="sdv-btn-link sdv-btn-base"
                                    style={{ cursor: 'pointer' }}
                                >
                                    ← Show All Sections
                                </button>
                            )}
                        </div>

                        {/* Active Selection Banner */}
                        {selectedSectionKey && (
                            <div style={{ background: '#EBF3FA', borderLeft: '4px solid #00468C', padding: '0.5rem 1rem', borderRadius: '0 8px 8px 0', fontSize: '0.85rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span>Showing single section: <strong style={{ color: '#00468C' }}>{selectedSectionKey}</strong></span>
                                <button onClick={() => setSelectedSectionKey(null)} style={{ background: 'none', border: 'none', color: '#D10A6F', fontWeight: 700, cursor: 'pointer' }}>Show All</button>
                            </div>
                        )}

                        {/* Filter Buttons */}
                        <div className="sdv-filter-group" role="group" aria-label="Schema field filter options">
                            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginRight: '0.5rem' }}>Filter View:</span>
                            {['all', 'required', 'overrides'].map(mode => (
                                <button
                                    key={mode}
                                    type="button"
                                    onClick={() => setFilterMode(mode)}
                                    className={`sdv-filter-btn ${filterMode === mode ? 'sdv-filter-btn-active' : 'sdv-filter-btn-inactive'}`}
                                    aria-pressed={filterMode === mode}
                                    aria-label={`Filter by ${mode === 'overrides' ? 'CRUK Overrides' : mode}`}
                                >
                                    {mode === 'overrides' ? 'CRUK Overrides' : mode.toUpperCase()}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Section Cards */}
                    <div>
                        {filteredSections.map(sec => (
                            <section
                                key={sec.key}
                                id={`section-${sec.key}`}
                                className="sdv-section"
                                role="region"
                                aria-labelledby={`heading-section-${sec.key}`}
                            >
                                {/* Static Section Header */}
                                <div className="sdv-section-header">
                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                            <h2 id={`heading-section-${sec.key}`} className="sdv-section-name">{sec.title}</h2>
                                            {sec.isRequired && (
                                                <span className="sdv-badge sdv-badge-req">Required Section</span>
                                            )}
                                        </div>
                                        {sec.description && (
                                            <p className="sdv-section-desc">{sec.description}</p>
                                        )}
                                    </div>

                                    <div>
                                        <span className="sdv-nav-count" style={{ background: '#002B5B', color: '#ffffff', borderColor: '#00468C' }}>
                                            {sec.directFields.length + sec.subSections.reduce((a, s) => a + s.fields.length, 0)} fields
                                        </span>
                                    </div>
                                </div>

                                {/* Direct Fields */}
                                {sec.directFields.length > 0 && (
                                    <div role="group" aria-label={`Direct fields in section ${sec.title}`}>
                                        {sec.directFields.map(field => (
                                            <div key={field.key} className="sdv-property-card">
                                                
                                                {/* Property Heading & Badges */}
                                                <div className="sdv-prop-header">
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                                        <code className="sdv-prop-path">{field.path}</code>
                                                        <span className="sdv-prop-title">({field.title})</span>
                                                    </div>

                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                                        {field.isRequired ? (
                                                            <span className="sdv-badge sdv-badge-req">Required</span>
                                                        ) : (
                                                            <span className="sdv-badge sdv-badge-opt">Optional</span>
                                                        )}

                                                        <span className="sdv-badge sdv-badge-type">{field.type}</span>

                                                        {field.hasOverride && (
                                                            <span className="sdv-badge sdv-badge-override">CRUK Rule Override</span>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Description */}
                                                {field.description && (
                                                    <p style={{ fontSize: '0.85rem', color: '#2A2A2A', margin: 0 }}>
                                                        {field.description}
                                                    </p>
                                                )}

                                                {/* Guidance Box */}
                                                {field.guidance && (
                                                    <div className="sdv-guidance-box" role="note" aria-label={`Guidance for ${field.title}`}>
                                                        <div className="sdv-guidance-head">Guidance & Rules</div>
                                                        <div>{renderFormattedText(field.guidance)}</div>
                                                    </div>
                                                )}

                                                {/* Pattern Regex */}
                                                {field.pattern && (
                                                    <div className="sdv-pattern-box" aria-label={`Validation pattern for ${field.title}`}>
                                                        <span className="sdv-pattern-label">Regex Pattern:</span>
                                                        <code>{field.pattern}</code>
                                                    </div>
                                                )}

                                                {/* Enum Values */}
                                                {field.enum && (
                                                    <div className="sdv-enum-container">
                                                        <span style={{ fontWeight: 700, color: '#2A2A2A', display: 'block', marginBottom: '0.3rem' }}>Allowed Enum Values:</span>
                                                        <div>
                                                            {field.enum.map((opt, i) => (
                                                                <span key={i} className="sdv-enum-tag">{String(opt)}</span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Examples */}
                                                {field.examples && field.examples.length > 0 && (
                                                    <div className="sdv-example-box">
                                                        <span style={{ fontWeight: 600, color: '#475569' }}>Examples:</span>
                                                        <code className="sdv-example-code">{JSON.stringify(field.examples)}</code>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Nested Sub-Sections */}
                                {sec.subSections.map(sub => (
                                    <div key={sub.key} id={`section-${sub.key}`} style={{ borderTop: '2px solid #E2E8F0' }}>
                                        <div className="sdv-subsection-header">
                                            <div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                    <h3 className="sdv-subsection-name">{sub.title}</h3>
                                                    <span style={{ fontSize: '0.75rem', fontFamily: 'Fira Code, monospace', color: '#00468C' }}>({sub.path})</span>
                                                    {sub.isRequired && (
                                                        <span className="sdv-badge sdv-badge-req">Required</span>
                                                    )}
                                                </div>
                                                {sub.description && (
                                                    <p style={{ fontSize: '0.8rem', color: '#475569', margin: '0.2rem 0 0 0' }}>{sub.description}</p>
                                                )}
                                            </div>
                                            <span className="sdv-nav-count">{sub.fields.length} fields</span>
                                        </div>

                                        <div role="group" aria-label={`Fields in sub-section ${sub.title}`}>
                                            {sub.fields.map(field => (
                                                <div key={field.key} className="sdv-property-card">
                                                    
                                                    {/* Property Heading & Badges */}
                                                    <div className="sdv-prop-header">
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                                            <code className="sdv-prop-path">{field.path}</code>
                                                            <span className="sdv-prop-title">({field.title})</span>
                                                        </div>

                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                                            {field.isRequired ? (
                                                                <span className="sdv-badge sdv-badge-req">Required</span>
                                                            ) : (
                                                                <span className="sdv-badge sdv-badge-opt">Optional</span>
                                                            )}

                                                            <span className="sdv-badge sdv-badge-type">{field.type}</span>

                                                            {field.hasOverride && (
                                                                <span className="sdv-badge sdv-badge-override">CRUK Rule Override</span>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Description */}
                                                    {field.description && (
                                                        <p style={{ fontSize: '0.85rem', color: '#2A2A2A', margin: 0 }}>
                                                            {field.description}
                                                        </p>
                                                    )}

                                                    {/* Guidance Box */}
                                                    {field.guidance && (
                                                        <div className="sdv-guidance-box" role="note" aria-label={`Guidance for ${field.title}`}>
                                                            <div className="sdv-guidance-head">Guidance & Rules</div>
                                                            <div>{renderFormattedText(field.guidance)}</div>
                                                        </div>
                                                    )}

                                                    {/* Pattern Regex */}
                                                    {field.pattern && (
                                                        <div className="sdv-pattern-box" aria-label={`Validation pattern for ${field.title}`}>
                                                            <span className="sdv-pattern-label">Regex Pattern:</span>
                                                            <code>{field.pattern}</code>
                                                        </div>
                                                    )}

                                                    {/* Enum Values */}
                                                    {field.enum && (
                                                        <div className="sdv-enum-container">
                                                            <span style={{ fontWeight: 700, color: '#2A2A2A', display: 'block', marginBottom: '0.3rem' }}>Allowed Enum Values:</span>
                                                            <div>
                                                                {field.enum.map((opt, i) => (
                                                                    <span key={i} className="sdv-enum-tag">{String(opt)}</span>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Examples */}
                                                    {field.examples && field.examples.length > 0 && (
                                                        <div className="sdv-example-box">
                                                            <span style={{ fontWeight: 600, color: '#475569' }}>Examples:</span>
                                                            <code className="sdv-example-code">{JSON.stringify(field.examples)}</code>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </section>
                        ))}
                    </div>
                </main>
            </div>
        </div>
    );
}
