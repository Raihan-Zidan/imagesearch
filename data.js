import sharp from "sharp";
import fetch from "node-fetch";
import { Readable } from "stream";

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
        "User-Agent": "Mozilla/5.0",
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
      const height = await getImageHeight(secureUrl);

      imageResults.push({
        image: secureUrl,
        thumbnail: resizedUrl,
        title: image.title,
        siteName: image.siteName,
        pageUrl: image.pageUrl,
        height, // Tambahkan tinggi gambar ke respons
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

// Fungsi untuk mengambil tinggi gambar menggunakan Sharp
async function getImageHeight(imageUrl) {
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) throw new Error("Gagal mengunduh gambar");

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const metadata = await sharp(buffer).metadata();
    return metadata.height || null;
  } catch (error) {
    console.error(`Gagal mendapatkan tinggi gambar: ${imageUrl}`, error);
    return null;
  }
}


function getCorsHeaders() {
  return {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}
