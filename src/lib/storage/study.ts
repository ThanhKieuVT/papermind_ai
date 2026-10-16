import type { StudyDeck } from "@/lib/study/types";
import { STORES, dbDelete, dbGet, dbGetAll, dbPut } from "@/lib/storage/db";

export function emptyDeck(id: string, paperTitle: string): StudyDeck {
  return {
    id,
    paperTitle,
    flashcards: [],
    questions: [],
    knownCards: [],
    answers: {},
    attempts: [],
    updatedAt: new Date().toISOString(),
  };
}

export function getDeck(id: string): Promise<StudyDeck | undefined> {
  return dbGet<StudyDeck>(STORES.study, id);
}

export function listDecks(): Promise<StudyDeck[]> {
  return dbGetAll<StudyDeck>(STORES.study);
}

export async function saveDeck(deck: StudyDeck): Promise<StudyDeck> {
  const updated = { ...deck, updatedAt: new Date().toISOString() };
  await dbPut(STORES.study, updated);
  return updated;
}

export function deleteDeck(id: string): Promise<void> {
  return dbDelete(STORES.study, id);
}
