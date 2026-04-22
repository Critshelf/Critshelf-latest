import fs from 'fs';
import path from 'path';

const TARGET_FILE = path.resolve(process.cwd(), 'boardgame-geek-dataset_organized.csv');

export function appendData(data: string) {
  fs.appendFileSync(TARGET_FILE, data);
  console.log('Appended chunk to', TARGET_FILE);
}
