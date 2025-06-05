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