const USER_AGENT = 'CritShelfImporter/1.0 (coreykern2040@gmail.com)';
const WIKIDATA_SPARQL_URL = 'https://query.wikidata.org/sparql';

async function checkBrass() {
  const query = `
    SELECT ?p ?pLabel ?o ?oLabel
    WHERE {
      wd:Q36511110 ?p ?o.
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
    }
    LIMIT 100
  `;
  
  const url = `${WIKIDATA_SPARQL_URL}?query=${encodeURIComponent(query)}&format=json`;
  
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT }
    });
    const data = await response.json() as any;
    console.log('Brass properties:', JSON.stringify(data.results.bindings, null, 2));
  } catch (error: any) {
    console.error('Search failed:', error.message);
  }
}

checkBrass();
