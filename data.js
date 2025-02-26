export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === "/favicon.ico") {
      return new Response(null, { status: 204 });
    }

    const query = url.searchParams.get("q");
    const start = parseInt(url.searchParams.get("start")) || 0;

    if (!query && url.pathname !== "/imgproxy") {
      return new Response(JSON.stringify({ error: "Query parameter 'q' is required" }), {
        status: 400,
        headers: getCorsHeaders(),
      });
    }

    if (url.pathname === "/images") {
      return fetchImages(query, start);
    } else if (url.pathname === "/news") {
      return fetchNews(query);
    } else if (url.pathname === "/img") {
      return proxyImage(url.searchParams.get("url"));
    }

    return new Response(JSON.stringify({ error: "Invalid endpoint" }), {
      status: 404,
      headers: getCorsHeaders(),
    });
  },
};

async function fetchImages(query, start) {
  let imageResults = [];
  try {
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}&tbm=isch&start=${start}`;
    const response = await fetch(searchUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        "Referer": "https://www.google.com/",
      },
    });

    if (!response.ok) {
      return new Response(JSON.stringify({ error: `Terjadi kesalahan.` }), {
        status: response.status,
        headers: getCorsHeaders(),
      });
    }

    const html = await response.text();
    const images = extractImageData(html);

    for (const image of images) {
      const secureUrl = ensureHttps(image.url);
      const proxiedUrl = `/imgproxy?url=${encodeURIComponent(secureUrl)}`;
      imageResults.push({
        image: secureUrl,
        thumbnail: proxiedUrl,
        title: image.title,
        siteName: image.siteName,
        pageUrl: image.pageUrl,
      });
    }

    return new Response(JSON.stringify({ query, images: imageResults }), {
      status: 200,
      headers: getCorsHeaders(),
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: `Terjadi kesalahan. ${error.message}` }), {
      status: 500,
      headers: getCorsHeaders(),
    });
  }
}

async function proxyImage(imageUrl) {
  if (!imageUrl) {
    return new Response(JSON.stringify({ error: "Missing image URL" }), {
      status: 400,
      headers: getCorsHeaders(),
    });
  }

  try {
    const response = await fetch(imageUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Referer": "https://www.google.com/",
      },
    });
    
    if (!response.ok) {
      return new Response(JSON.stringify({ error: "Failed to fetch image" }), {
        status: response.status,
        headers: getCorsHeaders(),
      });
    }

    return new Response(response.body, {
      status: 200,
      headers: {
        "Content-Type": response.headers.get("Content-Type") || "image/jpeg",
        "Access-Control-Allow-Origin": "*",
      },
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
  const titleRegex = /<div class="toI8Rb OSrXXb"[^>]*>(.*?)<\/div>/g;
  const siteNameRegex = /<div class="guK3rf cHaqb"[^>]*>.*?<span[^>]*>(.*?)<\/span>/g;
  const pageUrlRegex = /<a class="EZAeBe"[^>]*href="(https?:\/\/[^" ]+)"/g;

  const imageMatches = [...html.matchAll(imageRegex)];
  const titleMatches = [...html.matchAll(titleRegex)];
  const siteNameMatches = [...html.matchAll(siteNameRegex)];
  const pageUrlMatches = [...html.matchAll(pageUrlRegex)];

  return imageMatches.map((match, index) => {
    return {
      url: match[1],
      title: titleMatches[index] ? titleMatches[index][1] : "",
      siteName: siteNameMatches[index] ? siteNameMatches[index][1] : "",
      pageUrl: pageUrlMatches[index] ? pageUrlMatches[index][1] : "",
    };
  }).filter(image => image.url !== "https://ssl.gstatic.com/gb/images/bar/al-icon.png");
}

function ensureHttps(url) {
  if (url.startsWith("http://")) {
    return url.replace("http://", "https://");
  }
  return url;
}

function getCorsHeaders() {
  return {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}
