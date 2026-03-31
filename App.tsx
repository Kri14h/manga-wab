import React, { useState } from 'react';
import { Library } from './components/Library';
import { Reader } from './components/Reader';
import { processMangaFile } from './utils/zipUtils';
import { MangaItem, LibraryItem } from './types';

function App() {
  const [view, setView] = useState<'library' | 'reader'>('library');
  const [currentManga, setCurrentManga] = useState<MangaItem | null>(null);
  const [libraryItems, setLibraryItems] = useState<LibraryItem[]>([]);
  const [availableFiles, setAvailableFiles] = useState<Map<string, File>>(new Map());
  const [isLoading, setIsLoading] = useState(false);

  const handleUpload = (files: File[]) => {
    const validFiles = files.filter(f => f.name.match(/\.(zip|cbz)$/i));
    
    if (validFiles.length === 0) {
        alert("No valid .cbz or .zip files found in this selection.");
        return;
    }

    const nextFiles = new Map(availableFiles);
    const newItems: LibraryItem[] = [];

    for (const file of validFiles) {
        const id = crypto.randomUUID();
        nextFiles.set(id, file);
        newItems.push({
            id,
            title: file.name.replace(/\.(zip|cbz)$/i, '')
            // coverUrl is intentionally omitted to save memory
        });
    }

    setAvailableFiles(nextFiles);
    setLibraryItems(prev => [...prev, ...newItems]);
  };

  const handleSelectManga = async (id: string) => {
    // If it's the already loaded one, just open the reader instantly
    if (currentManga && currentManga.id === id) {
        setView('reader');
        return;
    }

    // Grab the local file reference
    const file = availableFiles.get(id);
    if (!file) {
        alert("File reference lost. Please re-select the folder to map the files again.");
        return;
    }

    setIsLoading(true);
    try {
        // Free up memory from previous manga viewing
        if (currentManga) {
            currentManga.pages.forEach(url => URL.revokeObjectURL(url));
        }

        const manga = await processMangaFile(file);
        manga.id = id; // Ensure the ID matches our map
        setCurrentManga(manga);
        setView('reader');
    } catch (error) {
        console.error("Failed to process local file", error);
        alert(`Failed to process local file.\n\nError details: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
        setIsLoading(false);
    }
  };

  const handleCloseReader = () => {
    setView('library');
  };

  if (view === 'reader' && currentManga) {
    return <Reader manga={currentManga} onClose={handleCloseReader} />;
  }

  return (
    <>
      <Library 
        items={libraryItems} 
        onSelect={handleSelectManga} 
        onUpload={handleUpload} 
      />
      
      {/* Loading Overlay */}
      {isLoading && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm">
           <div className="flex flex-col items-center gap-4">
              <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
              <p className="text-white font-medium animate-pulse">Processing Manga...</p>
           </div>
        </div>
      )}
    </>
  );
}

export default App;