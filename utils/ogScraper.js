const axios = require('axios');
const cheerio = require('cheerio');

/**
 * Scrapes Open Graph metadata from a given URL
 * @param {string} url - The URL to scrape
 * @returns {Promise<Object>} - Open Graph data
 */
async function scrape(url) {
  try {
    // Validate URL
    const urlObj = new URL(url);
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      throw new Error('Invalid URL protocol');
    }

    // Fetch the page content
    const response = await axios.get(url, {
      timeout: 10000, // 10 second timeout
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; GameTribeBot/1.0; +https://gametribe.com)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        'Connection': 'keep-alive',
      },
      maxRedirects: 5,
      validateStatus: function (status) {
        // Accept any status code less than 500 (including 4xx client errors)
        return status < 500;
      },
    });

    // Check if we got a successful response
    if (response.status >= 400) {
      throw new Error(`HTTP ${response.status}: ${response.statusText || 'Client Error'}`);
    }

    // Parse HTML with cheerio
    const $ = cheerio.load(response.data);

    // Extract Open Graph metadata
    const ogData = {
      url: url,
      title: '',
      description: '',
      image: '',
      siteName: '',
      type: 'website',
    };

    // Extract title (prefer og:title, fallback to <title>)
    ogData.title = $('meta[property="og:title"]').attr('content') || 
                   $('meta[name="twitter:title"]').attr('content') ||
                   $('title').text() || 
                   '';

    // Extract description (prefer og:description, fallback to meta description)
    ogData.description = $('meta[property="og:description"]').attr('content') || 
                        $('meta[name="twitter:description"]').attr('content') ||
                        $('meta[name="description"]').attr('content') || 
                        '';

    // Extract image (prefer og:image, fallback to twitter:image)
    const ogImage = $('meta[property="og:image"]').attr('content') || 
                   $('meta[name="twitter:image"]').attr('content') || 
                   $('meta[name="twitter:image:src"]').attr('content') || 
                   '';

    // Make image URL absolute if it's relative
    if (ogImage) {
      try {
        ogData.image = new URL(ogImage, url).href;
      } catch (e) {
        ogData.image = ogImage; // Use as-is if URL construction fails
      }
    }

    // Extract site name
    ogData.siteName = $('meta[property="og:site_name"]').attr('content') || 
                     $('meta[name="application-name"]').attr('content') ||
                     urlObj.hostname || 
                     '';

    // Extract type
    ogData.type = $('meta[property="og:type"]').attr('content') || 'website';

    // Clean up the data
    ogData.title = ogData.title.trim();
    ogData.description = ogData.description.trim();
    ogData.siteName = ogData.siteName.trim();

    // Truncate description if too long
    if (ogData.description.length > 300) {
      ogData.description = ogData.description.substring(0, 297) + '...';
    }

    return ogData;
  } catch (error) {
    console.error('Error scraping Open Graph data:', error.message);
    throw new Error(`Failed to scrape URL: ${error.message}`);
  }
}

module.exports = {
  scrape,
};
