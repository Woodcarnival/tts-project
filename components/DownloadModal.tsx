
import React from 'react';
import { X, Check, Download, Loader2, AlertTriangle, FileText } from 'lucide-react';
import { Chapter } from '../types';

interface DownloadModalProps {
  isOpen: boolean;
  onClose: () => void;
  totalChapters: number;
  chapters: Chapter[];
  onDownloadRange: (start: number, end: number) => void;
  isDownloading: boolean;
  downloadProgress: { current: number; total: number } | null;
}

const DownloadModal: React.FC<DownloadModalProps> = ({ 
  isOpen, 
  onClose, 
  totalChapters, 
  chapters, 
  onDownloadRange,
  isDownloading,
  downloadProgress
}) => {
  if (!isOpen) return null;

  // Calculate ranges (1-100, 101-200, etc.)
  const ranges = [];
  const rangeSize = 100;
  const maxChapters = Math.max(totalChapters, chapters.length);
  
  for (let i = 1; i <= maxChapters; i += rangeSize) {
    const end = Math.min(i + rangeSize - 1, maxChapters);
    ranges.push({ start: i, end });
  }

  const getRangeStatus = (start: number, end: number) => {
    // Check chapters in this range
    const rangeChapters = chapters.filter(c => c.number >= start && c.number <= end);
    
    // If we haven't even generated objects for this range yet (means user hasn't scrolled or fetched)
    // We treat missing objects as "pending"
    
    if (rangeChapters.length === 0) return 'empty';

    const allCompleted = rangeChapters.every(c => c.status === 'completed');
    const hasError = rangeChapters.some(c => c.status === 'error');
    const isLoading = rangeChapters.some(c => c.status === 'loading');

    // If we are currently downloading this specific range (heuristic)
    if (isDownloading && isLoading) return 'downloading';
    if (allCompleted && rangeChapters.length === (end - start + 1)) return 'completed';
    if (hasError) return 'error';
    return 'partial';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-gray-900 border border-gray-800 rounded-xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-800 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Download className="w-5 h-5 text-yellow-500" />
              Batch Download
            </h2>
            <p className="text-sm text-gray-400 mt-1">Download 100 chapters at once into a single file.</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-800 rounded-full transition-colors">
            <X className="w-6 h-6 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-gray-700">
          {isDownloading && downloadProgress && (
            <div className="mb-6 p-4 bg-blue-900/20 border border-blue-900/50 rounded-lg flex items-center justify-between">
               <div className="flex items-center gap-3">
                 <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
                 <div>
                   <p className="text-blue-200 font-medium">Downloading Chapters...</p>
                   <p className="text-blue-400/70 text-xs">Do not close this window</p>
                 </div>
               </div>
               <div className="text-right">
                  <span className="text-2xl font-bold text-blue-100">{downloadProgress.current}</span>
                  <span className="text-blue-500 text-sm"> / {downloadProgress.total}</span>
               </div>
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {ranges.map(({ start, end }) => {
              const status = getRangeStatus(start, end);
              
              return (
                <button
                  key={`${start}-${end}`}
                  onClick={() => !isDownloading && onDownloadRange(start, end)}
                  disabled={isDownloading && status !== 'downloading'}
                  className={`
                    relative h-24 rounded-lg border flex flex-col items-center justify-center transition-all duration-200
                    ${status === 'completed' 
                      ? 'bg-green-900/20 border-green-800 text-green-100 hover:bg-green-900/30' 
                      : status === 'downloading'
                      ? 'bg-blue-900/20 border-blue-500/50 text-blue-100 ring-1 ring-blue-500'
                      : status === 'error'
                      ? 'bg-red-900/20 border-red-800 text-red-100 hover:bg-red-900/30'
                      : 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-750 hover:border-gray-500'
                    }
                    ${isDownloading && status !== 'downloading' ? 'opacity-50 cursor-not-allowed' : ''}
                  `}
                >
                  <span className="text-lg font-bold">{start}-{end}</span>
                  
                  <div className="absolute top-2 right-2">
                    {status === 'completed' && <Check className="w-4 h-4 text-green-400" />}
                    {status === 'downloading' && <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />}
                    {status === 'error' && <AlertTriangle className="w-4 h-4 text-red-400" />}
                  </div>

                  {status === 'completed' && (
                    <span className="text-xs text-green-400/80 mt-1 font-medium">Ready</span>
                  )}
                  {status === 'error' && (
                    <span className="text-xs text-red-400/80 mt-1 font-medium">Retry</span>
                  )}
                  {status === 'empty' || status === 'partial' ? (
                     <div className="flex items-center gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Download className="w-3 h-3" />
                        <span className="text-xs">Download</span>
                     </div>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DownloadModal;
