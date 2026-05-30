const fs = require('fs');
const path = require('path');

function walkDir(dir) {
    let results = [];
    let list = fs.readdirSync(dir);
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
    const useEffectRegex = /useEffect\s*\(\s*\(\(?\)?\s*=>\s*\{([\s\S]*?)\}\s*(?:,\s*\[(.*?)\])?\s*\)/g;
    let match;
    while ((match = useEffectRegex.exec(content)) !== null) {
        const effectBody = match[1];
        if (effectBody.includes('updateDoc') || effectBody.includes('setDoc') || effectBody.includes('calculateAndStoreAttackClass')) {
            console.log("\nFound in " + file + " with deps [" + match[2] + "]:");
            if (effectBody.includes('updateDoc')) console.log("- updateDoc called");
            if (effectBody.includes('setDoc')) console.log("- setDoc called");
            if (effectBody.includes('calculateAndStoreAttackClass')) console.log("- calculateAndStoreAttackClass called");
        }
    }
});
