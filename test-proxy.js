fetch('http://localhost:3000/api/bgg/search?query=Catan').then(r => r.json().catch(() => r.text())).then(console.log).catch(console.error);
