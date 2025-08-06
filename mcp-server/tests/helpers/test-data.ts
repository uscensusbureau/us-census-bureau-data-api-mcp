export const sampleVariablesResponse = {
  variables: {
    for: {
      label: "Census API FIPS 'for' clause",
      concept: 'Census API Geography Specification',
      predicateType: 'fips-for',
      group: 'N/A',
      limit: 0,
      predicateOnly: true,
    },
    in: {
      label: "Census API FIPS 'in' clause",
      concept: 'Census API Geography Specification',
      predicateType: 'fips-in',
      group: 'N/A',
      limit: 0,
      predicateOnly: true,
    },
    ucgid: {
      label: 'Uniform Census Geography Identifier clause',
      concept: 'Census API Geography Specification',
      predicateType: 'ucgid',
      group: 'N/A',
      limit: 0,
      predicateOnly: true,
    },
    PELKAVL: {
      label: 'Labor Force-(unemployed)available for work last week,y/n',
      predicateType: 'int',
      group: 'N/A',
      limit: 0,
      'suggested-weight': 'PWCMPWGT',
      values: {
        item: {
          '2': 'No',
          '1': 'Yes',
          '-1': 'Not in Universe',
        },
      },
    },
    PEEDUCA: {
      label: 'Demographics-highest level of school completed',
      predicateType: 'int',
      group: 'N/A',
      limit: 0,
      'suggested-weight': 'PWSSWGT',
      values: {
        item: {
          '46': 'DOCTORATE DEGREE(EX:PhD,EdD)',
          '33': '5th Or 6th Grade',
          '44': "MASTER'S DEGREE(EX:MA,MS,MEng,MEd,MSW)",
          '39': 'High School Grad-Diploma Or Equiv (ged)',
          '42': 'Associate Deg.-Academic Program',
          '31': 'Less Than 1st Grade',
          '38': '12th Grade No Diploma',
          '40': 'Some College But No Degree',
          '-1': 'Not in Universe',
          '32': '1st,2nd,3rd Or 4th Grade',
          '43': "Bachelor's Degree(ex:ba,ab,bs)",
          '37': '11th Grade',
          '45': 'Professional School Deg(ex:md,dds,dvm)',
          '36': '10th Grade',
          '35': '9th Grade',
          '34': '7th Or 8th Grade',
          '41': 'Associate Degree-Occupational/Vocationl',
        },
      },
    },
    PUBUS1: {
      label: 'Labor Force-unpaid work in family business/farm,y/n',
      predicateType: 'int',
      group: 'N/A',
      limit: 0,
      'suggested-weight': 'PWCMPWGT',
      values: {
        item: {
          '-3': 'Refused',
          '-1': 'Blank',
          '-2': "Don't Know",
          '2': 'No',
          '1': 'Yes',
        },
      },
    },
    PRCOW1: {
      label: 'Indus.&Occ.-(main job)class of worker-recode',
      predicateType: 'int',
      group: 'N/A',
      limit: 0,
      'suggested-weight': 'PWCMPWGT',
      values: {
        item: {
          '3': 'Local govt',
          '-1': 'In Universe, Met No Conditions To Assign',
          '1': 'Federal govt',
          '2': 'State govt',
          '5': 'Self-employed, unincorp.',
          '6': 'Without pay',
          '4': 'Private (incl. self-employed incorp.)',
        },
      },
    },
    HULENSEC: {
      label: 'Household-total time(seconds) to complete interview',
      predicateType: 'int',
      group: 'N/A',
      limit: 0,
      'suggested-weight': 'HWHHWGT',
      values: {
        item: {
          '-2': "Don't Know",
          '-1': 'Blank',
          '-3': 'Refused',
        },
        range: [
          {
            min: '0',
            max: '99999',
            description: 'Range',
          },
        ],
      },
    },
  },
}

export const mockMetadataResponse = {
  '@context': 'https://project-open-data.cio.gov/v1.1/schema/catalog.jsonld',
  '@id': 'http://api.census.gov/data/2022/acs/acs1.json',
  '@type': 'dcat:Catalog',
  conformsTo: 'https://project-open-data.cio.gov/v1.1/schema',
  describedBy: 'https://project-open-data.cio.gov/v1.1/schema/catalog.json',
  dataset: [
    {
      c_dataset: ['acs', 'acs1'],
      c_geographyLink:
        'http://api.census.gov/data/2022/acs/acs1/geography.json',
      c_variablesLink:
        'http://api.census.gov/data/2022/acs/acs1/variables.json',
      c_documentationLink: 'https://www.census.gov/developer/',
      c_isAvailable: true,
      c_vintage: 2022,
      '@type': 'dcat:Dataset',
      title: 'American Community Survey: 1-Year Estimates: Detailed Tables',
      accessLevel: 'public',
      bureauCode: ['006:07'],
      description:
        'The American Community Survey (ACS) is an ongoing survey...',
      distribution: [
        {
          '@type': 'dcat:Distribution',
          accessURL: 'http://api.census.gov/data/2022/acs/acs1',
          description: 'API endpoint',
          format: 'API',
          mediaType: 'application/json',
          title: 'API endpoint',
        },
      ],
      contactPoint: {
        fn: 'Data User Outreach',
        hasEmail: 'mailto:acso.users.support@census.gov',
      },
      identifier: 'https://api.census.gov/data/id/ACSDT1Y2022',
      keyword: ['census'],
      license: 'https://creativecommons.org/publicdomain/zero/1.0/',
      modified: '2023-12-07 00:00:00.0',
      programCode: ['006:007'],
      references: ['https://www.census.gov/developers/'],
      spatial: 'United States',
      temporal: '2022/2022',
      publisher: {
        '@type': 'org:Organization',
        name: 'U.S. Census Bureau',
      },
    },
  ],
}

export const sampleDatasetMetadata = {
  '@context': 'https://project-open-data.cio.gov/v1.1/schema/catalog.jsonld',
  '@id': 'http://api.census.gov/data/2022/acs/acs1.json',
  '@type': 'dcat:Catalog',
  conformsTo: 'https://project-open-data.cio.gov/v1.1/schema',
  describedBy: 'https://project-open-data.cio.gov/v1.1/schema/catalog.json',
  dataset: [
    {
      c_dataset: ['acs', 'acs1'],
      c_geographyLink:
        'http://api.census.gov/data/2022/acs/acs1/geography.json',
      c_variablesLink:
        'http://api.census.gov/data/2022/acs/acs1/variables.json',
      c_documentationLink: 'https://www.census.gov/developer/',
      c_isAvailable: true,
      c_vintage: 2022,
      '@type': 'dcat:Dataset',
      title: 'American Community Survey: 1-Year Estimates: Detailed Tables',
      accessLevel: 'public',
      bureauCode: ['006:07'],
      description:
        'The American Community Survey (ACS) is an ongoing survey that provides vital information on a yearly basis about our nation and its people.',
      distribution: [
        {
          '@type': 'dcat:Distribution',
          accessURL: 'http://api.census.gov/data/2022/acs/acs1',
          description: 'API endpoint',
          format: 'API',
          mediaType: 'application/json',
          title: 'API endpoint',
        },
      ],
      contactPoint: {
        fn: 'Data User Outreach',
        hasEmail: 'mailto:acso.users.support@census.gov',
      },
      identifier: 'https://api.census.gov/data/id/ACSDT1Y2022',
      keyword: ['census'],
      license: 'https://creativecommons.org/publicdomain/zero/1.0/',
      modified: '2023-12-07 00:00:00.0',
      programCode: ['006:007'],
      references: ['https://www.census.gov/developers/'],
      spatial: 'United States',
      temporal: '2022/2022',
      publisher: {
        '@type': 'org:Organization',
        name: 'U.S. Census Bureau',
      },
    },
  ],
}

export const sampleTableByGroupData = [
  ['NAME', 'B01001_001E', 'state'],
  ['Alabama', '4903185', '01'],
  ['Alaska', '731158', '02'],
  ['Arizona', '7278717', '04'],
]
