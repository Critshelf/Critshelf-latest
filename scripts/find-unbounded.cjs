const fs = require('fs');
const path = require('path');

function walkDir(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            results = results.concat(walkDir(file));
        } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
            results.push(file);
        }
    });
    return results;
}

function findUnboundedQueries(dir) {
    const files = walkDir(dir);
    files.forEach(file => {
        const content = fs.readFileSync(file, 'utf8');
        const queryRegex = /query\s*\([\s\S]*?\)/g;
        let match;
        while ((match = queryRegex.exec(content)) !== null) {
            const q = match[0];
            if (q.includes('collection(') && !q.includes('limit(')) {
                // Ignore small arrays bounds
                if (q.includes('"in"')) continue;
                if (q.includes("'in'")) continue;
                
                // Get line number
                const linesToMatch = content.slice(0, match.index).split('\n');
                console.log(`${file}:${linesToMatch.length} \n${q}\n`);
            }
        }
    });
}

findUnboundedQueries('src');
