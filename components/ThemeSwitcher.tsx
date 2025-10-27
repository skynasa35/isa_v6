
import React from 'react';
import { THEMES } from '../constants';
import { Palette } from 'lucide-react';

interface ThemeSwitcherProps {
  currentThemeName: string;
  setThemeName: (name: string) => void;
}

const ThemeSwitcher: React.FC<ThemeSwitcherProps> = ({ currentThemeName, setThemeName }) => {
  const themes = Object.keys(THEMES);
  
  const handleThemeChange = () => {
    const currentIndex = themes.indexOf(currentThemeName);
    const nextIndex = (currentIndex + 1) % themes.length;
    setThemeName(themes[nextIndex]);
  };

  if (themes.length <= 1) {
    return (
      <div className="flex items-center gap-2 text-text-secondary px-2">
        <Palette size={16} />
        <span className='text-sm font-medium'>{currentThemeName}</span>
      </div>
    )
  }

  return (
    <button
      onClick={handleThemeChange}
      className="flex items-center gap-3 p-2 rounded-md hover:bg-bg-tertiary"
      title={currentThemeName}
    >
      <Palette size={18} className='text-text-secondary' />
    </button>
  );
};

export default ThemeSwitcher;
