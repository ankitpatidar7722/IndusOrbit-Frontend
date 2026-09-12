/**
 * SearchableSelect Component Usage Example
 *
 * Ye file dikhata hai ki SearchableSelect component ko kaise use karna hai.
 * Purane <select> elements ko replace karne ke liye.
 */

import React, { useState } from 'react';
import SearchableSelect, { SearchableSelectOption } from './SearchableSelect';

const SearchableSelectExample: React.FC = () => {
    const [selectedModule, setSelectedModule] = useState<string>('');
    const [selectedItemGroup, setSelectedItemGroup] = useState<number>(0);

    // Example options for Module dropdown
    const moduleOptions: SearchableSelectOption[] = [
        { value: '1', label: 'Ledger Master' },
        { value: '2', label: 'Item Masters' },
        { value: '3', label: 'Tool Master' },
        { value: '4', label: 'Product Group Master (HSN)' },
        { value: '5', label: 'Spare Part Master' },
    ];

    // Example options for Item Group dropdown
    const itemGroupOptions: SearchableSelectOption[] = [
        { value: 1, label: 'PAPER' },
        { value: 2, label: 'REEL' },
        { value: 3, label: 'INK & ADDITIVES' },
        { value: 4, label: 'VARNISHES & COATINGS' },
        { value: 5, label: 'LAMINATION FILM' },
        { value: 6, label: 'FOIL' },
        { value: 8, label: 'OTHER MATERIAL' },
        { value: 13, label: 'ROLL' },
    ];

    return (
        <div className="p-8 space-y-6 bg-gray-50 dark:bg-[#020617] min-h-screen">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
                SearchableSelect Component Examples
            </h1>

            {/* Example 1: Basic usage with label */}
            <div className="bg-white dark:bg-[#0f172a] p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    Example 1: Module Selection (String values)
                </h2>

                <SearchableSelect
                    label="Module Name"
                    value={selectedModule}
                    onChange={(value) => setSelectedModule(value as string)}
                    options={moduleOptions}
                    placeholder="Select Module Name"
                    required
                />

                <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
                    Selected Value: <span className="font-mono text-blue-600 dark:text-blue-400">{selectedModule || 'None'}</span>
                </p>
            </div>

            {/* Example 2: Numeric values with error */}
            <div className="bg-white dark:bg-[#0f172a] p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    Example 2: Item Group (Number values)
                </h2>

                <SearchableSelect
                    label="Item Group"
                    value={selectedItemGroup}
                    onChange={(value) => setSelectedItemGroup(value as number)}
                    options={itemGroupOptions}
                    placeholder="Select Item Group"
                />

                <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
                    Selected Value: <span className="font-mono text-blue-600 dark:text-blue-400">{selectedItemGroup || 'None'}</span>
                </p>
            </div>

            {/* Example 3: Disabled state */}
            <div className="bg-white dark:bg-[#0f172a] p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    Example 3: Disabled Dropdown
                </h2>

                <SearchableSelect
                    label="Disabled Dropdown"
                    value=""
                    onChange={() => {}}
                    options={moduleOptions}
                    placeholder="This dropdown is disabled"
                    disabled={true}
                />
            </div>

            {/* Features List */}
            <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-lg border border-blue-200 dark:border-blue-900">
                <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-300 mb-3">
                    ✨ Features
                </h3>
                <ul className="space-y-2 text-sm text-blue-800 dark:text-blue-200">
                    <li>🔍 <strong>Searchable:</strong> Type karo aur options filter ho jayenge</li>
                    <li>📋 <strong>Copyable:</strong> Selected value aur options dono ko copy kar sakte ho</li>
                    <li>🎨 <strong>Beautiful:</strong> Existing design ke saath perfectly match karta hai</li>
                    <li>🌓 <strong>Dark Mode:</strong> Dark mode support hai</li>
                    <li>⌨️ <strong>Keyboard Navigation:</strong> Enter, Space, Escape keys kaam karti hain</li>
                    <li>♿ <strong>Accessible:</strong> Screen readers aur keyboard users ke liye accessible</li>
                    <li>📱 <strong>Responsive:</strong> Mobile aur desktop dono par achha dikhta hai</li>
                </ul>
            </div>

            {/* Migration Guide */}
            <div className="bg-green-50 dark:bg-green-900/20 p-6 rounded-lg border border-green-200 dark:border-green-900">
                <h3 className="text-lg font-semibold text-green-900 dark:text-green-300 mb-3">
                    🔄 Migration Guide: Purane select ko replace karna
                </h3>

                <div className="space-y-4">
                    <div>
                        <p className="text-sm font-semibold text-green-800 dark:text-green-200 mb-2">PEHLE (Old select):</p>
                        <pre className="bg-white dark:bg-[#0f172a] p-3 rounded border border-green-200 dark:border-green-900 text-xs overflow-x-auto">
{`<select
    className="w-full px-3 py-1.5 bg-white dark:bg-[#1e293b]..."
    value={selectedModule}
    onChange={(e) => setSelectedModule(e.target.value)}
>
    <option value="" disabled hidden>Select Module Name</option>
    {modules.map((module) => (
        <option key={module.moduleId} value={module.moduleId}>
            {module.moduleDisplayName}
        </option>
    ))}
</select>`}
                        </pre>
                    </div>

                    <div>
                        <p className="text-sm font-semibold text-green-800 dark:text-green-200 mb-2">AB (New SearchableSelect):</p>
                        <pre className="bg-white dark:bg-[#0f172a] p-3 rounded border border-green-200 dark:border-green-900 text-xs overflow-x-auto">
{`<SearchableSelect
    label="Module Name"
    value={selectedModule}
    onChange={setSelectedModule}
    options={modules.map(m => ({
        value: m.moduleId,
        label: m.moduleDisplayName
    }))}
    placeholder="Select Module Name"
/>`}
                        </pre>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SearchableSelectExample;
