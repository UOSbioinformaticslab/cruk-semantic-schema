import React, { useState, useEffect, useMemo } from 'react';
import { deepMerge, resolveRef } from './utils/deepMergeSchema.js';
import './SchemaDocViewer.css';

const HDRUK_BASE_SCHEMA_URL = "https://raw.githubusercontent.com/HDRUK/schemata/dev/hdr_schemata/models/CRUK/1.0.0/schema.json";
const CRUK_SEMANTIC_SCHEMA_URL = "https://raw.githubusercontent.com/UOSbioinformaticslab/cruk-semantic-schema/main/semanticSchema.json";

export default function SchemaDocViewer() {
    const [baseSchema, setBaseSchema] = useState(null);
    const [semanticSchema, setSemanticSchema] = useState(null);
    const [mergedSchema, setMergedSchema] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterMode, setFilterMode] = useState('all'); // 'all', 'required', 'overrides'
    const [expandedSections, setExpandedSections] = useState({});

    // Fetch live schemas on load
    useEffect(() => {
        const fetchSchemas = async () => {
            try {
                setLoading(true);
                const [baseRes, semRes] = await Promise.all([
                    fetch(HDRUK_BASE_SCHEMA_URL),
                    fetch(CRUK_SEMANTIC_SCHEMA_URL)
                ]);

                if (!baseRes.ok) throw new Error("Failed to fetch base HDRUK schema");
                if (!semRes.ok) throw new Error("Failed to fetch CRUK semantic schema");

                const baseData = await baseRes.json();
                const semData = await semRes.json();

                setBaseSchema(baseData);
                setSemanticSchema(semData);

                const merged = deepMerge(baseData, semData);
                setMergedSchema(merged);

                // Initialize all top-level sections as expanded
                const initialExpanded = {};
                if (merged.properties) {
                    Object.keys(merged.properties).forEach(key => {
                        initialExpanded[key] = true;
                    });
                }
                setExpandedSections(initialExpanded);
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

    const toggleSection = (sectionKey) => {
        setExpandedSections(prev => ({
            ...prev,
            [sectionKey]: !prev[sectionKey]
        }));
    };

    const toggleAllSections = (expand) => {
        if (!mergedSchema?.properties) return;
        const newState = {};
        Object.keys(mergedSchema.properties).forEach(key => {
            newState[key] = expand;
        });
        setExpandedSections(newState);
    };

    // Helper to format markdown links & bolding in guidance
    const renderFormattedText = (text) => {
        if (!text) return null;
        let formatted = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer" style="color: #2563eb; text-decoration: underline; font-weight: 600;">$1</a>');
        formatted = formatted.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        formatted = formatted.replace(/\\n|\n/g, '<br/>');
        return <span dangerouslySetInnerHTML={{ __html: formatted }} />;
    };

    // Process schema fields recursively for display
    const processedSections = useMemo(() => {
        if (!mergedSchema || !mergedSchema.properties) return [];

        const sections = [];

        Object.entries(mergedSchema.properties).forEach(([sectionKey, sectionProp]) => {
            const resolvedSection = sectionProp.$ref ? (resolveRef(mergedSchema, sectionProp.$ref) || sectionProp) : sectionProp;
            const isSectionRequired = mergedSchema.required?.includes(sectionKey);

            const capSection = sectionKey.charAt(0).toUpperCase() + sectionKey.slice(1);
            const semSection = semanticSchema?.$defs?.[sectionKey] || semanticSchema?.$defs?.[capSection] || semanticSchema?.properties?.[sectionKey];

            let subProperties = [];

            if (resolvedSection.properties) {
                subProperties = Object.entries(resolvedSection.properties).map(([fieldKey, fieldProp]) => {
                    const resolvedField = fieldProp.$ref ? (resolveRef(mergedSchema, fieldProp.$ref) || fieldProp) : fieldProp;
                    const isRequired = resolvedSection.required?.includes(fieldKey);
                    
                    const semField = semSection?.properties?.[fieldKey];
                    const guidanceText = resolvedField.guidance || fieldProp.guidance || semField?.guidance;
                    const hasOverride = Boolean(guidanceText || semField || (semSection && semSection.guidance));

                    return {
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
                    };
                });
            } else {
                const guidanceText = resolvedSection.guidance || sectionProp.guidance || semSection?.guidance;
                const hasOverride = Boolean(guidanceText || semSection);

                subProperties.push({
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
                fields: subProperties
            });
        });

        return sections;
    }, [mergedSchema, semanticSchema]);

    // Filter sections based on search and selected filter mode
    const filteredSections = useMemo(() => {
        if (!processedSections) return [];

        const search = searchTerm.toLowerCase().trim();

        return processedSections.map(sec => {
            const matchingFields = sec.fields.filter(f => {
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
                ...sec,
                fields: matchingFields
            };
        }).filter(sec => sec.fields.length > 0);
    }, [processedSections, searchTerm, filterMode]);

    // Total metrics
    const stats = useMemo(() => {
        if (!processedSections) return { totalSections: 0, totalFields: 0, requiredFields: 0, overridesCount: 0 };
        let fields = 0, req = 0, ovr = 0;
        processedSections.forEach(s => {
            fields += s.fields.length;
            s.fields.forEach(f => {
                if (f.isRequired) req++;
                if (f.hasOverride) ovr++;
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
                    <div style={{ width: '48px', height: '48px', border: '4px solid #2563eb', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 1rem auto' }}></div>
                    <p style={{ color: '#334155', fontWeight: 600 }}>Fetching live HDRUK 1.0.0 Base Schema & CRUK Semantic Schema...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="sdv-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '2rem' }}>
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '16px', padding: '2rem', maxWidth: '500px', textAlign: 'center' }} role="alert">
                    <h2 style={{ color: '#dc2626', fontSize: '1.25rem', fontWeight: 800, marginBottom: '0.5rem' }}>Schema Loading Failed</h2>
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
                        <p className="sdv-header-sub">
                            Live Merged View: HDRUK 1.0.0 Base Schema + CRUK Semantic Rules & Overrides
                        </p>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <a
                            href="https://github.com/HDRUK/schemata/blob/dev/hdr_schemata/models/CRUK/1.0.0/schema.json"
                            target="_blank"
                            rel="noreferrer"
                            className="sdv-btn-link sdv-btn-base"
                            aria-label="Open HDRUK Base Schema Repository on GitHub (opens in new tab)"
                        >
                            HDRUK Base Repo ↗
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
                    <div className="sdv-stat-num" style={{ color: '#dc2626' }}>{stats.requiredFields}</div>
                    <div className="sdv-stat-label">Required Fields</div>
                </div>
                <div className="sdv-stat-card">
                    <div className="sdv-stat-num" style={{ color: '#2563eb' }}>{stats.overridesCount}</div>
                    <div className="sdv-stat-label">CRUK Semantic Rules</div>
                </div>
            </section>

            {/* Main Content Layout */}
            <div className="sdv-layout">
                
                {/* Sidebar Navigation */}
                <aside className="sdv-sidebar" role="complementary" aria-label="Schema Navigation Sidebar">
                    <div className="sdv-sidebar-sticky">
                        <div id="sdv-toc-title" className="sdv-sidebar-title">
                            Schema Sections ({filteredSections.length})
                        </div>
                        <nav className="sdv-sidebar-nav" aria-labelledby="sdv-toc-title">
                            {filteredSections.map(sec => (
                                <a
                                    key={sec.key}
                                    href={`#section-${sec.key}`}
                                    className="sdv-nav-item"
                                    aria-label={`Jump to section ${sec.title} (${sec.fields.length} fields)`}
                                >
                                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sec.title}</span>
                                    <span className="sdv-nav-count">{sec.fields.length}</span>
                                </a>
                            ))}
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

                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button
                                    type="button"
                                    onClick={() => toggleAllSections(true)}
                                    className="sdv-btn-link sdv-btn-base"
                                    style={{ cursor: 'pointer' }}
                                    aria-label="Expand all schema sections"
                                >
                                    Expand All
                                </button>
                                <button
                                    type="button"
                                    onClick={() => toggleAllSections(false)}
                                    className="sdv-btn-link sdv-btn-base"
                                    style={{ cursor: 'pointer' }}
                                    aria-label="Collapse all schema sections"
                                >
                                    Collapse All
                                </button>
                            </div>
                        </div>

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
                        {filteredSections.map(sec => {
                            const isExpanded = expandedSections[sec.key];

                            return (
                                <section
                                    key={sec.key}
                                    id={`section-${sec.key}`}
                                    className="sdv-section"
                                    role="region"
                                    aria-labelledby={`heading-section-${sec.key}`}
                                >
                                    {/* Section Header Button */}
                                    <button
                                        type="button"
                                        onClick={() => toggleSection(sec.key)}
                                        className="sdv-section-btn"
                                        aria-expanded={isExpanded}
                                        aria-controls={`section-content-${sec.key}`}
                                    >
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

                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                            <span style={{ fontSize: '0.75rem', fontFamily: 'Fira Code, monospace', background: '#334155', color: '#f8fafc', padding: '0.2rem 0.6rem', borderRadius: '999px' }}>
                                                {sec.fields.length} fields
                                            </span>
                                            <span style={{ color: '#94a3b8', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }} aria-hidden="true">
                                                ▼
                                            </span>
                                        </div>
                                    </button>

                                    {/* Property Fields */}
                                    {isExpanded && (
                                        <div id={`section-content-${sec.key}`} role="group" aria-label={`Fields in section ${sec.title}`}>
                                            {sec.fields.map(field => (
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
                                                        <p style={{ fontSize: '0.85rem', color: '#334155', margin: 0 }}>
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
                                                            <span style={{ fontWeight: 700, color: '#1e293b', display: 'block', marginBottom: '0.3rem' }}>Allowed Enum Values:</span>
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
                                </section>
                            );
                        })}
                    </div>
                </main>
            </div>
        </div>
    );
}
