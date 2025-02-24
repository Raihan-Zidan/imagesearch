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
        const resizedUrl = getCloudflareResizedUrl(secureUrl);
        imageResults.push({
          image: secureUrl,
          thumbnail: resizedUrl,
          title: image.title,
          siteName: image.siteName,
          pageUrl: image.pageUrl,
          imageHeight: image.height || null, // Menambahkan imageHeight
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

async function fetchNews(query) {
  try {
    const searchUrl = `https://www.google.com/search?hl=id&q=${encodeURIComponent(query)}&tbm=nws`;
    const response = await fetch(searchUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Referer": "https://www.google.com/",
      },
    });

    if (!response.ok) throw new Error("Failed to fetch news");
    const html = await response.text();
    return new Response(JSON.stringify({ query: query, items: extractNewsData(html) }), {
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

function extractNewsData(html) {
  const newsRegex = /<a href="\/url\?q=(.*?)&amp;.*?"><div[^>]*class="[^"]*BNeawe vvjwJb AP7Wnd[^"]*"[^>]*>(.*?)<\/div>.*?<div[^>]*class="[^"]*BNeawe UPmit AP7Wnd lRVwie[^"]*"[^>]*>(.*?)<\/div>.*?<div[^>]*class="[^"]*BNeawe s3v9rd AP7Wnd[^"]*"[^>]*>(.*?)<\/div>.*?<img[^>]*class="h1hFNe"[^>]*src="(.*?)"/gs;

  const matches = [...html.matchAll(newsRegex)];

  return matches.map(match => ({
    url: decodeURIComponent(match[1]), // Ambil & decode URL berita
    title: match[2].trim(),
    source: match[3].trim(),
    snippet: cleanHTML(match[4]), // Bersihkan HTML dalam ringkasan
    thumbnail: match[5] || null // Ambil URL thumbnail
  }));
}

function cleanHTML(html) {
  return html
    .replace(/<br\s*\/?>/gi, "\n") // Ubah <br> jadi newline
    .replace(/<[^>]+>/g, "") // Hapus semua tag HTML
    .trim();
}

function extractImageData(html) {
  const imageRegex = /"(https?:\/\/[^" ]+\.(jpg|jpeg|png|gif|webp))"/g;
  const heightRegex = /"ow":"(\d+)"/g; // Ambil tinggi gambar jika tersedia
  const titleRegex = /<div class="toI8Rb OSrXXb"[^>]*>(.*?)<\/div>/g;
  const siteNameRegex = /<div class="guK3rf cHaqb"[^>]*>.*?<span[^>]*>(.*?)<\/span>/g;
  const pageUrlRegex = /<a class="EZAeBe"[^>]*href="(https?:\/\/[^" ]+)"/g;

  const imageMatches = [...html.matchAll(imageRegex)];
  const heightMatches = [...html.matchAll(heightRegex)];
  const titleMatches = [...html.matchAll(titleRegex)];
  const siteNameMatches = [...html.matchAll(siteNameRegex)];
  const pageUrlMatches = [...html.matchAll(pageUrlRegex)];

  return imageMatches.map((match, index) => {
    return {
      url: match[1],
      title: titleMatches[index] ? titleMatches[index][1] : "",
      siteName: siteNameMatches[index] ? siteNameMatches[index][1] : "",
      pageUrl: pageUrlMatches[index] ? pageUrlMatches[index][1] : "",
      height: heightMatches[index] ? parseInt(heightMatches[index][1]) : null, // Ambil tinggi gambar
    };
  }).filter(image => image.url !== "https://ssl.gstatic.com/gb/images/bar/al-icon.png");
}

function getCloudflareResizedUrl(imageUrl) {
  return `https://images.weserv.nl/?url=${encodeURIComponent(imageUrl)}&output=webp&w=200&q=10`;
}

function getCorsHeaders() {
  return {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}
