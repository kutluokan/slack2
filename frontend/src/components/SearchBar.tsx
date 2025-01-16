import { useState, useRef, useEffect, useCallback } from 'react';
import { socket } from '../config/socket';
import { FaSearch, FaTimes } from 'react-icons/fa';
import debounce from 'lodash/debounce';

interface SearchResult {
  messageId: string;
  channelId: string;
  content: string;
  username: string;
  timestamp: number;
  channelName?: string;
  fileAttachment?: {
    fileName: string;
    fileType: string;
    fileSize: number;
    fileUrl: string;
    s3Key: string;
  };
}

interface SearchBarProps {
  onResultSelect: (result: SearchResult) => void;
}

export const SearchBar = ({ onResultSelect }: SearchBarProps) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Create a debounced search function
  const debouncedSearch = useCallback(
    debounce((searchQuery: string) => {
      if (searchQuery.trim()) {
        setIsSearching(true);
        socket.emit('search_messages', { query: searchQuery.trim() });
      } else {
        setResults([]);
        setIsSearching(false);
      }
    }, 300),
    []
  );

  useEffect(() => {
    const handleSearchResults = (searchResults: SearchResult[]) => {
      setResults(searchResults);
      setIsSearching(false);
      setShowResults(true);
    };

    socket.on('search_results', handleSearchResults);

    return () => {
      socket.off('search_results', handleSearchResults);
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Handle input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    setShowResults(true);
    debouncedSearch(value);
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  const highlightMatch = (text: string) => {
    if (!query) return text;
    
    const regex = new RegExp(`(${query})`, 'gi');
    const parts = text.split(regex);
    
    return parts.map((part, i) => 
      regex.test(part) ? <mark key={i} className="bg-yellow-200">{part}</mark> : part
    );
  };

  return (
    <div ref={searchRef} className="relative w-full px-2">
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={handleInputChange}
          onFocus={() => setShowResults(true)}
          placeholder="Search messages and files..."
          className="w-full px-8 py-1 bg-gray-700 text-white rounded-md 
                     placeholder-gray-400 focus:outline-none focus:ring-2 
                     focus:ring-blue-500"
        />
        <FaSearch 
          className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400" 
          size={14}
        />
        {query && (
          <button
            onClick={() => {
              setQuery('');
              setResults([]);
              setShowResults(false);
              setIsSearching(false);
            }}
            className="absolute right-2 top-1/2 transform -translate-y-1/2 
                       text-gray-400 hover:text-gray-300"
          >
            <FaTimes size={14} />
          </button>
        )}
      </div>

      {/* Search Results */}
      {showResults && (query.trim() !== '') && (
        <div className="absolute z-50 w-full mt-2 bg-gray-800 rounded-md shadow-lg 
                        max-h-96 overflow-y-auto">
          {isSearching ? (
            <div className="p-4 text-center text-gray-400">
              Searching...
            </div>
          ) : results.length > 0 ? (
            <div className="py-2">
              {results.map((result) => (
                <div
                  key={result.messageId}
                  onClick={() => {
                    onResultSelect(result);
                    setShowResults(false);
                  }}
                  className="px-4 py-2 hover:bg-gray-700 cursor-pointer"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="text-xs text-gray-400 mb-1">
                        {result.channelId.startsWith('dm_') ? '@' : '#'}
                        {result.channelName || result.channelId}
                      </div>
                      <div className="text-sm text-gray-300">
                        {highlightMatch(result.content)}
                      </div>
                      {result.fileAttachment && (
                        <div className="text-xs text-blue-400 mt-1">
                          📎 {result.fileAttachment.fileName}
                        </div>
                      )}
                      <div className="text-xs text-gray-500 mt-1">
                        by {result.username} • {formatTime(result.timestamp)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4 text-center text-gray-400">
              No results found
            </div>
          )}
        </div>
      )}
    </div>
  );
}; 