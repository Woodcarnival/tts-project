
export interface Chapter {
  id: string;
  number: number;
  title: string;
  content: string | null;
  status: 'pending' | 'loading' | 'completed' | 'error';
  errorMessage?: string;
  sourceUrl?: string;
}

export interface NovelState {
  title: string;
  author?: string;
  chapters: Chapter[];
  isFetchingList: boolean;
  currentChapterId: string | null;
}

export interface SearchResult {
  title: string;
  chapters: string[];
}
