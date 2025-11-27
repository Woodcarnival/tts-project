import React from 'react';
import { Chapter } from '../types';
import { CheckCircle2, Circle, Loader2, AlertCircle, FileText } from 'lucide-react';

interface ChapterListItemProps {
  chapter: Chapter;
  isActive: boolean;
  onClick: () => void;
}

const ChapterListItem: React.FC<ChapterListItemProps> = ({ chapter, isActive, onClick }) => {
  const getStatusIcon = () => {
    switch (chapter.status) {
      case 'completed':
        return <CheckCircle2 className="w-4 h-4 text-green-400" />;
      case 'loading':
        return <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-400" />;
      default:
        return <Circle className="w-4 h-4 text-gray-600" />;
    }
  };

  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-3 rounded-lg flex items-center gap-3 transition-all duration-200 border ${
        isActive
          ? 'bg-blue-900/30 border-blue-500/50 text-blue-100'
          : 'bg-gray-800/50 border-gray-700 hover:bg-gray-800 hover:border-gray-600 text-gray-300'
      }`}
    >
      <div className="shrink-0 pt-0.5">
        {getStatusIcon()}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">
          <span className="opacity-50 mr-2">#{chapter.number}</span>
          {chapter.title}
        </p>
      </div>
      {chapter.content && (
        <FileText className="w-3 h-3 text-gray-500 shrink-0" />
      )}
    </button>
  );
};

export default ChapterListItem;