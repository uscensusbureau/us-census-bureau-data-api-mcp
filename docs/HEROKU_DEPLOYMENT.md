# Deploying US Census MCP Server to Heroku

This guide walks you through deploying the US Census Bureau Data API MCP Server to Heroku and connecting it to Claude.ai as a custom connector.

## Prerequisites

1. **Heroku Account**: Sign up at [heroku.com](https://heroku.com)
2. **Heroku CLI**: Install from [devcenter.heroku.com/articles/heroku-cli](https://devcenter.heroku.com/articles/heroku-cli)
3. **Git**: Ensure Git is installed and configured
4. **Census API Key**: Get one free at [api.census.gov/data/key_signup.html](https://api.census.gov/data/key_signup.html)

## Deployment Methods

### Method 1: One-Click Deploy (Recommended)

[![Deploy to Heroku](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy?template=https://github.com/uscensusbureau/us-census-bureau-data-api-mcp)

Click the button above and fill in:
- **App name**: Choose a unique name (e.g., `your-census-mcp`)
- **CENSUS_API_KEY**: Your Census Bureau API key

### Method 2: Manual Deployment

#### Step 1: Clone the Repository

```bash
git clone https://github.com/uscensusbureau/us-census-bureau-data-api-mcp.git
cd us-census-bureau-data-api-mcp
```

#### Step 2: Create Heroku App

```bash
# Login to Heroku
heroku login

# Create a new Heroku app with a unique name
heroku create your-census-mcp-server

# Add PostgreSQL database
heroku addons:create heroku-postgresql:essential-0
```

#### Step 3: Configure Environment Variables

```bash
# Set your Census API key
heroku config:set CENSUS_API_KEY=your_census_api_key_here

# Set Node environment
heroku config:set NODE_ENV=production

# Optional: Set seed mode (lite for faster init, full for complete data)
heroku config:set SEED_MODE=lite

# Optional: Enable debug logs
heroku config:set DEBUG_LOGS=false
```

#### Step 4: Deploy to Heroku

```bash
# Add Heroku remote (if not already added)
git remote add heroku https://git.heroku.com/your-census-mcp-server.git

# Deploy the FastMCP branch
git push heroku feature/fastmcp-heroku-deployment:main

# Or if on main branch
git push heroku main
```

#### Step 5: Verify Deployment

```bash
# Check logs
heroku logs --tail

# Open the app
heroku open

# Test the health endpoint
curl https://your-census-mcp-server.herokuapp.com/health
```

Expected response:
```json
{
  "status": "ok",
  "server": "census-mcp",
  "transport": "httpStream",
  "version": "1.0.0"
}
```

## Connecting to Claude.ai

### Step 1: Get Your Server URL

Your MCP server URL will be:
```
https://your-census-mcp-server.herokuapp.com/mcp
```

### Step 2: Add Custom Connector in Claude.ai

1. Open Claude.ai
2. Go to Settings → Custom Connectors
3. Click "Add Connector"
4. Fill in:
   - **Name**: US Census Data
   - **Remote MCP Server URL**: `https://your-census-mcp-server.herokuapp.com/mcp`
   - **Description**: Access US Census Bureau data
5. Click "Add"

### Step 3: Test the Connection

In a new Claude conversation, try:
- "What datasets are available from the Census API?"
- "Get population data for California"
- "Show me demographic data for New York City from 2020"

## Available Endpoints

Once deployed, your server provides:

- **MCP Endpoint**: `https://your-app.herokuapp.com/mcp` - For Claude.ai connection
- **SSE Endpoint**: `https://your-app.herokuapp.com/sse` - Alternative transport
- **Health Check**: `https://your-app.herokuapp.com/health` - Server status
- **Info Page**: `https://your-app.herokuapp.com/` - Server information

## Available Tools

The server provides these MCP tools:

1. **list-datasets**: Browse available Census datasets
2. **fetch-dataset-geography**: Get geographic levels for a dataset
3. **fetch-aggregate-data**: Retrieve Census data with filtering
4. **resolve-geography-fips**: Search and resolve geographic FIPS codes

## Available Prompts

- **get_population_data**: Get population statistics for geographic areas

## Troubleshooting

### Database Connection Issues

If you see database errors:
```bash
# Check database status
heroku pg:info

# Run migrations manually
heroku run bash
cd mcp-db
npm run migrate:up
```

### Census API Key Issues

Verify your API key:
```bash
# Check if key is set
heroku config:get CENSUS_API_KEY

# Update if needed
heroku config:set CENSUS_API_KEY=new_key_here
```

### Server Not Starting

Check logs for errors:
```bash
heroku logs --tail -n 100
```

Common fixes:
- Ensure Node.js buildpack is set: `heroku buildpacks:set heroku/nodejs`
- Check memory usage: `heroku ps`
- Restart dynos: `heroku restart`

### Claude.ai Connection Issues

If Claude can't connect:
1. Verify server is running: `curl https://your-app.herokuapp.com/health`
2. Check CORS is configured for `https://claude.ai`
3. Ensure URL ends with `/mcp` (not `/sse`)
4. Try removing and re-adding the connector

## Monitoring and Maintenance

### View Logs
```bash
heroku logs --tail
```

### Check App Status
```bash
heroku ps
```

### Scale Dynos
```bash
# Scale to 2 dynos for better performance
heroku ps:scale web=2
```

### Database Maintenance
```bash
# View database info
heroku pg:info

# Create backup
heroku pg:backups:capture

# View backups
heroku pg:backups
```

## Cost Considerations

### Free/Low-Cost Setup
- **Web Dyno**: Basic ($7/month) or Eco ($5/month)
- **Database**: Essential-0 ($5/month)
- **Total**: ~$10-12/month

### Production Setup
- **Web Dyno**: Standard-1X ($25/month)
- **Database**: Essential-1 ($15/month)
- **Total**: ~$40/month

## Security Notes

1. **API Key Security**: Never commit your Census API key to Git
2. **Database SSL**: Automatically configured for Heroku PostgreSQL
3. **HTTPS Only**: Heroku enforces HTTPS for all connections
4. **Environment Variables**: Use `heroku config` for sensitive data

## Advanced Configuration

### Custom Domain
```bash
heroku domains:add census-mcp.yourdomain.com
```

### Auto-scaling
```bash
heroku ps:autoscale:enable web --min 1 --max 3
```

### Performance Monitoring
```bash
heroku addons:create newrelic:wayne
```

## Support

- **Census API Issues**: [Census Bureau Support](https://www.census.gov/data/developers/support.html)
- **Heroku Issues**: [Heroku Support](https://devcenter.heroku.com/support)
- **MCP Server Issues**: [GitHub Issues](https://github.com/uscensusbureau/us-census-bureau-data-api-mcp/issues)

## Next Steps

1. Test all MCP tools through Claude.ai
2. Monitor usage and performance
3. Set up alerting for errors
4. Consider implementing caching for frequently accessed data
5. Review and optimize database queries

## License

This project is open source and available under the MIT License.