import { JSDOM } from "jsdom";

export default {
  async fetch(request) {
    const url = new URL(request.url);

    // Bypass request favicon.ico agar tidak error
    if (url.pathname === "/favicon.ico") {
      return new Response(null, { status: 204 }); // No Content
    }

    const query = url.searchParams.get("q");
    const start = parseInt(url.searchParams.get("start")) || 0;

    console.log("Query diterima:", query);

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
          imageTitle: image.imageTitle,
        });
      }

      console.log("Response JSON:", { query, images: imageResults });

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
  const dom = new JSDOM(html);
  const document = dom.window.document;
  const imageElements = document.querySelectorAll("img");

  return [...imageElements].map(img => ({
    url: img.src,
    title: img.closest(".toI8Rb.OSrXXb")?.textContent || "",
    siteName: img.closest(".guK3rf.cHaqb")?.querySelector("span")?.textContent || "",
    pageUrl: img.closest("a")?.href || "",
    imageTitle: img.alt || "",
  })).filter(image => image.url && !image.url.includes("ssl.gstatic.com/gb/images"));
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
