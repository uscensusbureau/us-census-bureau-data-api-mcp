export const GeographyLevels = {
  "United States": { 
    querySyntax: "us",
    code: "010",
    queryExample: "for=us:1",
    codeType: "FIPS" as const,
    requiresFIPS: false,
    isHierarchical: false
  },
  "Region": { 
    querySyntax: "region",
    code: "020",
    queryExample: "for=region:1",
    codeType: "FIPS" as const,
    requiresFIPS: false,
    isHierarchical: false
  },
  "Division": { 
    querySyntax: "division",
    code: "030",
    queryExample: "for=division:1",
    codeType: "FIPS" as const,
    requiresFIPS: false,
    isHierarchical: false
  },
  "State": { 
    querySyntax: "state",
    code: "040",
    queryExample: "for=state:06",
    codeType: "FIPS" as const,
    requiresFIPS: true,
    isHierarchical: false
  },
  "County": { 
    querySyntax: "county",
    code: "050",
    queryExample: "for=county:075&in=state:06",
    codeType: "FIPS" as const,
    requiresFIPS: true,
    isHierarchical: true
  },
  "County Subdivision": { 
    querySyntax: "county+subdivision",
    code: "060",
    queryExample: "for=county+subdivision:*&in=county:075&in=state:06",
    codeType: "FIPS" as const,
    requiresFIPS: true,
    isHierarchical: true
  },
  "Census Tract": { 
    querySyntax: "tract",
    code: "140",
    queryExample: "for=tract:*&in=county:075&in=state:06",
    codeType: "HYBRID" as const,
    requiresFIPS: true,
    isHierarchical: true
  },
  "Block Group": { 
    querySyntax: "block+group",
    code: "150",
    queryExample: "for=block+group:*&in=tract:123456&in=county:075&in=state:06",
    codeType: "HYBRID" as const,
    requiresFIPS: true,
    isHierarchical: true
  },
  "Census Block": { 
    querySyntax: "block",
    code: "155",
    queryExample: "for=block:*&in=tract:123456&in=county:075&in=state:06",
    codeType: "HYBRID" as const,
    requiresFIPS: true,
    isHierarchical: true
  },
  "Place": { 
    querySyntax: "place",
    code: "160",
    queryExample: "for=place:67000&in=state:06",
    codeType: "FIPS" as const,
    requiresFIPS: true,
    isHierarchical: true
  },
  "Alaska Native Regional Corporation": { 
    querySyntax: "alaska+native+regional+corporation",
    code: "230",
    queryExample: "for=alaska+native+regional+corporation:*&in=state:02",
    codeType: "FIPS" as const,
    requiresFIPS: true,
    isHierarchical: true
  },
  "American Indian Area": { 
    querySyntax: "american+indian+area/alaska+native+area/hawaiian+home+land",
    code: "250",
    queryExample: "for=american+indian+area/alaska+native+area/hawaiian+home+land:*",
    codeType: "FIPS" as const,
    requiresFIPS: true,
    isHierarchical: false
  },
  "Metropolitan Statistical Area": { 
    querySyntax: "metropolitan+statistical+area/micropolitan+statistical+area",
    code: "310",
    queryExample: "for=metropolitan+statistical+area/micropolitan+statistical+area:41860",
    codeType: "FIPS" as const,
    requiresFIPS: true,
    isHierarchical: false
  },
  "Metropolitan Area Principal City": { 
    querySyntax: "metropolitan+statistical+area/micropolitan+statistical+area-state-principal+city",
    code: "312",
    queryExample: "for=metropolitan+statistical+area/micropolitan+statistical+area-state-principal+city:*&in=metropolitan+statistical+area/micropolitan+statistical+area:41860",
    codeType: "FIPS" as const,
    requiresFIPS: true,
    isHierarchical: true
  },
  "Metropolitan Division": { 
    querySyntax: "metropolitan+statistical+area/micropolitan+statistical+area-metropolitan+division",
    code: "314",
    queryExample: "for=metropolitan+statistical+area/micropolitan+statistical+area-metropolitan+division:*&in=metropolitan+statistical+area/micropolitan+statistical+area:41860",
    codeType: "INCITS" as const,
    requiresFIPS: true,
    isHierarchical: true
  },
  "Combined Statistical Area": { 
    querySyntax: "combined+statistical+area",
    code: "330",
    queryExample: "for=combined+statistical+area:348",
    codeType: "FIPS" as const,
    requiresFIPS: true,
    isHierarchical: false
  },
  "Combined NECTA": { 
    querySyntax: "combined+new+england+city+and+town+area",
    code: "335",
    queryExample: "for=combined+new+england+city+and+town+area:*",
    codeType: "FIPS" as const,
    requiresFIPS: true,
    isHierarchical: false
  },
  "New England City and Town Area": { 
    querySyntax: "new+england+city+and+town+area",
    code: "350",
    queryExample: "for=new+england+city+and+town+area:*",
    codeType: "FIPS" as const,
    requiresFIPS: true,
    isHierarchical: false
  },
  "NECTA Principal City": { 
    querySyntax: "new+england+city+and+town+area-state-principal+city",
    code: "352",
    queryExample: "for=new+england+city+and+town+area-state-principal+city:*&in=new+england+city+and+town+area:*",
    codeType: "FIPS" as const,
    requiresFIPS: true,
    isHierarchical: true
  },
  "NECTA Division": { 
    querySyntax: "new+england+city+and+town+area-necta+division",
    code: "355",
    queryExample: "for=new+england+city+and+town+area-necta+division:*&in=new+england+city+and+town+area:*",
    codeType: "FIPS" as const,
    requiresFIPS: true,
    isHierarchical: true
  },
  "Urban Area": { 
    querySyntax: "urban+area",
    code: "400",
    queryExample: "for=urban+area:*",
    codeType: "CENSUS" as const,
    requiresFIPS: false,
    isHierarchical: false
  },
  "Congressional District": { 
    querySyntax: "congressional+district",
    code: "500",
    queryExample: "for=congressional+district:12&in=state:06",
    codeType: "INCITS" as const,
    requiresFIPS: true,
    isHierarchical: true
  },
  "State Senate District": { 
    querySyntax: "state+legislative+district+(upper+chamber)",
    code: "610",
    queryExample: "for=state+legislative+district+(upper+chamber):*&in=state:06",
    codeType: "STATE" as const,
    requiresFIPS: true,
    isHierarchical: true
  },
  "State House District": { 
    querySyntax: "state+legislative+district+(lower+chamber)",
    code: "620",
    queryExample: "for=state+legislative+district+(lower+chamber):*&in=state:06",
    codeType: "STATE" as const,
    requiresFIPS: true,
    isHierarchical: true
  },
  "Public Use Microdata Area": { 
    querySyntax: "public+use+microdata+area",
    code: "795",
    queryExample: "for=public+use+microdata+area:*&in=state:06",
    codeType: "CENSUS" as const,
    requiresFIPS: true,
    isHierarchical: true
  },
  "Elementary School District": { 
    querySyntax: "school+district+(elementary)",
    code: "950",
    queryExample: "for=school+district+(elementary):*&in=state:06",
    codeType: "EDUCATION" as const,
    requiresFIPS: true,
    isHierarchical: true
  },
  "Secondary School District": { 
    querySyntax: "school+district+(secondary)",
    code: "960",
    queryExample: "for=school+district+(secondary):*&in=state:06",
    codeType: "EDUCATION" as const,
    requiresFIPS: true,
    isHierarchical: true
  },
  "Unified School District": { 
    querySyntax: "school+district+(unified)",
    code: "970",
    queryExample: "for=school+district+(unified):*&in=state:06",
    codeType: "EDUCATION" as const,
    requiresFIPS: true,
    isHierarchical: true
  }
};