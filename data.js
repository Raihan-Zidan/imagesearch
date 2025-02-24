export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === "/favicon.ico") {
      return new Response(null, { status: 204 });
    }

    const query = url.searchParams.get("q");
    const start = parseInt(url.searchParams.get("start")) || 0;

    if (!query) {
      return new Response(JSON.stringify({ error: "Query parameter 'q' is required" }), {
        status: 400,
        headers: getCorsHeaders(),
      });
    }

    if (url.pathname === "/images") {
      return fetchImages(query, start);
    } else if (url.pathname === "/news") {
      return fetchNews(query);
    }

    return new Response(JSON.stringify({ error: "Invalid endpoint" }), {
      status: 404,
      headers: getCorsHeaders(),
    });
  },
};

async function fetchImages(query, start) {
  try {
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}&tbm=isch&start=${start}`;
    const response = await fetch(searchUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Referer": "https://www.google.com/",
      },
    });

    if (!response.ok) throw new Error("Failed to fetch images");
    const html = await response.text();
    const images = extractImageData(html);

    return new Response(JSON.stringify({ query, images }), {
      status: 200,
      headers: getCorsHeaders(),
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: getCorsHeaders(),
    });
  }
}

async function fetchNews(query) {
  try {
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}&tbm=nws`;
    const response = await fetch(searchUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Referer": "https://www.google.com/",
      },
    });

    if (!response.ok) throw new Error("Failed to fetch news");
    const html = await response.text();
    const news = extractNewsData(html);

    return new Response(JSON.stringify({ query, news }), {
      status: 200,
      headers: getCorsHeaders(),
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: getCorsHeaders(),
    });
  }
}

function extractImageData(html) {
  const imageRegex = /"(https?:\/\/[^" ]+\.(jpg|jpeg|png|gif|webp))"/g;

  const matches = [...html.matchAll(imageRegex)];
  return matches.map(match => ({ image: ensureHttps(match[1]) }));
}

function extractNewsData(html) {
  const titleRegex = /<div class="n0jPhd ynAwRc MBeuO nDgy9d"[^>]*>(.*?)<\/div>/g;
  const snippetRegex = /<div class="GI74Re nDgy9d"[^>]*>(.*?)<\/div>/g;
  const timeRegex = /<div class="OSrXXb rbYSKb LfVVr"[^>]*><span>(.*?)<\/span><\/div>/g;
  const imageRegex = /<img[^>]+src="(data:image\/jpeg;base64,[^"]+)"/g;

  const titles = [...html.matchAll(titleRegex)].map(m => m[1]);
  const snippets = [...html.matchAll(snippetRegex)].map(m => m[1]);
  const times = [...html.matchAll(timeRegex)].map(m => m[1]);
  const images = [...html.matchAll(imageRegex)].map(m => m[1]);

  return titles.map((title, index) => ({
    title,
    snippet: snippets[index] || "",
    time: times[index] || "",
    image: images[index] || "",
  }));
}

function ensureHttps(url) {
  return url.startsWith("http://") ? url.replace("http://", "https://") : url;
}

function getCorsHeaders() {
  return {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}
