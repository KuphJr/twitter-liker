// Load environment variables from .env file
import dotenv from 'dotenv';
dotenv.config();

// Ensure required environment variables are present
function getRequiredEnvVar(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

// Read configuration from environment variables
const TWEET_ID = getRequiredEnvVar('TWEET_ID');
const AUTH_TOKEN = getRequiredEnvVar('AUTH_TOKEN');
const CSRF_TOKEN = getRequiredEnvVar('CSRF_TOKEN');
const USER_AGENT = getRequiredEnvVar('USER_AGENT');
const FRONTEND_BEARER = getRequiredEnvVar('FRONTEND_BEARER');

const HEADERS = {
  'authorization': FRONTEND_BEARER,
  'x-csrf-token': CSRF_TOKEN,
  'cookie': `auth_token=${AUTH_TOKEN}; ct0=${CSRF_TOKEN};`,
  'user-agent': USER_AGENT,
  'content-type': 'application/json',
  'accept': '*/*',
  'referer': `https://x.com/`,
};

// Utility: random delay between 1.7s–2.5s
function randomDelay(): Promise<void> {
  const delay = 1700 + Math.random() * 800;
  return new Promise((resolve) => setTimeout(resolve, delay));
}

/**
 * Simple function to fetch replies to a tweet
 */
async function getReplies(tweetId: string): Promise<string[]> {
  const replyTweetIds: string[] = [];
  let cursor: string | null = null;
  let hasMore = true;
  
  console.log(`Starting to fetch replies for tweet ${tweetId}`);
  
  // Continue fetching while there are more pages
  while (hasMore) {
    // Basic variables for the GraphQL request
    const variables: any = {
      focalTweetId: tweetId,
      with_rux_injections: false,
      includePromotedContent: true,
      withCommunity: true,
      withQuickPromoteEligibilityTweetFields: true,
      withBirdwatchNotes: true,
      withVoice: true,
      withV2Timeline: true
    };
    
    // Add cursor for pagination if available
    if (cursor) {
      variables.cursor = cursor;
    }
    
    // Features parameter is required by the API
    const features = {
      rweb_video_screen_enabled: false,
      profile_label_improvements_pcf_label_in_post_enabled: true,
      rweb_tipjar_consumption_enabled: true,
      responsive_web_graphql_exclude_directive_enabled: true,
      verified_phone_label_enabled: false,
      creator_subscriptions_tweet_preview_api_enabled: true,
      responsive_web_graphql_timeline_navigation_enabled: true,
      responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
      premium_content_api_read_enabled: false,
      communities_web_enable_tweet_community_results_fetch: true,
      c9s_tweet_anatomy_moderator_badge_enabled: true,
      responsive_web_grok_analyze_button_fetch_trends_enabled: false,
      responsive_web_grok_analyze_post_followups_enabled: true,
      responsive_web_jetfuel_frame: false,
      responsive_web_grok_share_attachment_enabled: true,
      articles_preview_enabled: true,
      responsive_web_edit_tweet_api_enabled: true,
      graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
      view_counts_everywhere_api_enabled: true,
      longform_notetweets_consumption_enabled: true,
      responsive_web_twitter_article_tweet_consumption_enabled: true,
      tweet_awards_web_tipping_enabled: false,
      responsive_web_grok_show_grok_translated_post: false,
      responsive_web_grok_analysis_button_from_backend: true,
      creator_subscriptions_quote_tweet_preview_enabled: false,
      freedom_of_speech_not_reach_fetch_enabled: true,
      standardized_nudges_misinfo: true,
      tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
      longform_notetweets_rich_text_read_enabled: true,
      longform_notetweets_inline_media_enabled: true,
      responsive_web_grok_image_annotation_enabled: true,
      responsive_web_enhance_cards_enabled: false
    };
    
    // Field toggles parameter is also required
    const fieldToggles = {
      withArticleRichContentState: true,
      withArticlePlainText: false,
      withGrokAnalyze: false,
      withDisallowedReplyControls: false
    };
    
    // Fetch the data from Twitter's API with all required parameters
    const url = `https://x.com/i/api/graphql/b9Yw90FMr_zUb8DvA8r2ug/TweetDetail?variables=${encodeURIComponent(JSON.stringify(variables))}&features=${encodeURIComponent(JSON.stringify(features))}&fieldToggles=${encodeURIComponent(JSON.stringify(fieldToggles))}`;
    
    console.log(`Fetching page ${cursor ? `with cursor: ${cursor.substring(0, 20)}...` : '(initial)'}`);
    
    const response = await fetch(url, { headers: HEADERS });
    
    if (!response.ok) {
      console.error(`API request failed: ${response.status} ${response.statusText}`);
      break;
    }
    
    const json = await response.json();
    
    // Extract all tweet entries and cursors
    hasMore = false; // Reset for this iteration
    
    // Get the instructions from the response
    const instructions = json.data?.threaded_conversation_with_injections_v2?.instructions || [];
    
    // Process TimelineAddEntries instructions to find tweets and cursors
    for (const instruction of instructions) {
      if (instruction.type === "TimelineAddEntries") {
        for (const entry of instruction.entries || []) {
          // Extract tweets from TimelineTimelineModule
          if (entry.content?.entryType === "TimelineTimelineModule") {
            // Process each item in the module to find tweets
            for (const item of (entry.content?.items || [])) {
              const tweetId = item.item?.itemContent?.tweet_results?.result?.rest_id;
              if (tweetId && !replyTweetIds.includes(tweetId)) {
                replyTweetIds.push(tweetId);
              }
            }
          }
          
          // Check for cursors for the next page
          if (entry.content?.itemContent?.cursorType === "Bottom" && entry.content?.itemContent?.value) {
            cursor = entry.content.itemContent.value;
            hasMore = true;
          }
        }
      }
    }

    // append the entire response body to a JSON file for debugging
    const fs = require('fs');
    const path = require('path');
    fs.appendFileSync(path.join(__dirname, 'replies.json'), JSON.stringify(json) + '\n');

    console.log('hasMore', hasMore);
    
    console.log(`Found ${replyTweetIds.length} replies so far`);
    
    // Add a delay between requests
    await randomDelay();
  }
  
  return replyTweetIds;
}

/**
 * Like a tweet using Twitter's API
 */
async function likeTweet(tweetId: string): Promise<void> {
  const url = 'https://x.com/i/api/graphql/lI07N6Otwv1PhnEgXILM7A/FavoriteTweet';
  
  const body = JSON.stringify({
    variables: { tweet_id: tweetId },
    queryId: "lI07N6Otwv1PhnEgXILM7A"
  });

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: HEADERS,
      body,
    });

    if (res.ok) {
      console.log(`✅ Liked tweet ${tweetId}`);
    } else {
      console.error(`❌ Failed to like tweet ${tweetId}`);
    }
  } catch (error) {
    console.error(`Error liking tweet ${tweetId}:`, error);
  }
}

// Main execution
(async () => {
  try {
    console.log(`🔍 Fetching all replies to tweet ${TWEET_ID}...`);
    const replies = await getReplies(TWEET_ID);

    console.log(`💬 Found ${replies.length} replies. Starting to like them...`);
    
    for (const id of replies) {
      if (id !== TWEET_ID) { // Skip the original tweet if it was included
        await likeTweet(id);
        await randomDelay();
      }
    }

    console.log('🎉 Done liking all replies.');
  } catch (error) {
    console.error('Error running script:', error);
  }
})();
