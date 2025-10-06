#!/bin/bash

# Fetch Aggregate Data Helper Script
# This script wraps the fetch-aggregate-data tool with a simplified interface

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Parse arguments
JSON_ONLY=false
DESCRIPTIVE=false
PREDICATES_ARGS=()
POSITIONAL_ARGS=()

while [[ $# -gt 0 ]]; do
    case $1 in
        --json)
            JSON_ONLY=true
            shift
            ;;
        -h|--help)
            echo "Usage: $0 <dataset> <year> <variables|group> [for] [in] [ucgid] [--descriptive] [--predicates key:value] [--json]"
            echo ""
            echo "Arguments:"
            echo "  dataset     (Required) Dataset identifier, e.g., 'acs/acs1'"
            echo "  year        (Required) Dataset vintage, e.g., 2022"
            echo "  get         (Required) Data to retrieve - specify either:"
            echo "    variables (Optional) Comma-separated variables, e.g., 'NAME,B01001_001E'"
            echo "    group     (Optional) Variable group identifier, e.g., 'S0101'"
            echo "  for         (Optional) Geography restriction, e.g., 'state:01,13'"
            echo "  in          (Optional) Constrains the 'for' geography to a parent geography"
            echo "  ucgid       (Optional) Uniform Census Geography Identifier"
            echo ""
            echo "Options:"
            echo "  --descriptive           Add variable labels to results"
            echo "  --predicates key:value  Additional filters (can be used multiple times)"
            echo "  --json                  Output only JSON (suitable for piping to jq)"
            echo "  -h, --help              Show this help message"
            echo ""
            echo "Examples:"
            echo "  # Using variables (comma-separated)"
            echo "  CENSUS_API_KEY=your_key $0 acs/acs1 2022 'NAME,B01001_001E'"
            echo "  CENSUS_API_KEY=your_key $0 acs/acs1 2022 'NAME,B01001_001E' 'state:01,13'"
            echo "  CENSUS_API_KEY=your_key $0 acs/acs1 2022 'NAME,B01001_001E' --descriptive"
            echo ""
            echo "  # Using a group (single identifier)"
            echo "  CENSUS_API_KEY=your_key $0 acs/acs1 2022 'S0101'"
            echo "  CENSUS_API_KEY=your_key $0 acs/acs1 2022 'S0101' 'state:*'"
            echo ""
            echo "  # JSON output (pipe to jq)"
            echo "  CENSUS_API_KEY=your_key $0 acs/acs1 2022 'NAME,B01001_001E' --json | jq '.result'"
            echo ""
            echo "Environment:"
            echo "  CENSUS_API_KEY must be set"
            exit 0
            ;;
        --descriptive)
            DESCRIPTIVE=true
            shift
            ;;
        --predicates)
            if [ -n "$2" ]; then
                PREDICATES_ARGS+=("$2")
                shift 2
            else
                echo "Error: --predicates requires a key:value pair" >&2
                exit 1
            fi
            ;;
        -*)
            echo "Unknown option: $1" >&2
            exit 1
            ;;
        *)
            POSITIONAL_ARGS+=("$1")
            shift
            ;;
    esac
done

# Restore positional parameters
set -- "${POSITIONAL_ARGS[@]}"

# Check if CENSUS_API_KEY is provided
if [ -z "$CENSUS_API_KEY" ]; then
    echo "Error: CENSUS_API_KEY environment variable is required" >&2
    echo "Usage: CENSUS_API_KEY=your_key $0 <dataset> <year> <variables|group> [for] [in] [ucgid] [--descriptive] [--predicates key:value] [--json]" >&2
    exit 1
fi

# Check for required arguments
if [ $# -lt 3 ]; then
    echo "Error: Dataset, year, and variables/group arguments are required" >&2
    echo "Usage: $0 <dataset> <year> <variables|group> [for] [in] [ucgid] [--descriptive] [--predicates key:value] [--json]" >&2
    exit 1
fi

DATASET="$1"
YEAR="$2"
GET_PARAM="$3"
FOR_PARAM="$4"
IN_PARAM="$5"
UCGID_PARAM="$6"

# Determine if GET_PARAM is variables (comma-separated) or group (single value)
# If it contains a comma, treat it as variables; otherwise, treat as group
if [[ "$GET_PARAM" == *","* ]]; then
    # Convert comma-separated variables to JSON array
    IFS=',' read -ra VAR_ARRAY <<< "$GET_PARAM"
    VARS_JSON="["
    for i in "${!VAR_ARRAY[@]}"; do
        if [ "$i" -gt 0 ]; then
            VARS_JSON+=","
        fi
        VARS_JSON+="\"${VAR_ARRAY[i]}\""
    done
    VARS_JSON+="]"
    GET_JSON="\"variables\":$VARS_JSON"
    GET_TYPE="variables"
    GET_DISPLAY="$GET_PARAM"
else
    # Treat as group
    GET_JSON="\"group\":\"$GET_PARAM\""
    GET_TYPE="group"
    GET_DISPLAY="$GET_PARAM"
fi

# Build arguments JSON
ARGS_JSON="{\"dataset\":\"$DATASET\",\"year\":$YEAR,\"get\":{$GET_JSON}"

# Add optional parameters
if [ -n "$FOR_PARAM" ]; then
    ARGS_JSON+=",\"for\":\"$FOR_PARAM\""
fi

if [ -n "$IN_PARAM" ]; then
    ARGS_JSON+=",\"in\":\"$IN_PARAM\""
fi

if [ -n "$UCGID_PARAM" ]; then
    ARGS_JSON+=",\"ucgid\":\"$UCGID_PARAM\""
fi

if [ "$DESCRIPTIVE" = true ]; then
    ARGS_JSON+=",\"descriptive\":true"
fi

# Add predicates if provided
if [ ${#PREDICATES_ARGS[@]} -gt 0 ]; then
    PREDICATES_JSON="{"
    for i in "${!PREDICATES_ARGS[@]}"; do
        if [ $i -gt 0 ]; then
            PREDICATES_JSON+=","
        fi
        # Split key:value pair
        KEY="${PREDICATES_ARGS[i]%%:*}"
        VALUE="${PREDICATES_ARGS[i]#*:}"
        PREDICATES_JSON+="\"$KEY\":\"$VALUE\""
    done
    PREDICATES_JSON+="}"
    ARGS_JSON+=",\"predicates\":$PREDICATES_JSON"
fi

ARGS_JSON+="}"

# Build complete JSON payload
JSON_PAYLOAD="{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"tools/call\",\"params\":{\"name\":\"fetch-aggregate-data\",\"arguments\":$ARGS_JSON}}"

# Change to project directory
cd "$PROJECT_DIR" || exit

# Ensure services are running
docker compose --profile prod up -d >/dev/null 2>&1
sleep 3

if [ "$JSON_ONLY" = false ]; then
    echo "Fetching aggregate data for dataset: $DATASET (year: $YEAR)"
    if [ "$GET_TYPE" = "variables" ]; then
        echo "Variables: $GET_DISPLAY"
    else
        echo "Group: $GET_DISPLAY"
    fi
    [ -n "$FOR_PARAM" ] && echo "For: $FOR_PARAM"
    [ -n "$IN_PARAM" ] && echo "In: $IN_PARAM"
    [ -n "$UCGID_PARAM" ] && echo "UCGID: $UCGID_PARAM"
    [ "$DESCRIPTIVE" = true ] && echo "Descriptive labels: enabled"
    [ ${#PREDICATES_ARGS[@]} -gt 0 ] && echo "Predicates: ${PREDICATES_ARGS[*]}"
    echo ""
fi

echo "$JSON_PAYLOAD" | \
docker exec -i -e CENSUS_API_KEY="$CENSUS_API_KEY" mcp-server node dist/index.js