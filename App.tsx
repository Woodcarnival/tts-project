
import React, { useState, useEffect, useRef } from 'react';
import { Search, Book, Menu, XCircle, AlertTriangle, FileDown } from 'lucide-react';
import { fetchNovelMetadata, fetchChapterContent } from './services/geminiService';
import { Chapter, NovelState } from './types';
import ChapterListItem from './components/ChapterListItem';
import ReaderView from './components/ReaderView';
import DownloadModal from './components/DownloadModal';

const App: React.FC = () => {
  const [searchInput, setSearchInput] = useState('');
  const [state, setState] = useState<NovelState>({
    title: '',
    author: '',
    totalChaptersEstimate: 0,
    chapters: [],
    isFetchingList: false,
    currentChapterId: null,
  });
  
  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<{ current: number; total: number } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const abortFetchRef = useRef(false);

  // Auto-load selected chapter
  useEffect(() => {
    if (state.currentChapterId) {
      const chapter = state.chapters.find(c => c.id === state.currentChapterId);
      if (chapter && !chapter.content && chapter.status !== 'loading' && chapter.status !== 'error') {
        loadChapterContent(chapter);
      }
    }
  }, [state.currentChapterId]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const trimmedInput = searchInput.trim();
    if (!trimmedInput) {
      setErrorMsg("Please enter a novel name.");
      return;
    }
    if (trimmedInput.length < 2) {
      setErrorMsg("Novel name is too short. Please enter a valid name.");
      return;
    }

    setState(prev => ({ 
      ...prev, 
      isFetchingList: true, 
      title: trimmedInput, 
      author: '',
      chapters: [], 
      currentChapterId: null 
    }));
    setErrorMsg(null);
    abortFetchRef.current = false;

    try {
      const metadata = await fetchNovelMetadata(trimmedInput);
      
      if (!metadata.exists) {
        throw new Error("Novel not found on supported sites (readernovel, lightnovelpub, novelbin).");
      }

      const totalChapters = metadata.totalChapters || 100;
      const newChapters: Chapter[] = Array.from({ length: totalChapters }, (_, i) => ({
        id: crypto.randomUUID(),
        number: i + 1,
        title: i < metadata.chapterTitles.length ? metadata.chapterTitles[i] : `Chapter ${i + 1}`,
        content: null,
        status: 'pending'
      }));

      setState(prev => ({
        ...prev,
        title: metadata.title,
        author: metadata.author,
        totalChaptersEstimate: totalChapters,
        isFetchingList: false,
        chapters: newChapters,
        currentChapterId: newChapters.length > 0 ? newChapters[0].id : null
      }));
    } catch (error: any) {
      console.error(error);
      setErrorMsg(error.message || "Failed to find novel. Network error or service unavailable.");
      setState(prev => ({ ...prev, isFetchingList: false }));
    }
  };

  const loadChapterContent = async (chapter: Chapter) => {
    // Optimistically update status
    setState(prev => ({
      ...prev,
      chapters: prev.chapters.map(c => 
        c.id === chapter.id ? { ...c, status: 'loading', errorMessage: undefined } : c
      )
    }));

    try {
      // Pass the current placeholder title so the AI knows what to look for roughly
      const result = await fetchChapterContent(state.title, chapter.number, chapter.title);
      
      setState(prev => ({
        ...prev,
        chapters: prev.chapters.map(c => 
          c.id === chapter.id ? { 
            ...c, 
            content: result.content, 
            title: result.title, // Update with real title found in content
            status: 'completed', 
            sourceUrl: result.sourceUrl 
          } : c
        )
      }));
      return true;
    } catch (error: any) {
      console.error(`Failed to load Ch ${chapter.number}:`, error);
      setState(prev => ({
        ...prev,
        chapters: prev.chapters.map(c => 
          c.id === chapter.id ? { ...c, status: 'error', errorMessage: error.message } : c
        )
      }));
      return false;
    }
  };

  const handleDownloadRange = async (start: number, end: number) => {
    abortFetchRef.current = false;
    
    // 1. Identify chapters in range
    const targetIndices = state.chapters
      .map((c, idx) => ({ c, idx }))
      .filter(({ c }) => c.number >= start && c.number <= end);
    
    if (targetIndices.length === 0) return;

    setDownloadProgress({ current: 0, total: targetIndices.length });

    // 2. Fetch missing content sequentially to avoid rate limits
    // We filter for ones that need fetching (pending or error)
    const toFetch = targetIndices.filter(({ c }) => !c.content);
    
    let completedCount = targetIndices.length - toFetch.length;
    setDownloadProgress({ current: completedCount, total: targetIndices.length });

    for (const { c } of toFetch) {
      if (abortFetchRef.current) break;
      
      const success = await loadChapterContent(c);
      if (success) completedCount++;
      setDownloadProgress({ current: completedCount, total: targetIndices.length });
      
      // Increased delay to 2000ms to be safe with rate limits
      await new Promise(r => setTimeout(r, 2000));
    }

    // 3. Compile and Download
    if (!abortFetchRef.current) {
        generateRangeDownload(start, end);
    }
    
    setDownloadProgress(null);
  };

  const generateRangeDownload = (start: number, end: number) => {
    const rangeChapters = state.chapters.filter(c => c.number >= start && c.number <= end);
    const validChapters = rangeChapters.filter(c => c.content); // Only include ones with content

    if (validChapters.length === 0) {
        setErrorMsg(`Failed to download any chapters in range ${start}-${end}.`);
        return;
    }

    let fullText = `# ${state.title}\n`;
    if (state.author) fullText += `**Author:** ${state.author}\n`;
    fullText += `**Chapters:** ${start} - ${end}\n`;
    fullText += `**Generated by:** NovelWeaver AI\n\n***\n\n`;

    // Arrange strictly by chapter number
    validChapters.sort((a, b) => a.number - b.number).forEach(c => {
      fullText += `## ${c.title}\n\n${c.content}\n\n***\n\n`;
    });

    const blob = new Blob([fullText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${state.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${start}-${end}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const navigateChapter = (direction: 'next' | 'prev') => {
    const currentIndex = state.chapters.findIndex(c => c.id === state.currentChapterId);
    if (currentIndex === -1) return;

    const newIndex = direction === 'next' ? currentIndex + 1 : currentIndex - 1;
    if (newIndex >= 0 && newIndex < state.chapters.length) {
      setState(prev => ({ ...prev, currentChapterId: prev.chapters[newIndex].id }));
    }
  };

  const activeChapter = state.chapters.find(c => c.id === state.currentChapterId) || null;
  const activeIndex = state.chapters.findIndex(c => c.id === state.currentChapterId);

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col overflow-hidden">
      {/* Navbar */}
      <header className="h-16 border-b border-gray-800 bg-gray-950 flex items-center px-4 md:px-6 justify-between shrink-0 z-20">
        <div className="flex items-center gap-2 md:gap-3">
          <Book className="w-6 h-6 text-blue-500" />
          <h1 className="text-lg md:text-xl font-bold font-serif tracking-tight hidden sm:block">NovelWeaver AI</h1>
        </div>
        
        <form onSubmit={handleSearch} className="flex-1 max-w-lg mx-4">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 group-focus-within:text-blue-400 transition-colors" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Enter webnovel name..."
              className="w-full bg-gray-900 border border-gray-800 rounded-full py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder-gray-600"
            />
          </div>
        </form>

        <div className="flex items-center gap-3">
           {state.chapters.length > 0 && (
             <button 
                onClick={() => setIsDownloadModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold bg-yellow-600 hover:bg-yellow-500 text-white transition-colors shadow-lg shadow-yellow-900/20"
             >
               <FileDown className="w-4 h-4" />
               <span className="hidden md:inline">Download</span>
             </button>
           )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <div className="w-72 md:w-80 bg-gray-900 border-r border-gray-800 flex flex-col shrink-0 hidden md:flex">
          <div className="p-4 border-b border-gray-800 bg-gray-900 sticky top-0 z-10">
             <div className="flex justify-between items-center mb-1">
               <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Chapter List</h2>
             </div>
             {state.author && <p className="text-xs text-gray-500 truncate mb-2">By {state.author}</p>}
          </div>
          
          <div className="flex-1 overflow-y-auto p-2 space-y-1 scrollbar-thin">
             {state.isFetchingList ? (
               <div className="space-y-3 p-2">
                 {[1, 2, 3, 4, 5].map(i => (
                   <div key={i} className="h-12 bg-gray-800 animate-pulse rounded-lg"></div>
                 ))}
               </div>
             ) : state.chapters.length > 0 ? (
               state.chapters.map((chapter) => (
                 <ChapterListItem
                   key={chapter.id}
                   chapter={chapter}
                   isActive={state.currentChapterId === chapter.id}
                   onClick={() => setState(prev => ({ ...prev, currentChapterId: chapter.id }))}
                 />
               ))
             ) : (
                <div className="flex flex-col items-center justify-center h-40 text-gray-600 text-center px-4 mt-10">
                  <Book className="w-8 h-8 mb-2 opacity-30" />
                  <p className="text-sm">Enter a novel name above to begin.</p>
                </div>
             )}
          </div>
        </div>

        {/* Reader Area */}
        <div className="flex-1 bg-gray-950 p-4 md:p-8 overflow-hidden flex flex-col relative">
          {errorMsg && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-red-500/90 backdrop-blur text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-3 border border-red-400 animate-in slide-in-from-top-2">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <span className="font-medium text-sm">{errorMsg}</span>
              <button 
                onClick={() => setErrorMsg(null)} 
                className="ml-2 hover:bg-white/20 rounded-full p-1"
              >
                <XCircle className="w-4 h-4" />
              </button>
            </div>
          )}
          
          <ReaderView 
            chapter={activeChapter}
            onNavigate={navigateChapter}
            hasPrev={activeIndex > 0}
            hasNext={activeIndex !== -1 && activeIndex < state.chapters.length - 1}
            onRetry={activeChapter?.status === 'error' ? () => loadChapterContent(activeChapter!) : undefined}
          />
        </div>
      </main>

      {/* Download Modal */}
      <DownloadModal 
        isOpen={isDownloadModalOpen}
        onClose={() => {
           // Allow closing and cancelling download
           if (downloadProgress) {
             abortFetchRef.current = true;
           }
           setIsDownloadModalOpen(false);
           setDownloadProgress(null);
        }}
        totalChapters={state.totalChaptersEstimate}
        chapters={state.chapters}
        onDownloadRange={handleDownloadRange}
        isDownloading={!!downloadProgress}
        downloadProgress={downloadProgress}
      />
    </div>
  );
};

export default App;
