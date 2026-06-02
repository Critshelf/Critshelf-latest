const fs = require('fs');
const path = require('path');

function walkDir(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(function(file) {
        file = path.join(dir, file);
        let stat = fs.statSync(file);
        if (stat && stat.isDirectory()) { 
            results = results.concat(walkDir(file));
        } else { 
            if (file.endsWith('.tsx') || file.endsWith('.ts')) {
                results.push(file);
            }
        }
    });
    return results;
}

const files = walkDir('./src');
files.forEach(file => {
    const content = fs.readFileSync(file, 'utf8');
    const useEffectRegex = /useEffect\s*\(\s*(async\s*)?\(\)\s*=>\s*\{([\s\S]*?)\}\s*(,\s*\[(.*?)\])?\s*\)/g;
    let match;
    while ((match = useEffectRegex.exec(content)) !== null) {
        const effectBody = match[2];
        const deps = match[4] || '';
        
        let hasWrite = effectBody.includes('updateDoc') || 
                       effectBody.includes('setDoc') || 
                       effectBody.includes('addDoc') || 
                       effectBody.includes('deleteDoc') || 
                       effectBody.includes('writeBatch') || 
                       effectBody.includes('runBackfill') ||
                       effectBody.includes('calculateAndStoreAttackClass');
                       
        if (hasWrite) {
            console.log("\n=========================");
            console.log("File: " + file);
            console.log("Deps: [" + deps + "]");
            console.log("Body: ");
            // Print first 5 lines
            const lines = effectBody.split('\n');
            console.log(lines.slice(0, 15).join('\n'));
        }
    }
});
