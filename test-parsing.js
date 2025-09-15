#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { parseFilename, parseHtmlContent } = require('./migrate-to-contentful.js');

// Test with a sample file
const testFile = './migration/articles/2017/preseason/preseason_1.html';

if (fs.existsSync(testFile)) {
  console.log('🧪 Testing HTML parsing...');
  console.log(`File: ${testFile}`);
  console.log('');
  
  // Test filename parsing
  const { year, week } = parseFilename(path.basename(testFile), path.dirname(testFile));
  console.log(`📅 Parsed: Year ${year}, Week ${week}`);
  console.log('');
  
  // Test HTML parsing
  const htmlContent = fs.readFileSync(testFile, 'utf8');
  const { title, subtitle, richTextContent } = parseHtmlContent(htmlContent);
  
  console.log(`📰 Title: ${title}`);
  console.log(`📝 Subtitle: ${subtitle}`);
  console.log('');
  console.log('📄 Rich Text Content (first 500 chars):');
  console.log(JSON.stringify(richTextContent, null, 2).substring(0, 500) + '...');
  
} else {
  console.log('❌ Test file not found:', testFile);
}
