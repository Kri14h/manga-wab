import React, { useState, useEffect, useCallback, useRef } from 'react';
import { MangaItem, OCRCache, SpeechBubble } from '../types';
import { analyzeMangaPages, blobUrlToBase64 } from '../utils/ocr';
import { getSettings } from './SettingsModal';

interface ReaderProps {
  manga: MangaItem;
  onClose: () => void;
}

const BATCH_SIZE = 3;

export const Reader: React.FC<ReaderProps> = ({ manga, onClose }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [isFullScreen, setIsFullScreen] = useState(false);
  
  // Analysis State
  const [analysisCache, setAnalysisCache] = useState<OCRCache>({});
  const [isAnalysisEnabled, setIsAnalysisEnabled] = useState(false);
  const processingQueue = useRef<Set<number>>(new Set());
  
  // TTS State
  const synth = useRef<SpeechSynthesis>(window.speechSynthesis);
  const [activeBubbleIndex, setActiveBubbleIndex] = useState<number | null>(null);
  const lastSpokenPageIndexRef = useRef<number | null>(null);

  // --- Analysis Logic ---

  const processBatch = useCallback(async (batchIndex: number) => {
    // 1. Check if batch is already processing
    if (processingQueue.current.has(batchIndex)) return;

    // 2. Check if all pages in this batch are already complete
    const startPage = batchIndex * BATCH_SIZE;
    const endPage = Math.min(startPage + BATCH_SIZE, manga.pages.length);
    
    let allLoaded = true;
    for (let i = startPage; i < endPage; i++) {
        if (analysisCache[i]?.status !== 'complete') {
            allLoaded = false;
            break;
        }
    }
    if (allLoaded) return;

    // 3. Lock batch
    processingQueue.current.add(batchIndex);

    // 4. Set Loading State for all pages in batch
    setAnalysisCache(prev => {
        const nextState = { ...prev };
        for (let i = startPage; i < endPage; i++) {
            if (nextState[i]?.status !== 'complete') {
                nextState[i] = { bubbles: [], status: 'loading' };
            }
        }
        return nextState;
    });

    try {
      // 5. Prepare images
      const imagePromises = [];
      for (let i = startPage; i < endPage; i++) {
          imagePromises.push(blobUrlToBase64(manga.pages[i]));
      }
      const base64Images = await Promise.all(imagePromises);

      // 6. Call API (Batch)
      const batchResults = await analyzeMangaPages(base64Images);
      
      // 7. Update Cache
      setAnalysisCache(prev => {
        const nextState = { ...prev };
        batchResults.forEach((bubbles, relativeIndex) => {
            const absoluteIndex = startPage + relativeIndex;
            
            // Sort bubbles
            const sortedBubbles = [...(bubbles || [])].sort((a, b) => {
                const yDiff = a.box_2d[0] - b.box_2d[0];
                if (Math.abs(yDiff) > 50) return yDiff;
                return b.box_2d[1] - a.box_2d[1];
            });

            nextState[absoluteIndex] = { bubbles: sortedBubbles, status: 'complete' };
        });
        return nextState;
      });
    } catch (err: any) {
      console.error("Batch analysis failed", err);
      let errorMsg = err?.message || String(err);
      if (typeof err === 'object' && err !== null && err.error) {
        errorMsg = err.error.message || JSON.stringify(err.error);
      }
      
      setAnalysisCache(prev => {
        const nextState = { ...prev };
        for (let i = startPage; i < endPage; i++) {
             nextState[i] = { bubbles: [], status: 'error', errorMsg };
        }
        return nextState;
      });
    } finally {
      processingQueue.current.delete(batchIndex);
    }
  }, [manga.pages, analysisCache]);

  // Trigger Strategy
  useEffect(() => {
    if (!isAnalysisEnabled) return;

    const currentBatch = Math.floor(currentIndex / BATCH_SIZE);
    
    // Always ensure current batch is processed
    processBatch(currentBatch);

    // Pre-fetch next batch ONLY when user is exactly on the last page of the current batch
    if (currentIndex % BATCH_SIZE === BATCH_SIZE - 1) {
        const nextBatch = currentBatch + 1;
        if (nextBatch * BATCH_SIZE < manga.pages.length) {
            processBatch(nextBatch);
        }
    }
  }, [currentIndex, isAnalysisEnabled, processBatch, manga.pages.length]);

  // --- TTS Logic ---

  // Separate effect to handle Page Turn or Disable
  useEffect(() => {
    if (!isAnalysisEnabled) {
      synth.current.cancel();
      setActiveBubbleIndex(null);
      lastSpokenPageIndexRef.current = null;
    }
  }, [isAnalysisEnabled]);

  // Effect to queue speech when data becomes available
  useEffect(() => {
    if (!isAnalysisEnabled) return;

    const currentPageData = analysisCache[currentIndex];

    // Check if we are already speaking this page content
    if (lastSpokenPageIndexRef.current === currentIndex && synth.current.speaking) {
        return; 
    }

    // Cancel previous page speech if we moved
    if (lastSpokenPageIndexRef.current !== currentIndex) {
        synth.current.cancel();
        setActiveBubbleIndex(null);
    }

    if (currentPageData?.status === 'complete' && currentPageData.bubbles.length > 0) {
        lastSpokenPageIndexRef.current = currentIndex;
        
        // Queue bubbles one by one
        const settings = getSettings();
        
        currentPageData.bubbles.forEach((bubble, i) => {
            const utterance = new SpeechSynthesisUtterance(bubble.text);
            const voices = synth.current.getVoices();
            const voice = voices.find(v => v.name.includes('Google US English')) || 
                          voices.find(v => v.lang.startsWith('en'));
            if (voice) utterance.voice = voice;
            utterance.rate = settings.ttsSpeed || 1.0;

            utterance.onstart = () => {
                setActiveBubbleIndex(i);
            };

            utterance.onend = () => {
                // If this was the last bubble, clear highlight
                if (i === currentPageData.bubbles.length - 1) {
                    setActiveBubbleIndex(null);
                }
            };
            
            utterance.onerror = () => {
                if (i === currentPageData.bubbles.length - 1) {
                    setActiveBubbleIndex(null);
                }
            };

            synth.current.speak(utterance);
        });
    }
  }, [currentIndex, isAnalysisEnabled, analysisCache]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      synth.current.cancel();
    };
  }, []);

  // --- Navigation & UI ---

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') {
        setCurrentIndex((prev) => Math.min(prev + 1, manga.pages.length - 1));
      } else if (e.key === 'ArrowLeft') {
        setCurrentIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === 'Escape') {
        if (document.fullscreenElement) {
           document.exitFullscreen();
        } else {
           onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [manga.pages.length, onClose]);

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullScreen(true);
    } else {
      document.exitFullscreen();
      setIsFullScreen(false);
    }
  };

  const handleNext = () => setCurrentIndex((prev) => Math.min(prev + 1, manga.pages.length - 1));
  const handlePrev = () => setCurrentIndex((prev) => Math.max(prev - 1, 0));
  const toggleControls = () => setShowControls(!showControls);

  const currentAnalysis = analysisCache[currentIndex];
  const isLoading = currentAnalysis?.status === 'loading';

  return (
    <div className="relative h-screen w-full flex items-center justify-center bg-black overflow-hidden select-none font-sans">
      
      {/* Container for Image + Overlays */}
      <div 
        className="relative h-full w-full max-w-5xl flex items-center justify-center"
        onClick={toggleControls}
      >
        <img 
            src={manga.pages[currentIndex]} 
            className="max-h-full max-w-full object-contain shadow-2xl"
            alt={`Page ${currentIndex + 1}`}
        />

        {/* Bounding Box Overlays */}
        {isAnalysisEnabled && currentAnalysis?.status === 'complete' && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <OverlayLayer 
                    bubbles={currentAnalysis.bubbles} 
                    activeBubbleIndex={activeBubbleIndex}
                />
            </div>
        )}

        {/* Error Overlay */}
        {isAnalysisEnabled && currentAnalysis?.status === 'error' && (
            <div className="absolute top-10 left-1/2 -translate-x-1/2 z-40 w-[90%] max-w-lg bg-red-900/90 backdrop-blur-md rounded-2xl border border-red-500/50 p-6 shadow-[0_10px_40px_rgba(220,38,38,0.3)] flex flex-col gap-3 transition-all duration-300">
                <div className="flex items-center gap-3 text-red-100">
                    <span className="material-symbols-outlined text-3xl">error</span>
                    <h3 className="text-lg font-bold">Analysis Failed</h3>
                </div>
                <p className="text-sm text-red-200/90 leading-relaxed font-mono whitespace-pre-wrap">
                    {currentAnalysis.errorMsg || "An unknown error prevented extracting text from this page. This is usually caused by API limits."}
                </p>
                <div className="mt-2 flex justify-end">
                    <button 
                      onClick={(e) => { 
                          e.stopPropagation(); 
                          const currentBatch = Math.floor(currentIndex / BATCH_SIZE);
                          processBatch(currentBatch); 
                      }}
                      className="py-2 px-5 bg-red-800/80 hover:bg-red-700 rounded-lg text-white font-medium text-sm transition-colors border border-red-500/30 shadow-lg flex items-center gap-2"
                    >
                      <span className="material-symbols-outlined text-sm">refresh</span>
                      Try Again
                    </button>
                </div>
            </div>
        )}
      </div>

      {/* Loading Indicator */}
      {isAnalysisEnabled && isLoading && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 flex flex-col items-center gap-2">
            <div className="size-12 rounded-full border-4 border-primary border-t-transparent animate-spin drop-shadow-lg"></div>
            <div className="bg-black/60 backdrop-blur-md px-4 py-1 rounded-full text-white text-xs font-bold uppercase tracking-wider">
                Analyzing Batch...
            </div>
        </div>
      )}

      {/* Top Overlay */}
      <div className={`absolute top-0 left-0 right-0 p-6 flex justify-between items-start transition-opacity duration-300 z-30 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <button 
          onClick={onClose}
          className="size-12 flex items-center justify-center rounded-lg bg-reader-dark/40 backdrop-blur-md border border-white/10 hover:bg-reader-dark/60 transition-colors text-white"
        >
          <span className="material-symbols-outlined text-2xl">home</span>
        </button>

        <button 
          onClick={toggleFullScreen}
          className="size-12 flex items-center justify-center rounded-lg bg-reader-dark/40 backdrop-blur-md border border-white/10 hover:bg-reader-dark/60 transition-colors text-white"
        >
          <span className="material-symbols-outlined text-2xl">
            {isFullScreen ? 'close_fullscreen' : 'fullscreen'}
          </span>
        </button>
      </div>

      {/* Bottom Controls */}
      <div className={`fixed bottom-10 left-0 right-0 px-6 flex flex-col items-center gap-6 transition-all duration-300 z-30 ${showControls ? 'translate-y-0 opacity-100' : 'translate-y-20 opacity-0 pointer-events-none'}`}>
        
        {/* Slider */}
        <div className="w-full max-w-xl flex items-center gap-4">
            <span className="text-xs text-white/50 w-8 text-right">{currentIndex + 1}</span>
            <input 
              type="range" 
              min="0" 
              max={manga.pages.length - 1} 
              value={currentIndex} 
              onChange={(e) => setCurrentIndex(Number(e.target.value))}
              className="flex-1 h-1 bg-white/10 rounded-full appearance-none cursor-pointer accent-white transition-all hover:bg-white/20 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
            />
            <span className="text-xs text-white/50 w-8">{manga.pages.length}</span>
        </div>

        {/* Main Buttons */}
        <div className="flex items-center gap-4 p-2 rounded-xl bg-reader-dark/60 backdrop-blur-xl border border-white/10 shadow-2xl">
          <button 
            onClick={handlePrev}
            disabled={currentIndex === 0}
            className="size-14 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <span className="material-symbols-outlined text-white text-3xl">chevron_left</span>
          </button>

          {/* Central Action: Analysis Toggle */}
          <div className="relative group">
             <button 
                 onClick={() => setIsAnalysisEnabled(!isAnalysisEnabled)}
                 className={`size-16 flex items-center justify-center rounded-lg transition-all border ${isAnalysisEnabled ? 'bg-primary text-white border-primary shadow-[0_0_20px_rgba(75,43,238,0.5)]' : 'bg-white/5 text-white/80 border-white/5 hover:bg-white/10'}`}
                 title="Toggle AI Analysis"
             >
                 <span className="material-symbols-outlined text-3xl">psychology</span>
             </button>
          </div>

          <button 
            onClick={handleNext}
            disabled={currentIndex === manga.pages.length - 1}
            className="size-14 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <span className="material-symbols-outlined text-white text-3xl">chevron_right</span>
          </button>
        </div>
      </div>
    </div>
  );
};

// Helper component to handle positioning
const OverlayLayer: React.FC<{ bubbles: SpeechBubble[], activeBubbleIndex: number | null }> = ({ bubbles, activeBubbleIndex }) => {
    const [imgRect, setImgRect] = useState<{width: number, height: number} | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const updateRect = () => {
            if (containerRef.current) {
                const img = containerRef.current.parentElement?.querySelector('img');
                if (img) {
                    setImgRect({
                        width: img.offsetWidth,
                        height: img.offsetHeight
                    });
                }
            }
        };
        updateRect();
        window.addEventListener('resize', updateRect);
        const interval = setInterval(updateRect, 500);
        return () => {
            window.removeEventListener('resize', updateRect);
            clearInterval(interval);
        }
    }, []);

    if (!imgRect) return <div ref={containerRef} />;

    return (
        <div 
            ref={containerRef}
            style={{ 
                width: imgRect.width, 
                height: imgRect.height, 
                position: 'absolute' 
            }}
        >
            {bubbles.map((bubble, i) => {
                const [ymin, xmin, ymax, xmax] = bubble.box_2d;
                const top = (ymin / 1000) * 100;
                const left = (xmin / 1000) * 100;
                const height = ((ymax - ymin) / 1000) * 100;
                const width = ((xmax - xmin) / 1000) * 100;

                const isActive = i === activeBubbleIndex;

                return (
                    <div
                        key={i}
                        className={`absolute transition-all duration-300 group ${isActive ? 'border-4 border-green-400 bg-green-400/20 z-50 shadow-[0_0_15px_rgba(74,222,128,0.5)]' : 'border-2 border-red-500 bg-red-500/10 hover:bg-red-500/20'}`}
                        style={{
                            top: `${top}%`,
                            left: `${left}%`,
                            width: `${width}%`,
                            height: `${height}%`,
                        }}
                        title={bubble.text}
                    >
                        {/* Number Badge (Hide if active to reduce clutter, or change color) */}
                        <div className={`absolute -top-3 -left-3 size-6 rounded-full text-white text-xs font-bold flex items-center justify-center shadow-md z-10 ${isActive ? 'bg-green-600 scale-110' : 'bg-red-600'}`}>
                            {i + 1}
                        </div>
                        
                        {/* Tooltip */}
                        <div className={`opacity-0 group-hover:opacity-100 absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-black/90 text-white text-xs p-2 rounded w-48 pointer-events-none transition-opacity z-20 ${isActive ? 'hidden' : ''}`}>
                            {bubble.text}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};