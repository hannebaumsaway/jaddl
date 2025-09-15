# Contentful Setup Guide

## Creating a New Contentful Space

1. Go to [contentful.com](https://www.contentful.com) and sign up/login
2. Click "Create space"
3. Choose "Build from scratch"
4. Name your space: "JADDL Fantasy Football"
5. Choose your plan (Free plan works for development)

## Setting Up Content Types

You'll need to create these content types in Contentful:

### 1. News Article (`newsArticle`)

Fields:
- **title** (Short text, required)
- **slug** (Short text, required, unique)
- **summary** (Long text, required)
- **content** (Rich text, required)
- **featuredImage** (Media, optional)
- **author** (Short text, optional)
- **publishedDate** (Date & time, required)
- **tags** (Short text, list, optional)
- **featuredTeam** (Reference to Team Profile, optional)
- **isSticky** (Boolean, optional)
- **category** (Short text, validation: news, analysis, preview, recap, announcement)

### 2. JADDL Team (`jaddlTeam`)

Fields:
- **teamId** (Integer, required) - Unique team identifier **→ Maps to Supabase `team.id`**
- **teamName** (Short text, required) - Full team name
- **shortName** (Short text, required) - Team abbreviation
- **logo** (Media, optional) - Team logo (PNG or SVG)
- **yearEstablished** (Integer, optional) - Year team was established

**Important:** The `teamId` field is the key that links static team information in Contentful with dynamic sports data in Supabase. This ID must match the `id` field in your Supabase `teams` table.

### 3. League Announcement (`leagueAnnouncement`)

Fields:
- **title** (Short text, required)
- **message** (Rich text, required)
- **type** (Short text, validation: general, rules, schedule, playoff, draft)
- **priority** (Short text, validation: low, medium, high, urgent)
- **publishedDate** (Date & time, required)
- **expirationDate** (Date & time, optional)
- **targetAudience** (Short text, list, optional)
- **attachments** (Media, list, optional)

### 4. Historical Moment (`historicalMoment`)

Fields:
- **title** (Short text, required)
- **description** (Rich text, required)
- **season** (Integer, required)
- **week** (Integer, optional)
- **date** (Date & time, required)
- **involvedTeams** (Reference to Team Profile, list, optional)
- **photos** (Media, list, optional)
- **videos** (Media, list, optional)
- **category** (Short text, validation: championship, upset, record, milestone, funny, drama)
- **significance** (Short text, validation: league, team, individual)

## Getting API Keys

1. Go to **Settings** → **API keys**
2. Click **Add API key**
3. Name it "JADDL Website"
4. Copy these values:
   - **Space ID**: `NEXT_PUBLIC_CONTENTFUL_SPACE_ID`
   - **Content Delivery API - access token**: `NEXT_PUBLIC_CONTENTFUL_ACCESS_TOKEN`
   - **Content Preview API - access token**: `CONTENTFUL_PREVIEW_ACCESS_TOKEN`

## Content Model JSON

For faster setup, you can import this content model:

```json
{
  "contentTypes": [
    {
      "sys": {
        "id": "newsArticle"
      },
      "name": "News Article",
      "displayField": "title",
      "fields": [
        {
          "id": "title",
          "name": "Title",
          "type": "Symbol",
          "required": true
        },
        {
          "id": "slug",
          "name": "Slug",
          "type": "Symbol",
          "required": true,
          "validations": [{"unique": true}]
        },
        {
          "id": "summary",
          "name": "Summary",
          "type": "Text",
          "required": true
        },
        {
          "id": "content",
          "name": "Content",
          "type": "RichText",
          "required": true
        },
        {
          "id": "featuredImage",
          "name": "Featured Image",
          "type": "Link",
          "linkType": "Asset"
        },
        {
          "id": "author",
          "name": "Author",
          "type": "Symbol"
        },
        {
          "id": "publishedDate",
          "name": "Published Date",
          "type": "Date",
          "required": true
        },
        {
          "id": "tags",
          "name": "Tags",
          "type": "Array",
          "items": {
            "type": "Symbol"
          }
        },
        {
          "id": "isSticky",
          "name": "Is Sticky",
          "type": "Boolean"
        },
        {
          "id": "category",
          "name": "Category",
          "type": "Symbol",
          "validations": [
            {
              "in": ["news", "analysis", "preview", "recap", "announcement"]
            }
          ]
        }
      ]
    }
  ]
}
```
