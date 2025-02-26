export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === "/favicon.ico") {
      return new Response(null, { status: 204 });
    }

    if (url.pathname === "/images") {
      const query = url.searchParams.get("q");
      const start = parseInt(url.searchParams.get("start")) || 0;

      if (!query) {
        return new Response(JSON.stringify({ error: "Query parameter 'q' is required" }), {
          status: 400,
          headers: getCorsHeaders(),
        });
      }
      return fetchImages(query, start);
    }

    if (url.pathname === "/news") {
      const query = url.searchParams.get("q");
      return fetchNews(query);
    }

    if (url.pathname === "/proxy") {
      const imageUrl = url.searchParams.get("url");
      if (!imageUrl) {
        return new Response(JSON.stringify({ error: "Parameter 'url' diperlukan" }), {
          status: 400,
          headers: getCorsHeaders(),
        });
      }
      return proxyImage(imageUrl);
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
        "User-Agent": "Mozilla/5.0",
        "Referer": "https://www.google.com/",
      },
    });

    if (!response.ok) {
      return new Response(JSON.stringify({ error: "Terjadi kesalahan saat mengambil gambar." }), {
        status: response.status,
        headers: getCorsHeaders(),
      });
    }

    const html = await response.text();
    const images = extractImageData(html);

    for (const image of images) {
      const secureUrl = ensureHttps(image.url);
      const proxyUrl = `/proxy?url=${encodeURIComponent(secureUrl)}`;

      imageResults.push({
        original: secureUrl,
        proxy: proxyUrl,
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
  try {
    const response = await fetch(imageUrl, {
      headers: { "User-Agent": "Mozilla/5.0" },
    });

    if (!response.ok) {
      return new Response(JSON.stringify({ error: "Gagal memuat gambar" }), {
        status: response.status,
        headers: getCorsHeaders(),
      });
    }

    return new Response(response.body, {
      status: 200,
      headers: {
        "Content-Type": response.headers.get("Content-Type") || "image/jpeg",
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: `Gagal memproksi gambar: ${error.message}` }), {
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

  return imageMatches.map((match, index) => ({
    url: match[1],
    title: titleMatches[index] ? titleMatches[index][1] : "",
    siteName: siteNameMatches[index] ? siteNameMatches[index][1] : "",
    pageUrl: pageUrlMatches[index] ? pageUrlMatches[index][1] : "",
  })).filter(image => image.url !== "https://ssl.gstatic.com/gb/images/bar/al-icon.png");
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
