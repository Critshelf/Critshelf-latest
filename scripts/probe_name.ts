
const WIKIDATA_SPARQL_URL = 'https://query.wikidata.org/sparql';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';

async function probeSearchApi(name) {
  const url = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(name)}&language=en&format=json&origin=*`;
  const resp = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT }
  });
  const data = await resp.json();
  console.log(`Search API for "${name}": Found ${data.search.length} results.`);
  data.search.forEach(s => {
    console.log(`- ${s.id} (Label: ${s.label}, Description: ${s.description || 'No description'})`);
  });
}

probeSearchApi("Dinosaur Island");
