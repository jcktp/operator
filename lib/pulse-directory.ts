export interface DirectoryEntry {
  name: string
  category: string
  url: string
}

export const PULSE_DIRECTORY: DirectoryEntry[] = [
  // Global
  { name: 'BBC News',              category: 'Global',        url: 'https://feeds.bbci.co.uk/news/rss.xml' },
  { name: 'The New York Times',    category: 'Global',        url: 'https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml' },
  { name: 'Deutsche Welle',         category: 'Global',        url: 'https://rss.dw.com/rdf/rss-en-all' },
  { name: 'France 24',             category: 'Global',        url: 'https://www.france24.com/en/rss' },
  { name: 'The Guardian',          category: 'Global',        url: 'https://www.theguardian.com/world/rss' },
  { name: 'Al Jazeera',            category: 'Global',        url: 'https://www.aljazeera.com/xml/rss/all.xml' },
  { name: 'NPR',                   category: 'Global',        url: 'https://feeds.npr.org/1001/rss.xml' },
  // Business
  { name: 'Wall Street Journal',   category: 'Business',      url: 'https://feeds.a.dj.com/rss/RSSWorldNews.xml' },
  { name: 'Financial Times',       category: 'Business',      url: 'https://www.ft.com/?format=rss' },
  { name: 'The Economist',         category: 'Business',      url: 'https://www.economist.com/latest/rss.xml' },
  { name: 'CNBC',                  category: 'Business',      url: 'https://www.cnbc.com/id/100003114/device/rss/rss.html' },
  // Tech
  { name: 'The Verge',             category: 'Tech',          url: 'https://www.theverge.com/rss/index.xml' },
  { name: 'Wired',                 category: 'Tech',          url: 'https://www.wired.com/feed/rss' },
  { name: 'Ars Technica',          category: 'Tech',          url: 'https://feeds.arstechnica.com/arstechnica/index' },
  { name: 'TechCrunch',            category: 'Tech',          url: 'https://techcrunch.com/feed/' },
  // Science
  { name: 'NASA',                  category: 'Science',       url: 'https://www.nasa.gov/rss/dyn/breaking_news.rss' },
  { name: 'Scientific American',   category: 'Science',       url: 'https://www.scientificamerican.com/section/news/rss/' },
  // Politics / Analysis
  { name: 'Politico',              category: 'Politics',      url: 'https://www.politico.com/rss/politicopicks.xml' },
  { name: 'The Hill',              category: 'Politics',      url: 'https://thehill.com/homenews/feed/' },
  { name: 'Vox',                   category: 'Analysis',      url: 'https://www.vox.com/rss/index.xml' },
  // Local US
  { name: 'NY Post',               category: 'Local (NY)',    url: 'https://nypost.com/feed/' },
  { name: 'LA Times',              category: 'Local (LA)',    url: 'https://www.latimes.com/local/rss2.0.xml' },
  { name: 'Chicago Tribune',       category: 'Local (CHI)',   url: 'https://www.chicagotribune.com/arc/outboundfeeds/rss/category/news/local/?outputType=xml' },
  { name: 'SFGate',                category: 'Local (SF)',    url: 'https://www.sfgate.com/bayarea/feed/bayarea-headlines-rss.xml' },
  { name: 'The Boston Globe',      category: 'Local (BOS)',   url: 'https://www.bostonglobe.com/arc/outboundfeeds/rss/category/metro/?outputType=xml' },
  { name: 'Seattle Times',         category: 'Local (SEA)',   url: 'https://www.seattletimes.com/seattle-news/feed/' },
  { name: 'Texas Tribune',         category: 'Local (TX)',    url: 'https://www.texastribune.org/feeds/main/' },
  { name: 'Miami Herald',          category: 'Local (MIA)',   url: 'https://www.miamiherald.com/news/local/community/miami-dade/index.rss' },
  // Local UK
  { name: 'London Evening Standard', category: 'Local (LDN)', url: 'https://www.standard.co.uk/news/london/rss' },
  { name: 'Manchester Evening News', category: 'Local (MAN)', url: 'https://www.manchestereveningnews.co.uk/news/?service=rss' },
  { name: 'Liverpool Echo',         category: 'Local (LIV)',  url: 'https://www.liverpoolecho.co.uk/news/?service=rss' },
  { name: 'BBC Scotland',           category: 'Local (SCO)',  url: 'https://feeds.bbci.co.uk/news/scotland/rss.xml' },
  { name: 'BBC Wales',              category: 'Local (WAL)',  url: 'https://feeds.bbci.co.uk/news/wales/rss.xml' },
  { name: 'BBC Northern Ireland',   category: 'Local (NI)',   url: 'https://feeds.bbci.co.uk/news/northern_ireland/rss.xml' },
  // Local Canada / Australia / Asia
  { name: 'Toronto Sun',            category: 'Local (TOR)',  url: 'https://torontosun.com/category/news/local-news/feed' },
  { name: 'Montreal Gazette',       category: 'Local (MTL)',  url: 'https://montrealgazette.com/category/news/local-news/feed' },
  { name: 'Sydney Morning Herald',  category: 'Local (SYD)',  url: 'https://www.smh.com.au/rss/national/nsw.xml' },
  { name: 'The Age',                category: 'Local (MEL)',  url: 'https://www.theage.com.au/rss/national/victoria.xml' },
  { name: 'Times of India',         category: 'Local (MUM)',  url: 'https://timesofindia.indiatimes.com/rssfeeds/-2128830438.cms' },
  { name: 'The Straits Times',      category: 'Local (SGP)',  url: 'https://www.straitstimes.com/news/singapore/rss.xml' },
  // Europe
  { name: 'Euronews',               category: 'Europe',       url: 'https://www.euronews.com/rss?level=vertical&name=news' },
  { name: 'France 24',              category: 'Europe (FR)',  url: 'https://www.france24.com/en/europe/rss' },
  { name: 'Deutsche Welle',         category: 'Europe (DE)',  url: 'https://rss.dw.com/rdf/rss-en-top' },
  { name: 'Politico Europe',        category: 'Europe (EU)',  url: 'https://www.politico.eu/feed/' },
  { name: 'Euractiv',               category: 'Europe (EU)',  url: 'https://www.euractiv.com/feed/' },
  { name: 'El País (English)',       category: 'Europe (ES)',  url: 'https://elpais.com/rss/elpais/inenglish.xml' },
  { name: 'Der Spiegel',            category: 'Europe (DE)',  url: 'http://www.spiegel.de/schlagzeilen/rss/0,5291,676,00.xml' },
  { name: 'Le Monde diplomatique',  category: 'Europe (FR)',  url: 'https://mondediplo.com/backend' },
  { name: 'The Irish Times',        category: 'Europe (IE)',  url: 'https://www.irishtimes.com/arc/outboundfeeds/rss/category/news/?outputType=xml' },
  { name: 'Swissinfo',              category: 'Europe (CH)',  url: 'https://www.swissinfo.ch/eng/apple-news-feed/rss' },
  { name: 'The Local',              category: 'Europe',       url: 'https://www.thelocal.com/feed/' },
  { name: 'RTÉ News',               category: 'Europe (IE)',  url: 'https://www.rte.ie/news/rss/news-headlines.xml' },
  { name: 'ANSA News',              category: 'Europe (IT)',  url: 'https://www.ansa.it/english/ansanews_english.xml' },
  { name: 'The Brussels Times',     category: 'Europe (BE)',  url: 'https://www.brusselstimes.com/feed/' },
  { name: 'Kathimerini',            category: 'Europe (GR)',  url: 'https://www.ekathimerini.com/rss/' },
  { name: 'The Barents Observer',   category: 'Europe (Nordic)', url: 'https://thebarentsobserver.com/en/rss.xml' },
  { name: 'Notes from Poland',      category: 'Europe (PL)',  url: 'https://notesfrompoland.com/feed/' },
  { name: 'Kyiv Independent',       category: 'Europe (UA)',  url: 'https://kyivindependent.com/rss/' },
  { name: 'BBC Europe',             category: 'Europe',       url: 'https://feeds.bbci.co.uk/news/world/europe/rss.xml' },
  { name: 'Radio Free Europe',      category: 'Europe (East)', url: 'https://www.rferl.org/api/epiqq' },
]

export const DIRECTORY_CATEGORIES = [
  'All',
  ...Array.from(new Set(PULSE_DIRECTORY.map(e => e.category))),
]
