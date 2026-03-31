export interface OsintResource {
  name: string
  description: string
  url: string
  category: string
  tags: string[]
}

export const OSINT_RESOURCES: OsintResource[] = [
  // People & Organisations
  {
    name: 'OpenCorporates',
    description: 'Global company registry search covering 200+ jurisdictions.',
    url: 'https://opencorporates.com',
    category: 'People & Organisations',
    tags: ['company', 'registry', 'global'],
  },
  {
    name: 'Orbis (BvD)',
    description: 'Private company financial data and ownership structures.',
    url: 'https://www.bvdinfo.com/en-gb/our-products/data/international/orbis',
    category: 'People & Organisations',
    tags: ['company', 'financials', 'ownership'],
  },
  {
    name: 'UK Companies House',
    description: 'Official UK company filings, directors, and accounts.',
    url: 'https://find-and-update.company-information.service.gov.uk',
    category: 'People & Organisations',
    tags: ['company', 'uk', 'filings'],
  },
  {
    name: 'OpenOwnership Register',
    description: 'Beneficial ownership data from multiple national registers.',
    url: 'https://register.openownership.org',
    category: 'People & Organisations',
    tags: ['ownership', 'beneficial', 'transparency'],
  },

  // Sanctions & Watchlists
  {
    name: 'OFAC SDN Search',
    description: 'US Treasury Office of Foreign Assets Control sanctions list search.',
    url: 'https://sanctionssearch.ofac.treas.gov',
    category: 'Sanctions & Watchlists',
    tags: ['sanctions', 'us', 'treasury', 'ofac'],
  },
  {
    name: 'EU Consolidated Sanctions List',
    description: 'European Union consolidated list of persons and entities subject to financial sanctions.',
    url: 'https://data.europa.eu/data/datasets/consolidated-list-of-persons-groups-and-entities-subject-to-eu-financial-sanctions',
    category: 'Sanctions & Watchlists',
    tags: ['sanctions', 'eu', 'europe'],
  },
  {
    name: 'UN Security Council Consolidated List',
    description: 'United Nations Security Council sanctions designations.',
    url: 'https://scsanctions.un.org',
    category: 'Sanctions & Watchlists',
    tags: ['sanctions', 'un', 'security council'],
  },

  // Leaked & Public Archives
  {
    name: 'ICIJ Offshore Leaks',
    description: 'Searchable database from Panama Papers, Pandora Papers, and other leaks.',
    url: 'https://offshoreleaks.icij.org',
    category: 'Leaked & Public Archives',
    tags: ['leaks', 'offshore', 'panama papers', 'pandora papers'],
  },
  {
    name: 'DocumentCloud',
    description: 'Public document archive and analysis platform used by newsrooms worldwide.',
    url: 'https://www.documentcloud.org',
    category: 'Leaked & Public Archives',
    tags: ['documents', 'archive', 'journalism'],
  },
  {
    name: 'MuckRock',
    description: 'FOIA requests, public records, and government documents archive.',
    url: 'https://www.muckrock.com',
    category: 'Leaked & Public Archives',
    tags: ['foia', 'public records', 'government'],
  },
  {
    name: 'WikiLeaks',
    description: 'Archive of leaked confidential documents from governments and corporations.',
    url: 'https://wikileaks.org',
    category: 'Leaked & Public Archives',
    tags: ['leaks', 'government', 'classified'],
  },

  // Geospatial & Satellite
  {
    name: 'Sentinel Hub',
    description: 'Satellite imagery browser with historical and near-real-time data.',
    url: 'https://apps.sentinel-hub.com/eo-browser',
    category: 'Geospatial & Satellite',
    tags: ['satellite', 'imagery', 'remote sensing'],
  },
  {
    name: 'Overpass Turbo',
    description: 'Query and export OpenStreetMap data with a visual interface.',
    url: 'https://overpass-turbo.eu',
    category: 'Geospatial & Satellite',
    tags: ['openstreetmap', 'osm', 'geodata', 'query'],
  },
  {
    name: 'Google Earth Engine',
    description: 'Cloud-based satellite imagery analysis platform for large-scale geospatial analysis.',
    url: 'https://earthengine.google.com',
    category: 'Geospatial & Satellite',
    tags: ['satellite', 'earth', 'analysis', 'google'],
  },
  {
    name: 'SunCalc',
    description: 'Sun and shadow position calculator for photo and video geolocation verification.',
    url: 'https://www.suncalc.org',
    category: 'Geospatial & Satellite',
    tags: ['verification', 'photo', 'shadow', 'geolocation'],
  },

  // Social Media & Web Archiving
  {
    name: 'Wayback Machine',
    description: 'Historical website snapshots dating back to the mid-1990s.',
    url: 'https://web.archive.org',
    category: 'Social Media & Web Archiving',
    tags: ['archive', 'web', 'history', 'snapshots'],
  },
  {
    name: 'InVID WeVerify',
    description: 'Browser extension and web tools for video and image verification.',
    url: 'https://weverify.eu/tools',
    category: 'Social Media & Web Archiving',
    tags: ['verification', 'video', 'image', 'fakeness'],
  },
  {
    name: 'Bellingcat Toolkit',
    description: 'Curated OSINT toolkit spreadsheet maintained by Bellingcat investigators.',
    url: 'https://docs.google.com/spreadsheets/d/18rtqh8EG2q1xBo2cLNyhIDuK9jrPGwYr9DI2UncoqJQ',
    category: 'Social Media & Web Archiving',
    tags: ['bellingcat', 'toolkit', 'curated', 'osint'],
  },
  {
    name: 'Twitter/X Advanced Search',
    description: 'Search Twitter/X posts with date filters, keywords, and account filters.',
    url: 'https://x.com/search-advanced',
    category: 'Social Media & Web Archiving',
    tags: ['twitter', 'social media', 'search', 'archive'],
  },

  // Flight & Vessel Tracking
  {
    name: 'FlightAware',
    description: 'Real-time and historical commercial flight tracking worldwide.',
    url: 'https://www.flightaware.com',
    category: 'Flight & Vessel Tracking',
    tags: ['flight', 'aircraft', 'tracking', 'aviation'],
  },
  {
    name: 'ADS-B Exchange',
    description: 'Unfiltered flight tracking data including military and private aircraft.',
    url: 'https://globe.adsbexchange.com',
    category: 'Flight & Vessel Tracking',
    tags: ['flight', 'adsb', 'unfiltered', 'military'],
  },
  {
    name: 'MarineTraffic',
    description: 'Live and historical vessel tracking with port calls and voyage history.',
    url: 'https://www.marinetraffic.com',
    category: 'Flight & Vessel Tracking',
    tags: ['vessel', 'ship', 'maritime', 'tracking'],
  },
  {
    name: 'VesselFinder',
    description: 'Ship tracking with historical position data and vessel particulars.',
    url: 'https://www.vesselfinder.com',
    category: 'Flight & Vessel Tracking',
    tags: ['vessel', 'ship', 'maritime', 'history'],
  },

  // Financial & Ownership
  {
    name: 'OCCRP Aleph',
    description: 'Investigative documents and data from OCCRP — companies, people, court records.',
    url: 'https://aleph.occrp.org',
    category: 'Financial & Ownership',
    tags: ['occrp', 'documents', 'corruption', 'investigative'],
  },
  {
    name: 'FollowTheMoney',
    description: 'US political campaign finance data — donors, recipients, and spending.',
    url: 'https://www.followthemoney.org',
    category: 'Financial & Ownership',
    tags: ['finance', 'political', 'us', 'donations'],
  },
  {
    name: 'OpenOwnership',
    description: 'Global beneficial ownership data and transparency research.',
    url: 'https://www.openownership.org',
    category: 'Financial & Ownership',
    tags: ['ownership', 'beneficial', 'transparency', 'global'],
  },

  // Court & Legal Records
  {
    name: 'PACER',
    description: 'US federal court electronic records — case filings and dockets.',
    url: 'https://pacer.gov',
    category: 'Court & Legal Records',
    tags: ['court', 'us', 'federal', 'legal', 'filings'],
  },
  {
    name: 'CourtListener',
    description: 'Free access to US federal court opinions and PACER documents.',
    url: 'https://www.courtlistener.com',
    category: 'Court & Legal Records',
    tags: ['court', 'us', 'opinions', 'free'],
  },
  {
    name: 'UK Judiciary Judgments',
    description: 'Published judgments and decisions from UK courts and tribunals.',
    url: 'https://www.judiciary.gov.uk/judgments',
    category: 'Court & Legal Records',
    tags: ['court', 'uk', 'judgments', 'legal'],
  },
  {
    name: 'BAILII',
    description: 'British and Irish Legal Information Institute — free access to case law.',
    url: 'https://www.bailii.org',
    category: 'Court & Legal Records',
    tags: ['court', 'uk', 'ireland', 'case law', 'free'],
  },
]

export const OSINT_CATEGORIES = [
  'People & Organisations',
  'Sanctions & Watchlists',
  'Leaked & Public Archives',
  'Geospatial & Satellite',
  'Social Media & Web Archiving',
  'Flight & Vessel Tracking',
  'Financial & Ownership',
  'Court & Legal Records',
] as const
