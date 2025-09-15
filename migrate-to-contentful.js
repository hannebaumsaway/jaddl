#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { createClient } = require('contentful-management');
const cheerio = require('cheerio');
const TurndownService = require('turndown');
require('dotenv').config({ path: '.env.local' });

// Configuration
const CONTENTFUL_SPACE_ID = process.env.NEXT_PUBLIC_CONTENTFUL_SPACE_ID;
const CONTENTFUL_ACCESS_TOKEN = process.env.CONTENTFUL_MANAGEMENT_TOKEN;
const CONTENTFUL_ENVIRONMENT = process.env.CONTENTFUL_ENVIRONMENT || 'master';
const CONTENT_TYPE_ID = 'jaddlArticle';
const ARTICLES_DIR = './migration/articles';

// Initialize Contentful client
const client = createClient({
  accessToken: CONTENTFUL_ACCESS_TOKEN,
});

// Initialize Turndown service for HTML to Markdown conversion
const turndownService = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
});

// Rate limiting helper
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Parse filename to extract year and week
function parseFilename(filename, directoryPath) {
  const basename = path.basename(filename, '.html');
  
  // Extract year from the full path - look for year directories
  const pathParts = directoryPath.split(path.sep);
  let year = null;
  
  // Find the year in the path (look for 4-digit numbers)
  for (const part of pathParts) {
    if (/^\d{4}$/.test(part)) {
      year = parseInt(part);
      break;
    }
  }
  
  // If no year found in path, try to extract from filename or use current year as fallback
  if (!year) {
    year = new Date().getFullYear();
  }
  
  // Handle preseason and draft files
  if (basename.includes('preseason') || basename.includes('draft')) {
    return { year, week: 0 };
  }
  
  // Handle regular format like "3_1.html"
  const parts = basename.split('_');
  if (parts.length >= 2) {
    const week = parseInt(parts[0]);
    return { year, week: week || 0 };
  }
  
  // Fallback
  return { year, week: 0 };
}

// Parse HTML content
function parseHtmlContent(htmlContent) {
  const $ = cheerio.load(htmlContent);
  
  // Extract title from #headline
  const title = $('#headline').text().trim();
  
  // Extract subtitle from .tagline
  const subtitle = $('.tagline').text().trim();
  
  // Extract article content from #article
  const articleDiv = $('#article');
  
  // Remove cover images
  articleDiv.find('img.cover').remove();
  
  // Convert section headers to proper headings
  articleDiv.find('.section-header').each(function() {
    const $this = $(this);
    const text = $this.text().trim();
    $this.replaceWith(`<h2>${text}</h2>`);
  });
  
  // Get the cleaned HTML content
  const articleHtml = articleDiv.html();
  
  // Convert HTML to Contentful Rich Text
  const richTextContent = htmlToRichText(articleHtml);
  
  return {
    title,
    subtitle,
    richTextContent
  };
}

// Convert HTML directly to Contentful Rich Text
function htmlToRichText(html) {
  const $ = cheerio.load(html);
  const content = [];
  
  // Split content by <br> tags and process each section
  const sections = html.split(/<br\s*\/?>/i);
  
  for (const section of sections) {
    const $section = cheerio.load(section);
    const text = $section.text().trim();
    
    if (!text) continue;
    
    // Check if this section contains a heading
    const $heading = $section('h1, h2, h3, .section-header');
    if ($heading.length > 0) {
      const headingText = $heading.text().trim();
      if (headingText) {
        content.push({
          nodeType: 'heading-2',
          data: {},
          content: [{
            nodeType: 'text',
            value: headingText,
            marks: [],
            data: {}
          }]
        });
      }
    } else {
      // Regular paragraph
      const paragraphContent = [];
      
      // Process the text and handle inline formatting
      const processedText = processInlineFormatting(text);
      paragraphContent.push({
        nodeType: 'text',
        value: processedText,
        marks: [],
        data: {}
      });
      
      if (paragraphContent.length > 0) {
        content.push({
          nodeType: 'paragraph',
          data: {},
          content: paragraphContent
        });
      }
    }
  }
  
  // If no content was processed, create a single paragraph with all text
  if (content.length === 0) {
    const allText = $.text().trim();
    if (allText) {
      content.push({
        nodeType: 'paragraph',
        data: {},
        content: [{
          nodeType: 'text',
          value: allText,
          marks: [],
          data: {}
        }]
      });
    }
  }
  
  return {
    nodeType: 'document',
    content
  };
}

// Helper function to process inline formatting
function processInlineFormatting(text) {
  // For now, just return the text as-is
  // In a more sophisticated version, you could parse <em>, <strong>, etc.
  return text;
}

// Create Contentful entry
async function createContentfulEntry(space, data) {
  try {
    const entry = await space.createEntry(CONTENT_TYPE_ID, {
      fields: {
        title: {
          'en-US': data.title
        },
        subtitle: {
          'en-US': data.subtitle
        },
        content: {
          'en-US': {
            nodeType: 'document',
            data: {},
            content: data.richTextContent.content
          }
        },
        year: {
          'en-US': data.year
        },
        week: {
          'en-US': data.week
        }
      }
    });
    
    // Publish the entry
    await entry.publish();
    
    return entry;
  } catch (error) {
    console.error('Error creating entry:', error);
    throw error;
  }
}

// Process a single HTML file
async function processFile(filePath, space) {
  try {
    console.log(`Processing: ${filePath}`);
    
    // Read file content
    const htmlContent = fs.readFileSync(filePath, 'utf8');
    
    // Parse filename for year/week
    const { year, week } = parseFilename(path.basename(filePath), path.dirname(filePath));
    
    // Parse HTML content
    const { title, subtitle, richTextContent } = parseHtmlContent(htmlContent);
    
    if (!title) {
      console.warn(`Skipping ${filePath}: No title found`);
      return null;
    }
    
    // Check if entry already exists
    const existingEntries = await space.getEntries({
      content_type: 'jaddlArticle',
      'fields.title': title,
      'fields.year': year,
      'fields.week': week
    });
    
    if (existingEntries.total > 0) {
      console.log(`⏭️ Skipping ${filePath}: Entry already exists (${title})`);
      return null;
    }
    
    // Create entry data
    const entryData = {
      title,
      subtitle,
      richTextContent,
      year,
      week
    };
    
    // Create Contentful entry
    const entry = await createContentfulEntry(space, entryData);
    
    console.log(`✅ Created entry: ${title} (${year}, Week ${week}) - ID: ${entry.sys.id}`);
    
    return entry;
  } catch (error) {
    console.error(`❌ Error processing ${filePath}:`, error.message);
    return null;
  }
}

// Get all HTML files recursively
function getAllHtmlFiles(dir) {
  const files = [];
  
  function traverse(currentDir) {
    const items = fs.readdirSync(currentDir);
    
    for (const item of items) {
      const fullPath = path.join(currentDir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        traverse(fullPath);
      } else if (item.endsWith('.html')) {
        files.push(fullPath);
      }
    }
  }
  
  traverse(dir);
  return files;
}

// Main migration function
async function migrate() {
  try {
    console.log('🚀 Starting JADDL Articles migration to Contentful...');
    console.log(`Space ID: ${CONTENTFUL_SPACE_ID}`);
    console.log(`Environment: ${CONTENTFUL_ENVIRONMENT}`);
    console.log(`Content Type: ${CONTENT_TYPE_ID}`);
    console.log('');
    
    // Validate environment variables
    if (!CONTENTFUL_SPACE_ID || !CONTENTFUL_ACCESS_TOKEN) {
      throw new Error('Missing required environment variables. Please check your .env.local file.');
    }
    
    // Get Contentful space
    const space = await client.getSpace(CONTENTFUL_SPACE_ID);
    const environment = await space.getEnvironment(CONTENTFUL_ENVIRONMENT);
    
    // Get all HTML files
    const htmlFiles = getAllHtmlFiles(ARTICLES_DIR);
    console.log(`Found ${htmlFiles.length} HTML files to process`);
    console.log('');
    
    let successCount = 0;
    let errorCount = 0;
    
    // Process files with rate limiting
    for (let i = 0; i < htmlFiles.length; i++) {
      const filePath = htmlFiles[i];
      
      try {
        console.log(`\n📄 Processing file ${i + 1}/${htmlFiles.length}: ${filePath}`);
        const result = await processFile(filePath, environment);
        
        if (result) {
          successCount++;
          console.log(`✅ Success! Total processed: ${successCount}`);
        } else {
          errorCount++;
          console.log(`⚠️ Skipped! Total errors: ${errorCount}`);
        }
        
        // Rate limiting - wait 1 second between requests
        if (i < htmlFiles.length - 1) {
          console.log('⏳ Waiting 1 second before next file...');
          await delay(1000);
        }
        
      } catch (error) {
        console.error(`❌ Failed to process ${filePath}:`, error.message);
        console.error('Full error:', error);
        errorCount++;
        
        // If we get too many errors in a row, stop
        if (errorCount > 10) {
          console.error('💥 Too many errors, stopping migration');
          break;
        }
      }
    }
    
    console.log('');
    console.log('🎉 Migration completed!');
    console.log(`✅ Successfully processed: ${successCount} files`);
    console.log(`❌ Errors: ${errorCount} files`);
    
  } catch (error) {
    console.error('💥 Migration failed:', error.message);
    process.exit(1);
  }
}

// Run migration if this script is executed directly
if (require.main === module) {
  migrate();
}

module.exports = { migrate, parseFilename, parseHtmlContent };
