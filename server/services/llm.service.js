import dotenv from 'dotenv';
import * as cheerio from 'cheerio';
dotenv.config();

/**
 * LLM Service for AI-powered features
 * Supports OpenAI and Perplexity APIs
 */
class LLMService {
  constructor() {
    this.openaiKey = process.env.OPENAI_API_KEY;
    this.perplexityKey = process.env.PERPLEXITY_API_KEY;
  }

  /**
   * Get a clone candidate suggestion - a successful SaaS product worth cloning
   * Returns URL and pre-filled form data
   */
  async getCloneSuggestion(excludeUrls = []) {
    const provider = this.openaiKey ? 'openai' : this.perplexityKey ? 'perplexity' : null;

    if (!provider) {
      throw new Error('No LLM API key configured (OPENAI_API_KEY or PERPLEXITY_API_KEY)');
    }

    const excludeList = excludeUrls.length > 0
      ? `\n\nDo NOT suggest any of these (already seen): ${excludeUrls.join(', ')}`
      : '';

    const prompt = `Suggest a successful, CURRENTLY ACTIVE SaaS or web app that would be a good candidate to clone.

Can be B2B or B2C/consumer. Consumer products are great because:
- High volume user acquisition
- Users are free to sign up without corporate approval
- Faster adoption cycles

CRITICAL REQUIREMENTS:
- Must be actively operating in 2024/2025 (NOT shut down, acquired, or sunset)
- Must have a working website with active signups
- Has a clear, focused value proposition
- Market has room for newcomers (not dominated by one player)
- Could realistically be built by a small team
- Is not one of the giants (no Google, Microsoft, Meta, Amazon, etc.)
- Avoid products that have been acquired or are winding down

Consider markets like:
- Productivity & personal tools
- Creator economy & content
- Health & wellness apps
- Learning & education
- Finance & budgeting
- Social & community platforms
- Emerging markets with growing demand

Good examples of ACTIVE products: Calendly, Loom, Notion, Canva, Duolingo, Headspace, Strava, Todoist, YNAB, Substack, Beehiiv, Carrd, Linktree, etc.
${excludeList}

Respond with ONLY valid JSON (no markdown, no code blocks):
{
  "source_url": "https://example.com",
  "title": "Product Name - One line description",
  "description": "2-3 sentence description of what the product does",
  "value_proposition": "The core value it provides to users",
  "target_audience": "Who uses this product"
}`;

    try {
      if (provider === 'openai') {
        return await this.callOpenAI(prompt);
      } else {
        return await this.callPerplexity(prompt);
      }
    } catch (error) {
      console.error('LLM API error:', error);
      throw error;
    }
  }

  async callOpenAI(prompt) {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.openaiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a SaaS product expert. Respond only with valid JSON, no markdown formatting.'
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.9, // Higher for variety
        max_tokens: 500
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`OpenAI API error: ${error.error?.message || response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content?.trim();

    // Parse JSON from response (handle potential markdown code blocks)
    let jsonStr = content;
    if (content.startsWith('```')) {
      jsonStr = content.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
    }

    return JSON.parse(jsonStr);
  }

  async callPerplexity(prompt) {
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.perplexityKey}`
      },
      body: JSON.stringify({
        model: 'llama-3.1-sonar-small-128k-online',
        messages: [
          {
            role: 'system',
            content: 'You are a SaaS product expert. Respond only with valid JSON, no markdown formatting.'
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.9,
        max_tokens: 500
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Perplexity API error: ${error.error?.message || response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content?.trim();

    // Parse JSON from response
    let jsonStr = content;
    if (content.startsWith('```')) {
      jsonStr = content.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
    }

    return JSON.parse(jsonStr);
  }

  /**
   * Scrape a URL and extract content using cheerio
   */
  async scrapeUrl(url) {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5'
        },
        timeout: 15000
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch ${url}: ${response.status}`);
      }

      const html = await response.text();
      const $ = cheerio.load(html);

      // Remove script, style, nav, footer, header elements
      $('script, style, nav, footer, header, iframe, noscript').remove();

      // Extract metadata
      const metadata = {
        title: $('title').text().trim() || $('meta[property="og:title"]').attr('content') || '',
        description: $('meta[name="description"]').attr('content') || $('meta[property="og:description"]').attr('content') || '',
        ogImage: $('meta[property="og:image"]').attr('content') || '',
        siteName: $('meta[property="og:site_name"]').attr('content') || ''
      };

      // Extract headings
      const headings = [];
      $('h1, h2, h3').each((i, el) => {
        const text = $(el).text().trim();
        if (text && text.length < 200) {
          headings.push(text);
        }
      });

      // Extract feature-like content (lists, feature sections)
      const features = [];
      $('ul li, .feature, .features li, [class*="feature"] li').each((i, el) => {
        const text = $(el).text().trim();
        if (text && text.length > 10 && text.length < 300) {
          features.push(text);
        }
      });

      // Extract pricing info if available
      const pricing = [];
      $('[class*="price"], [class*="pricing"], .plan, .tier').each((i, el) => {
        const text = $(el).text().trim().replace(/\s+/g, ' ');
        if (text && text.length < 500) {
          pricing.push(text);
        }
      });

      // Get main content text (limited)
      const mainContent = $('main, article, .content, #content, .main')
        .first()
        .text()
        .trim()
        .replace(/\s+/g, ' ')
        .substring(0, 3000);

      // Fallback to body if no main content found
      const bodyText = mainContent || $('body')
        .text()
        .trim()
        .replace(/\s+/g, ' ')
        .substring(0, 3000);

      return {
        url,
        metadata,
        headings: headings.slice(0, 20),
        features: [...new Set(features)].slice(0, 30),
        pricing: [...new Set(pricing)].slice(0, 10),
        content: bodyText
      };
    } catch (error) {
      console.error('Scraping error:', error);
      throw error;
    }
  }

  /**
   * Analyze a URL by scraping it and using LLM to extract structured info
   */
  async analyzeUrl(url) {
    const provider = this.openaiKey ? 'openai' : this.perplexityKey ? 'perplexity' : null;

    if (!provider) {
      throw new Error('No LLM API key configured');
    }

    // First, scrape the actual page
    console.log(`Scraping ${url}...`);
    const scraped = await this.scrapeUrl(url);

    // Build a prompt with the scraped content
    const prompt = `Analyze this product/SaaS website based on the scraped content below.

URL: ${url}

PAGE TITLE: ${scraped.metadata.title}
META DESCRIPTION: ${scraped.metadata.description}

HEADINGS:
${scraped.headings.slice(0, 15).join('\n')}

FEATURES FOUND:
${scraped.features.slice(0, 20).join('\n')}

PRICING INFO:
${scraped.pricing.slice(0, 5).join('\n')}

MAIN CONTENT (excerpt):
${scraped.content.substring(0, 2000)}

Based on this information, extract:
1. A clear title with one-line description
2. A 2-3 sentence description of what the product does
3. The core value proposition
4. The target audience
5. Key features (list the main ones you can identify)

Respond with ONLY valid JSON (no markdown, no code blocks):
{
  "title": "Product Name - One line description",
  "description": "2-3 sentence description of what the product does",
  "value_proposition": "The core value it provides to users",
  "target_audience": "Who uses this product",
  "features": ["feature 1", "feature 2", "feature 3", ...]
}`;

    try {
      if (provider === 'openai') {
        return await this.callOpenAI(prompt);
      } else {
        return await this.callPerplexity(prompt);
      }
    } catch (error) {
      console.error('URL analysis error:', error);
      throw error;
    }
  }
}

export default new LLMService();
