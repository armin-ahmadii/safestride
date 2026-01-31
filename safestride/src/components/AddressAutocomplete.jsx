/**
 * AddressAutocomplete Component
 * 
 * React component that provides address autocomplete functionality
 * using Mapbox Geocoding API. Shows dropdown suggestions as user types.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import axios from 'axios';
import './AddressAutocomplete.css';

export default function AddressAutocomplete({
    placeholder,
    onSelect,
    disabled = false,
    accessToken
}) {
    const [query, setQuery] = useState('');
    const [suggestions, setSuggestions] = useState([]);
    const [isOpen, setIsOpen] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(-1);
    const wrapperRef = useRef(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(event) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Fetch suggestions from Mapbox Geocoding API
    const fetchSuggestions = useCallback(async (searchText) => {
        if (!searchText || searchText.length < 3) {
            setSuggestions([]);
            setIsOpen(false);
            return;
        }

        try {
            const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(searchText)}.json`;
            const { data } = await axios.get(url, {
                params: {
                    access_token: accessToken,
                    country: 'CA',
                    proximity: '-123.1207,49.2827', // Vancouver
                    limit: 5,
                    types: 'address,poi'
                }
            });

            if (data.features && data.features.length > 0) {
                setSuggestions(data.features);
                setIsOpen(true);
            } else {
                setSuggestions([]);
                setIsOpen(false);
            }
        } catch (error) {
            console.error('Geocoding error:', error);
            setSuggestions([]);
            setIsOpen(false);
        }
    }, [accessToken]);

    // Debounce input to avoid too many API calls
    useEffect(() => {
        const timer = setTimeout(() => {
            if (query) {
                fetchSuggestions(query);
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [query, fetchSuggestions]);

    const handleInputChange = (e) => {
        setQuery(e.target.value);
        setSelectedIndex(-1);
    };

    const handleSelect = (suggestion) => {
        setQuery(suggestion.place_name);
        setIsOpen(false);
        setSuggestions([]);
        onSelect(suggestion.place_name, suggestion.center);
    };

    const handleKeyDown = (e) => {
        if (!isOpen) return;

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setSelectedIndex(prev =>
                    prev < suggestions.length - 1 ? prev + 1 : prev
                );
                break;
            case 'ArrowUp':
                e.preventDefault();
                setSelectedIndex(prev => prev > 0 ? prev - 1 : -1);
                break;
            case 'Enter':
                e.preventDefault();
                if (selectedIndex >= 0 && suggestions[selectedIndex]) {
                    handleSelect(suggestions[selectedIndex]);
                }
                break;
            case 'Escape':
                setIsOpen(false);
                break;
            default:
                break;
        }
    };

    return (
        <div className="address-autocomplete" ref={wrapperRef}>
            <input
                type="text"
                value={query}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                disabled={disabled}
                className="address-input"
            />

            {isOpen && suggestions.length > 0 && (
                <div className="suggestions-dropdown">
                    {suggestions.map((suggestion, index) => (
                        <div
                            key={suggestion.id}
                            className={`suggestion-item ${index === selectedIndex ? 'selected' : ''}`}
                            onClick={() => handleSelect(suggestion)}
                            onMouseEnter={() => setSelectedIndex(index)}
                        >
                            <div className="suggestion-text">{suggestion.text}</div>
                            <div className="suggestion-subtext">{suggestion.place_name}</div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
