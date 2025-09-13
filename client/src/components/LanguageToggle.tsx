import React from 'react';
import { Button } from './ui/button';

interface LanguageToggleProps {
  onChange: (lang: string) => void;
  currentLang?: string;
}

export const LanguageToggle: React.FC<LanguageToggleProps> = ({ onChange, currentLang = 'en' }) => {
  return (
    <div className="flex space-x-2">
      <Button 
        variant={currentLang === 'en' ? 'default' : 'outline'}
        size="sm"
        onClick={() => onChange('en')}
        data-testid="language-toggle-en"
      >
        EN
      </Button>
      <Button 
        variant={currentLang === 'th' ? 'default' : 'outline'}
        size="sm" 
        onClick={() => onChange('th')}
        data-testid="language-toggle-th"
      >
        ไทย
      </Button>
    </div>
  );
};