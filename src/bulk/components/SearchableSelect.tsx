import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, X } from 'lucide-react';

export interface SearchableSelectOption {
    value: string | number;
    label: string;
}

interface SearchableSelectProps {
    value: string | number;
    onChange: (value: string | number) => void;
    options: SearchableSelectOption[];
    placeholder?: string;
    disabled?: boolean;
    className?: string;
    label?: string;
    required?: boolean;
    error?: string;
}

const SearchableSelect: React.FC<SearchableSelectProps> = ({
    value,
    onChange,
    options,
    placeholder = 'Select...',
    disabled = false,
    className = '',
    label,
    required = false,
    error
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [isFocused, setIsFocused] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Get selected option label
    const selectedOption = options.find(opt => opt.value === value);

    // Display value: when focused and open, show search term, otherwise show selected label
    const displayValue = (isFocused && isOpen) ? searchTerm : (selectedOption?.label || '');

    // Filter options based on search
    const filteredOptions = options.filter(option =>
        option.label.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
                setSearchTerm('');
                setIsFocused(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    // Handle option selection
    const handleSelect = (optionValue: string | number) => {
        onChange(optionValue);
        setIsOpen(false);
        setSearchTerm('');
        setIsFocused(false);
        inputRef.current?.blur();
    };

    // Handle input focus
    const handleFocus = () => {
        if (!disabled) {
            setIsFocused(true);
            setIsOpen(true);
            setSearchTerm('');
        }
    };

    // Handle input change (typing)
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
        if (!isOpen) {
            setIsOpen(true);
        }
    };

    // Handle keyboard navigation
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (disabled) return;

        if (e.key === 'Escape') {
            setIsOpen(false);
            setSearchTerm('');
            setIsFocused(false);
            inputRef.current?.blur();
        } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            if (!isOpen) {
                setIsOpen(true);
            }
        } else if (e.key === 'Enter' && filteredOptions.length === 1) {
            e.preventDefault();
            handleSelect(filteredOptions[0].value);
        }
    };

    // Clear search
    const handleClear = (e: React.MouseEvent) => {
        e.stopPropagation();
        setSearchTerm('');
        inputRef.current?.focus();
    };

    return (
        <div className="relative" ref={dropdownRef}>
            {/* Label */}
            {label && (
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    {label}
                    {required && <span className="text-red-500 ml-1">*</span>}
                </label>
            )}

            {/* Input Field (Searchable) */}
            <div className="relative">
                <input
                    ref={inputRef}
                    type="text"
                    value={displayValue}
                    onChange={handleInputChange}
                    onFocus={handleFocus}
                    onKeyDown={handleKeyDown}
                    placeholder={placeholder}
                    disabled={disabled}
                    className={`
                        w-full px-3 py-1.5 pr-10 bg-white dark:bg-[#1e293b]
                        border ${error ? 'border-red-500' : 'border-gray-300 dark:border-gray-700'}
                        rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                        outline-none transition-all text-sm
                        ${disabled
                            ? 'bg-gray-50 dark:bg-gray-900/50 text-gray-400 dark:text-gray-600 cursor-not-allowed'
                            : 'text-gray-900 dark:text-white cursor-text'
                        }
                        ${className}
                    `}
                    autoComplete="off"
                    style={{ userSelect: 'text' }}
                />

                {/* Clear and Chevron Icons */}
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    {/* Clear button - show only when there's search text and focused */}
                    {searchTerm && isFocused && !disabled && (
                        <button
                            type="button"
                            onClick={handleClear}
                            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-0.5"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    )}

                    {/* Chevron Icon */}
                    <ChevronDown
                        className={`w-4 h-4 transition-transform flex-shrink-0 text-gray-400 ${isOpen ? 'rotate-180' : ''}`}
                        style={{ pointerEvents: 'none' }}
                    />
                </div>
            </div>

            {/* Error Message */}
            {error && (
                <p className="mt-1 text-xs text-red-500">{error}</p>
            )}

            {/* Dropdown Menu */}
            {isOpen && !disabled && (
                <div className="absolute z-50 w-full mt-1 bg-white dark:bg-[#1e293b] border border-gray-300 dark:border-gray-700 rounded-lg shadow-lg max-h-64 overflow-y-auto custom-scrollbar">
                    {filteredOptions.length > 0 ? (
                        filteredOptions.map((option) => (
                            <button
                                key={option.value}
                                type="button"
                                onClick={() => handleSelect(option.value)}
                                className={`
                                    w-full px-3 py-2 text-left text-sm transition-colors
                                    ${option.value === value
                                        ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-medium'
                                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                                    }
                                `}
                            >
                                {/* Copyable option text */}
                                <span className="select-text" style={{ userSelect: 'text' }}>
                                    {option.label}
                                </span>
                            </button>
                        ))
                    ) : (
                        <div className="px-3 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                            No options found
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default SearchableSelect;
