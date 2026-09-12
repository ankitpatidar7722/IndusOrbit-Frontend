/* ════════════════════════════════════════════════════════════════════════
   Sub-feature catalog — the master list of sub-features per FEATURE.

   This is the single source of truth the New/Edit Plan dropdown reads from.
   Keyed by feature CODE (case-insensitive), e.g. "Sahay", "Email" — NOT the
   numeric FeatureID, so it survives id changes.

   To add a sub-feature: add a { key, label } row under the right feature.
   `key` is the technical id stored on the plan (must be stable / lowercase_snake);
   `label` is what the user sees in the dropdown.

   NOTE: selecting a sub-feature here records it on the plan (SubFeaturesJson).
   It does NOT yet enforce anything on the product side — that's a later phase.
   ════════════════════════════════════════════════════════════════════════ */

export interface CatalogSubFeature {
    key: string;
    label: string;
}

// Feature code (lowercased) → its available sub-features.
const CATALOG: Record<string, CatalogSubFeature[]> = {
    sahay: [
        { key: 'basic_qa', label: 'Business-data Q&A' },
        { key: 'auto_charts', label: 'Auto-charts & visualisation' },
        { key: 'dashboards', label: 'Dashboards' },
        { key: 'ai_insights', label: 'AI insights' },
    ],
    email: [
        { key: 'scheduled', label: 'Scheduled emails' },
        { key: 'multi_format', label: 'HTML / PDF / Excel formats' },
        { key: 'multi_recipient', label: 'Multiple recipients' },
        { key: 'ai_summaries', label: 'AI summaries in reports' },
    ],
};

/** Sub-features defined for a feature code (e.g. "Sahay"). Empty if none defined. */
export const getCatalogSubFeatures = (featureCode?: string): CatalogSubFeature[] =>
    CATALOG[(featureCode || '').trim().toLowerCase()] ?? [];
