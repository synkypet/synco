// src/components/shared/KeywordTagsInput.tsx
'use client';

import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { X, Search, Plus } from 'lucide-react';

interface KeywordTagsInputProps {
  value: string[];
  onChange: (keywords: string[]) => void;
  maxKeywords?: number;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function KeywordTagsInput({
  value,
  onChange,
  maxKeywords = 5,
  placeholder = "Digite e pressione Enter (ou +)",
  className = "",
  disabled = false
}: KeywordTagsInputProps) {
  const [inputValue, setInputValue] = useState('');

  const handleAddTag = () => {
    const term = inputValue.trim();
    if (term && value.length < maxKeywords && !value.includes(term)) {
      onChange([...value, term]);
      setInputValue('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag();
    } else if (e.key === 'Backspace' && !inputValue && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  };

  const removeTag = (indexToRemove: number) => {
    onChange(value.filter((_, index) => index !== indexToRemove));
  };

  return (
    <div className={`relative flex items-center flex-wrap gap-2 p-2 bg-deep-void border-none shadow-skeuo-pressed rounded-2xl min-h-[56px] focus-within:ring-1 focus-within:ring-kinetic-orange/20 ${className}`}>
      <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/10" size={20} />
      
      <div className="flex flex-wrap items-center gap-2 pl-10 w-full pr-12">
        {value.map((tag, index) => (
          <Badge 
            key={index} 
            variant="secondary"
            className="flex items-center gap-1 bg-white/10 hover:bg-white/20 text-white font-bold text-[11px] py-1.5 px-3 rounded-lg animate-in zoom-in duration-200"
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(index)}
              className="ml-1 text-white/40 hover:text-red-400 focus:outline-none"
              disabled={disabled}
            >
              <X size={12} />
            </button>
          </Badge>
        ))}
        
        <Input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled || value.length >= maxKeywords}
          placeholder={value.length === 0 ? placeholder : ''}
          className="flex-1 min-w-[120px] bg-transparent border-none shadow-none text-[13px] font-bold tracking-tight text-white/90 placeholder:text-white/20 focus-visible:ring-0 h-8 px-0"
        />
        
        {inputValue.trim() && value.length < maxKeywords && (
          <button
            type="button"
            onClick={handleAddTag}
            disabled={disabled}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-kinetic-orange/20 text-kinetic-orange hover:bg-kinetic-orange/30 rounded-xl transition-all animate-in zoom-in"
          >
            <Plus size={16} />
          </button>
        )}
      </div>
    </div>
  );
}
