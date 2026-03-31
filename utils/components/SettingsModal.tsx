import React, { useState, useEffect } from 'react';
import { UserSettings } from '../types';

interface SettingsModalProps {
  onClose: () => void;
}

export const defaultSettings: UserSettings = {
  apiKey: '',
  model: 'gemini-2.5-flash',
  ttsSpeed: 1.0,
};

export const getSettings = (): UserSettings => {
  const saved = localStorage.getItem('mangalunar_settings');
  if (saved) {
    try {
      return { ...defaultSettings, ...JSON.parse(saved) };
    } catch {
       return defaultSettings;
    }
  }
  return defaultSettings;
};

export const SettingsModal: React.FC<SettingsModalProps> = ({ onClose }) => {
  const [settings, setSettings] = useState<UserSettings>(defaultSettings);

  useEffect(() => {
    setSettings(getSettings());
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    // For range inputs, convert generic string back to float
    setSettings(prev => ({ 
        ...prev, 
        [name]: name === 'ttsSpeed' ? parseFloat(value) : value 
    }));
  };

  const handleSave = () => {
    localStorage.setItem('mangalunar_settings', JSON.stringify(settings));
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 text-white font-sans">
      <div className="bg-reader-dark border border-white/10 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10 bg-white/5">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-primary text-3xl">settings</span>
            <h2 className="text-xl font-bold tracking-tight">App Settings</h2>
          </div>
          <button 
             onClick={onClose}
             className="text-white/50 hover:text-white transition-colors"
          >
            <span className="material-symbols-outlined text-2xl">close</span>
          </button>
        </div>

        {/* Body */}
        <div className="p-6 flex flex-col gap-6">
          {/* API Key */}
          <div className="flex flex-col gap-2">
             <label className="text-sm font-medium text-white/80">Google Gemini API Key</label>
             <input 
                type="password"
                name="apiKey"
                value={settings.apiKey}
                onChange={handleChange}
                placeholder="AIzaSy..."
                className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all font-mono placeholder:text-white/20 text-white"
             />
             <p className="text-xs text-white/40 leading-relaxed">Your key is stored securely in your local browser storage and is never sent to our servers.</p>
          </div>

          {/* Model Selection */}
          <div className="flex flex-col gap-2">
             <label className="text-sm font-medium text-white/80">OCR Model Strategy</label>
             <select 
                name="model"
                value={settings.model}
                onChange={handleChange}
                className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all text-white outline-none cursor-pointer appearance-none"
             >
                <option className="bg-reader-dark" value="gemini-2.5-flash">Gemini 2.5 Flash (Recommended)</option>
                <option className="bg-reader-dark" value="gemini-1.5-flash">Gemini 1.5 Flash</option>
                <option className="bg-reader-dark" value="gemini-2.5-pro">Gemini 2.5 Pro (Best Quality)</option>
                <option className="bg-reader-dark" value="gemini-1.5-pro">Gemini 1.5 Pro</option>
                <option className="bg-reader-dark" value="gemini-3-flash-preview">Gemini 3 Flash Preview (Experimental)</option>
             </select>
          </div>

          {/* TTS Speed */}
          <div className="flex flex-col gap-1">
             <div className="flex justify-between items-center bg-white/5 px-4 py-2 rounded-lg border border-white/10 mt-2">
                 <label className="text-sm font-medium text-white/80 flex items-center gap-2">
                    <span className="material-symbols-outlined text-xl">speed</span>
                    Speech Rate
                 </label>
                 <span className="text-xs font-mono font-bold text-primary bg-primary/10 px-2 py-1 rounded-md">{settings.ttsSpeed.toFixed(1)}x</span>
             </div>
             
             <div className="px-1 mt-3">
                 <input 
                    type="range"
                    name="ttsSpeed"
                    min="0.5"
                    max="2.0"
                    step="0.1"
                    value={settings.ttsSpeed}
                    onChange={handleChange}
                    className="w-full h-1 bg-white/20 rounded-full appearance-none cursor-pointer accent-primary [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-[0_0_10px_rgba(75,43,238,1)]"
                 />
                 <div className="flex justify-between text-[10px] uppercase tracking-wider font-bold text-white/30 mt-2">
                     <span>Slow</span>
                     <span>Normal</span>
                     <span>Fast</span>
                 </div>
             </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-white/10 bg-black/20 flex justify-end gap-3">
           <button 
             onClick={onClose}
             className="px-5 py-2.5 rounded-lg text-sm font-medium text-white/70 hover:bg-white/5 hover:text-white transition-all"
           >
             Cancel
           </button>
           <button 
             onClick={handleSave}
             className="px-6 py-2.5 rounded-lg text-sm font-medium bg-primary text-white hover:bg-primary/90 shadow-[0_4px_15px_rgba(75,43,238,0.4)] hover:shadow-[0_4px_25px_rgba(75,43,238,0.6)] transition-all flex items-center gap-2"
           >
             <span className="material-symbols-outlined text-lg">save</span>
             Save Settings
           </button>
        </div>
      </div>
    </div>
  );
};
