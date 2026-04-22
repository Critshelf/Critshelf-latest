import fs from 'fs';
import path from 'path';

async function generateCsv() {
  const query = `
SELECT DISTINCT ?bggId ?gameLabel WHERE {
  ?game wdt:P2339 ?bggId .
  ?game rdfs:label ?gameLabel .
  FILTER(LANG(?gameLabel) = "en")
} LIMIT 5000
  `;
  const url = `https://query.wikidata.org/sparql?query=${encodeURIComponent(query)}&format=json`;

  console.log("Fetching data from Wikidata...");
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'BoardGameSearchBot/1.0',
        'Accept': 'application/sparql-results+json'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch from Wikidata: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as any;
    const results = data.results.bindings;

    if (!results || results.length === 0) {
      console.warn("No results returned from Wikidata.");
      return;
    }

    console.log(`Retrieved ${results.length} games. Processing...`);

    const header = "objectid,name\n";
    const rows = results.map((item: any) => {
      const id = item.bggId.value;
      let label = item.gameLabel.value;
      
      // Clean label: strip newlines, handle commas
      label = label.replace(/\r?\n/g, ' ').trim();
      if (label.includes(',') || label.includes('"')) {
        // Simple CSV escaping: wrap in quotes, double up existing quotes
        label = `"${label.replace(/"/g, '""')}"`;
      }
      
      return `${id},${label}`;
    });

    const csvContent = header + rows.join('\n');
    const targetPath = path.join(process.cwd(), 'games.csv');
    
    fs.writeFileSync(targetPath, csvContent);
    console.log(`\nSuccess!`);
    console.log(`File saved to: ${targetPath}`);
    console.log(`Final Row Count: ${rows.length}`);
  } catch (error) {
    console.error("Error generating CSV:", error);
    process.exit(1);
  }
}

generateCsv();
