import fs from 'fs';

let content = fs.readFileSync('src/pages/AdminDashboard.tsx', 'utf8');

// Remove import
content = content.replace('import { calculateLocalAttackClass } from "../services/playLogService";\n', '');

// Remove states
const statesRegex = /  const \[isFirehoseBackfilling.*?setIsGroupHistoryPatching.*?false\);\n/s;
content = content.replace(statesRegex, '');

// Remove functions
const startIndex = content.indexOf('  const runNamePatch = async () => {');
const endIndex = content.indexOf('  const loadData = async (isNext = false) => {');

if (startIndex !== -1 && endIndex !== -1) {
  content = content.substring(0, startIndex) + content.substring(endIndex);
} else {
  console.log("Functions section not found.");
}

// Remove buttons
const btnStart = content.indexOf('          <button\n            onClick={runFirehoseBackfill}');
const btnEnd = content.indexOf('        </div>\n      </div>\n\n      {games.length > 0 && (');

if (btnStart !== -1 && btnEnd !== -1) {
  content = content.substring(0, btnStart) + content.substring(btnEnd);
} else {
  console.log("Buttons section not found.");
}

fs.writeFileSync('src/pages/AdminDashboard.tsx', content);
