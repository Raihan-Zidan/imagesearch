export default {
  async fetch(request) {
    const url = new URL(request.url);
    const query = url.searchParams.get("q");
    const start = parseInt(url.searchParams.get("start")) || 0;

    if (!query) {
      return new Response(JSON.stringify({ error: "Query parameter 'q' is required" }), {
        status: 400,
        headers: getCorsHeaders(),
      });
    }

    try {
      // Ambil gambar dari Google Images
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

      if (images.length === 0) {
        return new Response(JSON.stringify({ error: "Tidak ada gambar ditemukan." }), {
          status: 404,
          headers: getCorsHeaders(),
        });
      }

      // Pilih gambar pertama untuk ditampilkan sebagai Blob (contoh saja)
      const firstImage = images[0];
      const thumbnailUrl = thumbnailBlob(getCloudflareResizedUrl(firstImage.url, 300));

      // Ambil gambar thumbnail dari Cloudflare Image Resizing
      const imageResponse = await fetch(thumbnailUrl);
      if (!imageResponse.ok) {
        return new Response(JSON.stringify({ error: "Gagal mengambil gambar." }), {
          status: imageResponse.status,
          headers: getCorsHeaders(),
        });
      }

      // Kirim gambar dalam bentuk Blob
      return new Response(imageResponse.body, {
        status: 200,
        headers: {
          "Content-Type": imageResponse.headers.get("Content-Type") || "image/jpeg",
          "Cache-Control": "public, max-age=3600",
          "Access-Control-Allow-Origin": "*",
        },
      });

    } catch (error) {
      return new Response(JSON.stringify({ error: "Terjadi kesalahan server." }), {
        status: 500,
        headers: getCorsHeaders(),
      });
    }
  },
};

async function convertBlobToBase64(blob) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.readAsDataURL(blob);
  });
}

// 🔹 Fungsi untuk mengubah gambar menjadi progressive (menggunakan Cloudflare Image Resizing)
function getCloudflareResizedUrl(imageUrl, width) {
  return `https://images.weserv.nl/?url=${encodeURIComponent(imageUrl)}&w=${width}&q=60&output=webp`;
}

// 🔹 Fungsi ekstraksi data gambar dari HTML hasil pencarian Google Images
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
  });
}

// 🔹 Fungsi untuk mengatur CORS
function getCorsHeaders() {
  return {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}
