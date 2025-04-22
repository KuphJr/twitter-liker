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

async function getReplies(tweetId: string): Promise<string[]> {
  const replyTweetIds: string[] = [];
  let cursor: string | null = null;
  let hasMore = true;

  while (hasMore) {
    // Create variables object based on example request
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

    if (cursor) {
      variables.cursor = cursor;
    }

    // Features parameter from example request
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

    // Field toggles parameter from example request
    const fieldToggles = {
      withArticleRichContentState: true,
      withArticlePlainText: false,
      withGrokAnalyze: false,
      withDisallowedReplyControls: false
    };

    // Construct URL with all parameters from the example
    const url = `https://x.com/i/api/graphql/b9Yw90FMr_zUb8DvA8r2ug/TweetDetail?variables=${encodeURIComponent(JSON.stringify(variables))}&features=${encodeURIComponent(JSON.stringify(features))}&fieldToggles=${encodeURIComponent(JSON.stringify(fieldToggles))}`;

    console.log('Fetching replies with URL:', url.substring(0, 100) + '...');
    
    const res = await fetch(url, { headers: HEADERS });
    
    if (!res.ok) {
      const text = await res.text();
      console.error(`Failed to fetch replies: ${res.status} ${res.statusText}`, text);
      throw new Error(`API request failed with status ${res.status}`);
    }
    
    const json = await res.json();

    // Extract entries from the correct path in the response
    const instructions = json.data?.threaded_conversation_with_injections_v2?.instructions || [];
    const entries = instructions
      .filter((instr: any) => instr.type === "TimelineAddEntries")
      .flatMap((instr: any) => instr.entries || []);

    for (const entry of entries) {
      // Process entries that contain tweets
      if (entry.content?.entryType === "TimelineTimelineModule") {
        // Process each item in the module
        for (const item of (entry.content?.items || [])) {
          const tweetResult = item.item?.itemContent?.tweet_results?.result;
          const tweetIdEntry = tweetResult?.rest_id;
          if (tweetIdEntry && tweetIdEntry !== tweetId) {
            replyTweetIds.push(tweetIdEntry);
          }
        }
      }

      // Look for cursor for pagination
      if (entry.entryId?.includes("cursor-bottom") && entry.content?.value) {
        cursor = entry.content.value;
        hasMore = true;
      }
    }

    // If no new cursor found, stop pagination
    if (!cursor) {
      hasMore = false;
    } else {
      console.log(`Found ${replyTweetIds.length} replies so far, fetching more...`);
      await randomDelay();
    }
  }

  return [...new Set(replyTweetIds)];
}

async function likeTweet(tweetId: string): Promise<void> {
  // Using GraphQL endpoint from the example
  const url = 'https://x.com/i/api/graphql/lI07N6Otwv1PhnEgXILM7A/FavoriteTweet';
  
  // Structure body according to the example
  const body = JSON.stringify({
    variables: {
      tweet_id: tweetId
    },
    queryId: "lI07N6Otwv1PhnEgXILM7A"
  });

  const res = await fetch(url, {
    method: 'POST',
    headers: HEADERS,
    body,
  });

  if (res.ok) {
    console.log(`✅ Liked tweet ${tweetId}`);
  } else {
    const text = await res.text();
    console.error(`❌ Failed to like tweet ${tweetId}`, text);
  }
}

(async () => {
  try {
    console.log(`🔍 Fetching all replies to tweet ${TWEET_ID}...`);
    const replies = await getReplies(TWEET_ID);

    console.log(`💬 Found ${replies.length} replies.`);
    for (const id of replies) {
      await likeTweet(id);
      await randomDelay();
    }

    console.log('🎉 Done liking all replies.');
  } catch (error) {
    console.error('Error running script:', error);
  }
})();
