export default {
  async fetch(request) {
    const url = new URL(request.url);
    const query = url.searchParams.get("q");

    if (!query) {
      return new Response(JSON.stringify({ error: "Query parameter 'q' is required" }), {
        status: 400,
        headers: getCorsHeaders(),
      });
    }

    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}&tbm=isch`;

    try {
      const response = await fetch(searchUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
          "Referer": "https://www.google.com/",
        },
      });

      if (!response.ok) {
        return new Response(JSON.stringify({ error: "Failed to fetch Google Images" }), {
          status: response.status,
          headers: getCorsHeaders(),
        });
      }

      const html = await response.text();
      const results = extractImageData(html);

      return new Response(JSON.stringify({ results }), {
        status: 200,
        headers: getCorsHeaders(),
      });

    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: getCorsHeaders(),
      });
    }
  },
};

function extractImageData(html) {
  const itemRegex = /<div class="isv-r[^>]*>([\s\S]*?)<\/div>/g;
  const itemMatches = [...html.matchAll(itemRegex)];

  let results = [];

  itemMatches.forEach(itemMatch => {
    const itemHtml = itemMatch[1];
    const imageUrlMatch = itemHtml.match(/"https?:\/\/[^"]+\.(jpg|jpeg|png|gif|webp)"/);
    const titleMatch = itemHtml.match(/<div class="Q6A6Dc ddBkwd">(.*?)<\/div>/);

    if (imageUrlMatch && titleMatch) {
      const imageUrl = imageUrlMatch[0].replace(/"/g, "");
      const title = titleMatch[1].replace(/<.*?>/g, "").trim();
      results.push({ imageUrl, title });
    }
  });

  return results;
}

function getCorsHeaders() {
  return {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}
