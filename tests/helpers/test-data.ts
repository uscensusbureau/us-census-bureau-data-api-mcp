export const sampleGeographyResponse = {
  "fips": [
    {
      "name": "us",
      "geoLevelDisplay": "010",
      "referenceDate": "2022-01-01"
    },
    {
      "name": "region",
      "geoLevelDisplay": "020",
      "referenceDate": "2022-01-01"
    },
    {
      "name": "division",
      "geoLevelDisplay": "030",
      "referenceDate": "2022-01-01"
    },
    {
      "name": "state",
      "geoLevelDisplay": "040",
      "referenceDate": "2022-01-01"
    },
    {
      "name": "county",
      "geoLevelDisplay": "050",
      "referenceDate": "2022-01-01",
      "requires": [
        "state"
      ],
      "wildcard": [
        "state"
      ],
      "optionalWithWCFor": "state"
    },
    {
      "name": "county subdivision",
      "geoLevelDisplay": "060",
      "referenceDate": "2022-01-01",
      "requires": [
        "state",
        "county"
      ],
      "wildcard": [
        "county"
      ],
      "optionalWithWCFor": "county"
    },
    {
      "name": "place",
      "geoLevelDisplay": "160",
      "referenceDate": "2022-01-01",
      "requires": [
        "state"
      ],
      "wildcard": [
        "state"
      ],
      "optionalWithWCFor": "state"
    },
    {
      "name": "alaska native regional corporation",
      "geoLevelDisplay": "230",
      "referenceDate": "2022-01-01",
      "requires": [
        "state"
      ],
      "wildcard": [
        "state"
      ],
      "optionalWithWCFor": "state"
    },
    {
      "name": "american indian area/alaska native area/hawaiian home land",
      "geoLevelDisplay": "250",
      "referenceDate": "2022-01-01"
    },
    {
      "name": "metropolitan statistical area/micropolitan statistical area",
      "geoLevelDisplay": "310",
      "referenceDate": "2022-01-01"
    },
    {
      "name": "principal city (or part)",
      "geoLevelDisplay": "312",
      "referenceDate": "2022-01-01",
      "requires": [
        "metropolitan statistical area/micropolitan statistical area",
        "state (or part)"
      ]
    },
    {
      "name": "metropolitan division",
      "geoLevelDisplay": "314",
      "referenceDate": "2022-01-01",
      "requires": [
        "metropolitan statistical area/micropolitan statistical area"
      ]
    },
    {
      "name": "combined statistical area",
      "geoLevelDisplay": "330",
      "referenceDate": "2022-01-01"
    },
    {
      "name": "combined new england city and town area",
      "geoLevelDisplay": "335",
      "referenceDate": "2022-01-01"
    },
    {
      "name": "new england city and town area",
      "geoLevelDisplay": "350",
      "referenceDate": "2022-01-01"
    },
    {
      "name": "principal city",
      "geoLevelDisplay": "352",
      "referenceDate": "2022-01-01",
      "requires": [
        "new england city and town area",
        "state (or part)"
      ],
      "wildcard": [
        "state (or part)"
      ],
      "optionalWithWCFor": "state (or part)"
    },
    {
      "name": "necta division",
      "geoLevelDisplay": "355",
      "referenceDate": "2022-01-01",
      "requires": [
        "new england city and town area"
      ]
    },
    {
      "name": "urban area",
      "geoLevelDisplay": "400",
      "referenceDate": "2022-01-01"
    },
    {
      "name": "congressional district",
      "geoLevelDisplay": "500",
      "referenceDate": "2022-01-01",
      "requires": [
        "state"
      ],
      "wildcard": [
        "state"
      ],
      "optionalWithWCFor": "state"
    },
    {
      "name": "public use microdata area",
      "geoLevelDisplay": "795",
      "referenceDate": "2022-01-01",
      "requires": [
        "state"
      ],
      "wildcard": [
        "state"
      ],
      "optionalWithWCFor": "state"
    },
    {
      "name": "school district (elementary)",
      "geoLevelDisplay": "950",
      "referenceDate": "2022-01-01",
      "requires": [
        "state"
      ],
      "wildcard": [
        "state"
      ],
      "optionalWithWCFor": "state"
    },
    {
      "name": "school district (secondary)",
      "geoLevelDisplay": "960",
      "referenceDate": "2022-01-01",
      "requires": [
        "state"
      ],
      "wildcard": [
        "state"
      ],
      "optionalWithWCFor": "state"
    },
    {
      "name": "school district (unified)",
      "geoLevelDisplay": "970",
      "referenceDate": "2022-01-01",
      "requires": [
        "state"
      ],
      "wildcard": [
        "state"
      ],
      "optionalWithWCFor": "state"
    }
  ]
};

export const mockMetadataResponse = {
  "@context": "https://project-open-data.cio.gov/v1.1/schema/catalog.jsonld",
  "@id": "http://api.census.gov/data/2022/acs/acs1.json",
  "@type": "dcat:Catalog",
  "conformsTo": "https://project-open-data.cio.gov/v1.1/schema",
  "describedBy": "https://project-open-data.cio.gov/v1.1/schema/catalog.json",
  "dataset": [
    {
      "c_dataset": ["acs", "acs1"],
      "c_geographyLink": "http://api.census.gov/data/2022/acs/acs1/geography.json",
      "c_variablesLink": "http://api.census.gov/data/2022/acs/acs1/variables.json",
      "c_documentationLink": "https://www.census.gov/developer/",
      "c_isAvailable": true,
      "c_vintage": 2022,
      "@type": "dcat:Dataset",
      "title": "American Community Survey: 1-Year Estimates: Detailed Tables",
      "accessLevel": "public",
      "bureauCode": ["006:07"],
      "description": "The American Community Survey (ACS) is an ongoing survey...",
      "distribution": [
        {
          "@type": "dcat:Distribution",
          "accessURL": "http://api.census.gov/data/2022/acs/acs1",
          "description": "API endpoint",
          "format": "API",
          "mediaType": "application/json",
          "title": "API endpoint"
        }
      ],
      "contactPoint": {
        "fn": "Data User Outreach",
        "hasEmail": "mailto:acso.users.support@census.gov"
      },
      "identifier": "https://api.census.gov/data/id/ACSDT1Y2022",
      "keyword": ["census"],
      "license": "https://creativecommons.org/publicdomain/zero/1.0/",
      "modified": "2023-12-07 00:00:00.0",
      "programCode": ["006:007"],
      "references": ["https://www.census.gov/developers/"],
      "spatial": "United States",
      "temporal": "2022/2022",
      "publisher": {
        "@type": "org:Organization",
        "name": "U.S. Census Bureau"
      }
    }
  ]
};

export const sampleDatasetMetadata = {
  "@context": "https://project-open-data.cio.gov/v1.1/schema/catalog.jsonld",
  "@id": "http://api.census.gov/data/2022/acs/acs1.json",
  "@type": "dcat:Catalog",
  "conformsTo": "https://project-open-data.cio.gov/v1.1/schema",
  "describedBy": "https://project-open-data.cio.gov/v1.1/schema/catalog.json",
  "dataset": [
    {
      "c_dataset": ["acs", "acs1"],
      "c_geographyLink": "http://api.census.gov/data/2022/acs/acs1/geography.json",
      "c_variablesLink": "http://api.census.gov/data/2022/acs/acs1/variables.json",
      "c_documentationLink": "https://www.census.gov/developer/",
      "c_isAvailable": true,
      "c_vintage": 2022,
      "@type": "dcat:Dataset",
      "title": "American Community Survey: 1-Year Estimates: Detailed Tables",
      "accessLevel": "public",
      "bureauCode": ["006:07"],
      "description": "The American Community Survey (ACS) is an ongoing survey that provides vital information on a yearly basis about our nation and its people.",
      "distribution": [
        {
          "@type": "dcat:Distribution",
          "accessURL": "http://api.census.gov/data/2022/acs/acs1",
          "description": "API endpoint",
          "format": "API",
          "mediaType": "application/json",
          "title": "API endpoint"
        }
      ],
      "contactPoint": {
        "fn": "Data User Outreach",
        "hasEmail": "mailto:acso.users.support@census.gov"
      },
      "identifier": "https://api.census.gov/data/id/ACSDT1Y2022",
      "keyword": ["census"],
      "license": "https://creativecommons.org/publicdomain/zero/1.0/",
      "modified": "2023-12-07 00:00:00.0",
      "programCode": ["006:007"],
      "references": ["https://www.census.gov/developers/"],
      "spatial": "United States",
      "temporal": "2022/2022",
      "publisher": {
        "@type": "org:Organization",
        "name": "U.S. Census Bureau"
      }
    }
  ]
};