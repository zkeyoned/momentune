/**
 * 日记便捷 hooks
 */

import { useJournalStore } from '../stores/journalStore';
import type { JournalEntry } from '../types';

/** 全部日记(按时间倒序) */
export function useJournals(): JournalEntry[] {
  return useJournalStore((s) =>
    [...s.journals].sort((a, b) => b.createdAt - a.createdAt),
  );
}

/** 按 ID 获取单条日记 */
export function useJournal(id: string | undefined): JournalEntry | undefined {
  return useJournalStore((s) => s.journals.find((j) => j.id === id));
}

/** 日记总数 */
export function useJournalCount(): number {
  return useJournalStore((s) => s.journals.length);
}
