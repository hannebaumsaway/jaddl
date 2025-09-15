#!/usr/bin/env node

const { createClient } = require('contentful-management');
require('dotenv').config({ path: '.env.local' });

// Configuration
const CONTENTFUL_SPACE_ID = process.env.NEXT_PUBLIC_CONTENTFUL_SPACE_ID;
const CONTENTFUL_ACCESS_TOKEN = process.env.CONTENTFUL_MANAGEMENT_TOKEN;
const CONTENTFUL_ENVIRONMENT = process.env.CONTENTFUL_ENVIRONMENT || 'master';
const CONTENT_TYPE_ID = 'jaddlArticle';

// Initialize Contentful client
const client = createClient({
  accessToken: CONTENTFUL_ACCESS_TOKEN,
});

// Comprehensive NFL player database (focusing on players mentioned in JADDL articles)
const NFL_PLAYERS = {
  // Quarterbacks
  'Tom Brady': ['Tom Brady', 'Brady', 'Tom fucking Brady'],
  'Aaron Rodgers': ['Aaron Rodgers', 'Rodgers', 'A-Rod'],
  'Patrick Mahomes': ['Patrick Mahomes', 'Mahomes'],
  'Josh Allen': ['Josh Allen', 'Allen'],
  'Lamar Jackson': ['Lamar Jackson', 'Lamar'],
  'Kyler Murray': ['Kyler Murray', 'Murray'],
  'Justin Herbert': ['Justin Herbert', 'Herbert'],
  'Matthew Stafford': ['Matthew Stafford', 'Stafford', 'Matthew "Not a Lion Anymore" Stafford'],
  'Ryan Fitzpatrick': ['Ryan Fitzpatrick', 'Fitzpatrick', 'Ryan "Still in the League" Fitzmagic', 'Fitzmagic'],
  'Jameis Winston': ['Jameis Winston', 'Winston', 'Famous Jameis'],
  'Ben Roethlisberger': ['Ben Roethlisberger', 'Roethlisberger', 'Big Ben'],
  'Jalen Hurts': ['Jalen Hurts', 'Hurts'],
  'Derek Carr': ['Derek Carr', 'Carr'],
  'Kirk Cousins': ['Kirk Cousins', 'Cousins'],
  'Joe Burrow': ['Joe Burrow', 'Burrow'],
  'Carson Wentz': ['Carson Wentz', 'Wentz'],
  'Teddy Bridgewater': ['Teddy Bridgewater', 'Bridgewater'],
  'Taylor Heinicke': ['Taylor Heinicke', 'Heinicke'],
  'Daniel Jones': ['Daniel Jones', 'Daniel Jones'],
  
  // Running Backs
  'Todd Gurley': ['Todd Gurley', 'Gurley'],
  'Saquon Barkley': ['Saquon Barkley', 'Barkley', 'Saquon'],
  'Christian McCaffrey': ['Christian McCaffrey', 'McCaffrey', 'C-Mac'],
  'Ezekiel Elliott': ['Ezekiel Elliott', 'Ezekiel Elliott', 'Zeke Elliott', 'Zeke'],
  'Derrick Henry': ['Derrick Henry', 'Henry', 'King Henry'],
  'Alvin Kamara': ['Alvin Kamara', 'Kamara'],
  'Nick Chubb': ['Nick Chubb', 'Chubb'],
  'Austin Ekeler': ['Austin Ekeler', 'Ekeler'],
  'Jonathan Taylor': ['Jonathan Taylor', 'Taylor'],
  'Leonard Fournette': ['Leonard Fournette', 'Fournette'],
  'Najee Harris': ['Najee Harris', 'Harris'],
  'Raheem Mostert': ['Raheem Mostert', 'Mostert'],
  'David Montgomery': ['David Montgomery', 'Montgomery'],
  'Mike Gillislee': ['Mike Gillislee', 'Gillislee'],
  'Cordarrelle Patterson': ['Cordarrelle Patterson', 'Patterson'],
  'Josh Jacobs': ['Josh Jacobs', 'Jacobs'],
  'Joe Mixon': ['Joe Mixon', 'Mixon'],
  'James Conner': ['James Conner', 'Conner'],
  'Ty\'Son Williams': ['Ty\'Son Williams', 'Williams'],
  
  // Wide Receivers
  'Tyreek Hill': ['Tyreek Hill', 'Hill'],
  'Davante Adams': ['Davante Adams', 'Adams'],
  'Stefon Diggs': ['Stefon Diggs', 'Diggs'],
  'CeeDee Lamb': ['CeeDee Lamb', 'Lamb', 'CeeDee "Not C.D." Lamb'],
  'Amari Cooper': ['Amari Cooper', 'Cooper'],
  'Antonio Brown': ['Antonio Brown', 'Brown'],
  'Terry McLaurin': ['Terry McLaurin', 'McLaurin'],
  'Corey Davis': ['Corey Davis', 'Davis'],
  'DK Metcalf': ['DK Metcalf', 'Metcalf'],
  'Justin Jefferson': ['Justin Jefferson', 'Jefferson'],
  'JuJu Smith-Schuster': ['JuJu Smith-Schuster', 'Smith-Schuster', 'JuJu'],
  'Jarvis Landry': ['Jarvis Landry', 'Landry'],
  
  // Tight Ends
  'Darren Waller': ['Darren Waller', 'Waller'],
  'Mark Andrews': ['Mark Andrews', 'Andrews'],
  'Rob Gronkowski': ['Rob Gronkowski', 'Gronkowski', 'Gronk'],
  'Travis Kelce': ['Travis Kelce', 'Kelce'],
  'Noah Fant': ['Noah Fant', 'Fant'],
  'Juwan Johnson': ['Juwan Johnson', 'Johnson'],
  
  // Kickers
  'Justin Tucker': ['Justin Tucker', 'Tucker'],
  'Younghoe Koo': ['Younghoe Koo', 'Younghoe'],
  'Dan Carlson': ['Dan Carlson', 'Carlson', 'Dan "Romans" Carlson'],
  
  // Defense/Special Teams
  'Browns D/ST': ['Browns D/ST', 'Browns Defense'],
  
  // Historical Players
  'LaDainian Tomlinson': ['LaDainian Tomlinson', 'Tomlinson', 'LT'],
};

// Function to extract player names from text
function extractPlayerNames(text) {
  const foundPlayers = new Set();
  const lowerText = text.toLowerCase();
  
  // Check each player and their aliases
  for (const [playerName, aliases] of Object.entries(NFL_PLAYERS)) {
    for (const alias of aliases) {
      const lowerAlias = alias.toLowerCase();
      if (lowerText.includes(lowerAlias)) {
        foundPlayers.add(playerName);
        break; // Found this player, no need to check other aliases
      }
    }
  }
  
  return Array.from(foundPlayers);
}

// Function to update an article with tags
async function updateArticleWithTags(entry) {
  try {
    const title = entry.fields.title?.['en-US'] || '';
    const content = entry.fields.content?.['en-US'] || {};
    
    // Extract text from Rich Text content
    let articleText = '';
    if (content.content) {
      content.content.forEach(node => {
        if (node.nodeType === 'paragraph' && node.content) {
          node.content.forEach(textNode => {
            if (textNode.nodeType === 'text') {
              articleText += textNode.value + ' ';
            }
          });
        } else if (node.nodeType === 'heading-2' && node.content) {
          node.content.forEach(textNode => {
            if (textNode.nodeType === 'text') {
              articleText += textNode.value + ' ';
            }
          });
        }
      });
    }
    
    // Combine title and content for player extraction
    const fullText = title + ' ' + articleText;
    
    // Extract player names
    const playerNames = extractPlayerNames(fullText);
    
    // Limit to 5 most relevant players to avoid over-tagging
    const tags = playerNames.slice(0, 5);
    
    if (tags.length > 0) {
      console.log(`📝 Adding tags to "${title}": ${tags.join(', ')}`);
      
      // Update the entry with tags
      entry.fields.tags = {
        'en-US': tags
      };
      
      // Save the entry
      const updatedEntry = await entry.update();
      await updatedEntry.publish();
      
      return true;
    } else {
      console.log(`⏭️ No players found in "${title}"`);
      return false;
    }
    
  } catch (error) {
    console.error(`❌ Error updating entry:`, error.message);
    return false;
  }
}

// Main function to add tags to all articles
async function addTagsToArticles() {
  try {
    console.log('🏷️ Starting to add player tags to JADDL articles...');
    console.log(`Space ID: ${CONTENTFUL_SPACE_ID}`);
    console.log(`Environment: ${CONTENTFUL_ENVIRONMENT}`);
    console.log('');
    
    // Get Contentful space
    const space = await client.getSpace(CONTENTFUL_SPACE_ID);
    const environment = await space.getEnvironment(CONTENTFUL_ENVIRONMENT);
    
    // Get all JADDL Article entries
    let skip = 0;
    const limit = 100;
    let totalProcessed = 0;
    let totalUpdated = 0;
    
    while (true) {
      const entries = await environment.getEntries({
        content_type: CONTENT_TYPE_ID,
        limit: limit,
        skip: skip
      });
      
      if (entries.items.length === 0) {
        break;
      }
      
      console.log(`\n📄 Processing batch ${Math.floor(skip / limit) + 1} (${entries.items.length} entries)...`);
      
      for (const entry of entries.items) {
        const wasUpdated = await updateArticleWithTags(entry);
        totalProcessed++;
        if (wasUpdated) {
          totalUpdated++;
        }
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      skip += limit;
    }
    
    console.log('\n🎉 Tag addition completed!');
    console.log(`✅ Total articles processed: ${totalProcessed}`);
    console.log(`🏷️ Articles updated with tags: ${totalUpdated}`);
    
  } catch (error) {
    console.error('💥 Error adding tags:', error.message);
    process.exit(1);
  }
}

// Run if this script is executed directly
if (require.main === module) {
  addTagsToArticles();
}
