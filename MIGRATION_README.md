# JADDL Articles Migration to Contentful

This script migrates HTML blog posts from the `./migration/articles/` directory to Contentful.

## Prerequisites

1. **Contentful Setup**: Ensure you have a Contentful space with a content type called "JADDL Article"
2. **Environment Variables**: Create a `.env.local` file with your Contentful credentials:
   ```
   NEXT_PUBLIC_CONTENTFUL_SPACE_ID=your_space_id
   NEXT_PUBLIC_CONTENTFUL_ACCESS_TOKEN=your_management_token
   CONTENTFUL_ENVIRONMENT=master
   ```

## Content Type Requirements

Your Contentful content type "JADDL Article" should have these fields:
- `title` (Short text)
- `subtitle` (Short text) 
- `content` (Rich text)
- `year` (Number)
- `week` (Number)

## Installation

Install the required dependencies:
```bash
pnpm install
```

## Usage

### Test the parsing (recommended first step)
```bash
node test-parsing.js
```

### Run the full migration
```bash
pnpm run migrate
```

## What the Script Does

1. **Reads HTML files** from `./migration/articles/` directory recursively
2. **Parses each file** to extract:
   - Title from `#headline` div
   - Subtitle from `.tagline` div
   - Content from `#article` div
   - Year and week from filename/directory structure
3. **Converts HTML to Rich Text** format for Contentful
4. **Creates entries** in Contentful with proper field mapping
5. **Handles special cases**:
   - Preseason/draft files → Week 0
   - Section headers become H2 headings
   - Ignores cover images (will be added manually later)
6. **Rate limiting** with 1-second delays between requests
7. **Error handling** and progress logging

## Filename Parsing Rules

- **Regular format**: `3_1.html` → Year: 2017, Week: 3
- **Preseason files**: `preseason_1.html` → Year: 2017, Week: 0
- **Draft files**: `draft_2.html` → Year: 2017, Week: 0
- **Year extraction**: From directory structure (e.g., `./migration/articles/2017/wk_3/3_1.html`)

## HTML Structure Expected

```html
<div id="headline">Article Title</div>
<div class="tagline">Article Subtitle</div>
<div id="article">
  <img class="cover" src="..." /> <!-- Will be ignored -->
  Article content with <br> tags for paragraphs
  <div class="section-header">Section Title</div> <!-- Becomes H2 -->
  More content...
</div>
```

## Output

The script will:
- Log progress for each file processed
- Show success/error counts at the end
- Create and publish entries in Contentful
- Handle rate limiting automatically

## Troubleshooting

- **Missing environment variables**: Check your `.env.local` file
- **Content type not found**: Ensure "JADDL Article" content type exists
- **Rate limiting errors**: The script includes delays, but you may need to increase them
- **Parsing errors**: Check the HTML structure matches expected format

## Files Created

- `migrate-to-contentful.js` - Main migration script
- `test-parsing.js` - Test script for HTML parsing
- `MIGRATION_README.md` - This documentation
