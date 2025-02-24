export default {
  async fetch(request) {
    const url = new URL(request.url);

    // Bypass request favicon.ico agar tidak error
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
        return new Response(JSON.stringify({ error: "Terjadi kesalahan." }), {
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
          title: image.title, // Title dari Google Image Search
          imagetitle: image.imageTitle, // Judul yang lebih spesifik dari gambar
          siteName: image.siteName,
          pageUrl: image.pageUrl,
        });
      }

      return new Response(JSON.stringify({ query, images: imageResults }), {
        status: 200,
        headers: getCorsHeaders(),
      });

    } catch (error) {
      return new Response(JSON.stringify({ error: `Terjadi kesalahan. ${error.message}` }), {
        status: 500,
        headers: getCorsHeaders(),
      });
    }
  },
};

// Fungsi untuk memastikan URL gambar selalu HTTPS
function ensureHttps(url) {
  if (url.startsWith("http://")) {
    return url.replace("http://", "https://");
  }
  return url;
}

// Fungsi untuk mendapatkan URL gambar yang diproxy oleh Cloudflare API
function getCloudflareResizedUrl(imageUrl) {
  return `https://images.weserv.nl/?url=${encodeURIComponent(imageUrl)}&output=webp&w=200&q=10`;
}

// Fungsi ekstraksi data gambar dari HTML hasil pencarian Google
function extractImageData(html) {
  // Regex untuk menangkap URL gambar dari <img>
  const imageRegex = /<img[^>]+src=["'](https?:\/\/[^" ]+\.(?:jpg|jpeg|png|gif|webp))["']/g;

  // Regex untuk menangkap Image Title Block dari Google Image Search
  const titleRegex = /<div class="toI8Rb OSrXXb"[^>]*>(.*?)<\/div>/g;

  // Regex untuk menangkap nama situs sumber gambar
  const siteNameRegex = /<div class="guK3rf cHaqb"[^>]*>.*?<span[^>]*>(.*?)<\/span>/g;

  // Regex untuk menangkap URL halaman sumber gambar
  const pageUrlRegex = /<a class="EZAeBe"[^>]*href="(https?:\/\/[^" ]+)"/g;

  // Regex untuk menangkap "image title" dari atribut alt atau title dalam <img>
  const imageTitleRegex = /<img[^>]+(?:alt|title)=["']([^"']+)["']/g;

  const imageMatches = [...html.matchAll(imageRegex)];
  const titleMatches = [...html.matchAll(titleRegex)];
  const siteNameMatches = [...html.matchAll(siteNameRegex)];
  const pageUrlMatches = [...html.matchAll(pageUrlRegex)];
  const imageTitleMatches = [...html.matchAll(imageTitleRegex)];

  return imageMatches.map((match, index) => {
    return {
      url: match[1],  // URL gambar dari <img src="...">
      title: titleMatches[index] ? titleMatches[index][1] : "", // Image Title Block dari Google
      imageTitle: imageTitleMatches[index] ? imageTitleMatches[index][1] : "", // Judul dari alt/title atribut
      siteName: siteNameMatches[index] ? siteNameMatches[index][1] : "",
      pageUrl: pageUrlMatches[index] ? pageUrlMatches[index][1] : "",
    };
  }).filter(image => image.url !== "https://ssl.gstatic.com/gb/images/bar/al-icon.png");
}

// Fungsi untuk mengatur CORS
function getCorsHeaders() {
  return {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}
