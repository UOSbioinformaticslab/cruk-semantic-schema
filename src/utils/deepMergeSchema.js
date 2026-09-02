// Utility to deep merge HDRUK base schema with CRUK Semantic Schema

export function deepMerge(target, source) {
    if (typeof target !== 'object' || target === null) return source || target;
    if (typeof source !== 'object' || source === null) return target;

    const output = Array.isArray(target) ? [...target] : { ...target };

    Object.keys(source).forEach(key => {
        const targetValue = output[key];
        const sourceValue = source[key];

        if (Array.isArray(targetValue) && Array.isArray(sourceValue)) {
            // For arrays like 'required' or 'enum', union them or use source if specified
            if (key === 'required') {
                output[key] = Array.from(new Set([...targetValue, ...sourceValue]));
            } else {
                output[key] = sourceValue;
            }
        } else if (typeof targetValue === 'object' && typeof sourceValue === 'object' && targetValue !== null && sourceValue !== null) {
            output[key] = deepMerge(targetValue, sourceValue);
        } else {
            output[key] = sourceValue;
        }
    });

    return output;
}

export function resolveRef(schema, refPath) {
    if (!refPath || typeof refPath !== 'string' || !refPath.startsWith('#/')) return null;
    const parts = refPath.replace(/^#\//, '').split('/');
    let current = schema;
    for (const part of parts) {
        if (current && typeof current === 'object' && part in current) {
            current = current[part];
        } else {
            return null;
        }
    }
    return current;
}
