
import React from 'react';
import ReactMarkdown from 'react-markdown';
import { Chapter } from '../types';
import { Download, ExternalLink, ChevronLeft, ChevronRight, RefreshCw, BookOpen } from 'lucide-react';

interface ReaderViewProps {
  chapter: Chapter | null;
  onNavigate: (direction: 'next' | 'prev') => void;
  hasPrev: boolean;
  hasNext: boolean;
  onRetry?: () => void;
}

const ReaderView: React.FC<ReaderViewProps> = ({ chapter, onNavigate, hasPrev, hasNext, onRetry }) => {
  if (!chapter) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500 p-10 bg-gray-900/50 rounded-xl border border-dashed border-gray-700">
        <div className="mb-4 p-4 bg-gray-800 rounded-full">
          <BookOpen className="w-8 h-8 text-blue-500" />
        </div>
        <p className="text-lg font-medium text-gray-300">Start Reading</p>
        <p className="text-sm opacity-60 max-w-sm text-center mt-2">
          Select a chapter from the list or use the <span className="text-yellow-500 font-bold">Download</span> button to grab 100 chapters at once.
        </p>
      </div>
    );
  }

  const handleDownload = () => {
    if (!chapter.content) return;
    const blob = new Blob([`# ${chapter.title}\n\n${chapter.content}`], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${chapter.number}-${chapter.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 shadow-2xl flex flex-col h-[calc(100vh-140px)]">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-800 bg-gray-900/95 backdrop-blur rounded-t-xl sticky top-0 z-10">
        <div className="flex flex-col min-w-0 mr-4">
          <span className="text-xs text-blue-400 font-bold tracking-wider uppercase">Chapter {chapter.number}</span>
          <h2 className="text-lg font-bold text-white truncate">{chapter.title}</h2>
        </div>
        
        <div className="flex items-center gap-2 shrink-0">
           {chapter.sourceUrl && (
             <a 
              href={chapter.sourceUrl} 
              target="_blank" 
              rel="noreferrer"
              title="View Source"
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
             >
               <ExternalLink className="w-5 h-5" />
             </a>
           )}
          <button
            onClick={handleDownload}
            disabled={!chapter.content}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-50"
            title="Download Chapter"
          >
            <Download className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 md:p-12 scroll-smooth">
        <div className="max-w-3xl mx-auto prose-content font-serif text-lg leading-relaxed">
          {chapter.status === 'loading' ? (
            <div className="space-y-4 animate-pulse">
              <div className="h-4 bg-gray-800 rounded w-3/4"></div>
              <div className="h-4 bg-gray-800 rounded w-full"></div>
              <div className="h-4 bg-gray-800 rounded w-5/6"></div>
              <div className="h-4 bg-gray-800 rounded w-full"></div>
              <div className="h-32 bg-gray-800 rounded w-full mt-8"></div>
              <p className="text-center text-sm text-blue-400/50 mt-4">Searching novel databases...</p>
            </div>
          ) : chapter.status === 'error' ? (
            <div className="flex flex-col items-center justify-center p-8 bg-red-900/10 border border-red-900/50 rounded-lg text-center mt-10">
              <div className="bg-red-900/20 p-3 rounded-full mb-3">
                 <RefreshCw className="w-6 h-6 text-red-400" />
              </div>
              <p className="text-red-300 font-medium mb-2">Content Unavailable</p>
              <p className="text-red-400/70 text-sm mb-6 max-w-md mx-auto">
                {chapter.errorMessage || "We couldn't retrieve the text for this chapter. The source might be down or protected."}
              </p>
              {onRetry && (
                <button 
                  onClick={onRetry}
                  className="px-5 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors font-medium text-sm"
                >
                  Try Again
                </button>
              )}
            </div>
          ) : (
            <ReactMarkdown>{chapter.content || ''}</ReactMarkdown>
          )}
        </div>
      </div>

      {/* Footer Nav */}
      <div className="p-4 border-t border-gray-800 bg-gray-900 rounded-b-xl flex justify-between items-center">
        <button
          onClick={() => onNavigate('prev')}
          disabled={!hasPrev}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-300 bg-gray-800 rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft className="w-4 h-4" /> Previous
        </button>
        <button
          onClick={() => onNavigate('next')}
          disabled={!hasNext}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-300 bg-gray-800 rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Next <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default ReaderView;
