import React, { useRef, useState } from 'react';
import { LibraryItem } from '../types';
import { SettingsModal } from './SettingsModal';

interface LibraryProps {
  items: LibraryItem[];
  onSelect: (id: string) => void;
  onUpload: (files: File[]) => void;
}

export const Library: React.FC<LibraryProps> = ({ items, onSelect, onUpload }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const [showSettings, setShowSettings] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onUpload(Array.from(e.target.files));
      // Reset value so the exact same folder/file can be re-selected later
      e.target.value = '';
    }
  };

  return (
    <div className="min-h-screen bg-background-dark text-white font-display">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-50 flex items-center justify-between px-6 py-6 bg-background-dark/80 backdrop-blur-md border-b border-white/5">
        <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-[#a78bfa] to-[#4b2bee] bg-clip-text text-transparent">
          Library
        </h1>
        <button 
          onClick={() => setShowSettings(true)}
          title="App Settings"
          className="size-10 flex items-center justify-center rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition-all text-white/80 hover:text-white"
        >
           <span className="material-symbols-outlined text-xl">settings</span>
        </button>
      </header>

      {/* Manga Grid Section */}
      <main className="px-4 pb-24 pt-4">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[60vh] text-center text-white/50">
             <span className="material-symbols-outlined text-7xl mb-6 text-white/10">library_books</span>
             <h2 className="text-xl font-medium text-white mb-2">Your library is empty</h2>
             <p className="text-sm max-w-md mx-auto mb-8">Upload a local .cbz or .zip file to start reading your manga collection.</p>
             <div className="flex flex-col sm:flex-row gap-4 mb-8">
                 <button
                    onClick={() => folderInputRef.current?.click()}
                    className="px-8 py-3 bg-primary hover:bg-primary/90 text-white rounded-full font-medium transition-all shadow-[0_0_20px_rgba(75,43,238,0.3)] hover:shadow-[0_0_25px_rgba(75,43,238,0.5)] active:scale-95 flex items-center justify-center gap-2"
                 >
                    <span className="material-symbols-outlined">folder_open</span>
                    Select Folder (PC)
                 </button>
                 <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-8 py-3 bg-white/10 hover:bg-white/20 text-white border border-white/10 rounded-full font-medium transition-all active:scale-95 flex items-center justify-center gap-2"
                 >
                    <span className="material-symbols-outlined">library_add</span>
                    Select Files (Mobile)
                 </button>
             </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {items.map((item) => (
              <div 
                key={item.id}
                onClick={() => onSelect(item.id)}
                className="group relative aspect-[2/3] overflow-hidden rounded-lg bg-primary/10 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] cursor-pointer ring-1 ring-white/10 hover:ring-primary/50"
              >
                <div 
                  className={`h-full w-full bg-cover bg-center transition-transform duration-500 group-hover:scale-110 flex items-center justify-center ${!item.coverUrl ? 'bg-gradient-to-br from-gray-800 to-gray-900' : ''}`} 
                  style={item.coverUrl ? { backgroundImage: `url('${item.coverUrl}')` } : {}}
                >
                  {!item.coverUrl && (
                     <div className="text-center px-4 w-full h-full flex flex-col items-center justify-center gap-3">
                         <span className="material-symbols-outlined text-5xl text-white/20">menu_book</span>
                         <h3 className="text-lg font-bold text-white/80 line-clamp-3 leading-snug">{item.title}</h3>
                         <span className="text-[10px] uppercase tracking-wider font-bold text-primary/80 bg-primary/10 px-2 py-1 rounded">Local File</span>
                     </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-4">
                      {item.coverUrl && <p className="text-sm font-medium text-white line-clamp-2">{item.title}</p>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Hidden Inputs */}
      <input 
        type="file" 
        multiple
        ref={fileInputRef} 
        onChange={handleFileChange} 
        accept=".zip,.cbz" 
        className="hidden" 
      />
      <input 
        type="file" 
        ref={folderInputRef} 
        onChange={handleFileChange} 
        //@ts-ignore - webkitdirectory is non-standard but works in all modern Chromium browsers
        webkitdirectory=""
        directory=""
        className="hidden" 
      />

      {/* Upload Buttons (FAB) - Uses group to show both options if items exist */}
      {items.length > 0 && (
         <div className="fixed bottom-8 right-8 z-50 flex flex-col gap-3">
            <button 
              onClick={() => folderInputRef.current?.click()}
              title="Add Folder"
              className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-md border border-white/20 transition-transform hover:scale-105 active:scale-95 hover:bg-white/20 shadow-lg"
            >
              <span className="material-symbols-outlined text-2xl">create_new_folder</span>
            </button>
            <button 
              onClick={() => fileInputRef.current?.click()}
              title="Add Files"
              className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-white shadow-[0_0_15px_rgba(75,43,238,0.4)] transition-transform hover:scale-105 active:scale-95 hover:bg-primary/90"
            >
              <span className="material-symbols-outlined text-3xl">add</span>
            </button>
         </div>
      )}
      
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </div>
  );
};