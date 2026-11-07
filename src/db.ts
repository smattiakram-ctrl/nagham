import Dexie, { Table } from 'dexie';

export type Line = { t: number | null; text: string };
export type Song = {
  id: string; // local:<uuid> | drive:<fileId>
  title: string;
  artist: string;
  album: string;
  source: 'local' | 'drive';
  mime: string;
  blob?: Blob; // local files only
  driveId?: string;
  cover?: Blob;
  lines: Line[]; // lyrics with timestamps (seconds)
  fav: 0 | 1;
  addedAt: number;
};

class NaghamDB extends Dexie {
  songs!: Table<Song, string>;
  constructor() {
    super('nagham');
    this.version(1).stores({ songs: 'id, source, fav, addedAt' });
  }
}
export const db = new NaghamDB();
