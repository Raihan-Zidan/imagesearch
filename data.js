export default {
  async fetch(request) {
    const url = new URL(request.url);
    const query = url.searchParams.get("q");
    const maxPages = 3; // Ambil 3 halaman
    const resultsPerPage = 20;

    if (!query) {
      return new Response(JSON.stringify({ error: "Query parameter 'q' is required" }), {
        status: 400,
        headers: getCorsHeaders(),
      });
    }

    const variations = ["HD", "4K", "wallpaper", "photo", "best quality"];
    const searchUrls = [];

    // Buat semua URL pencarian
    for (let i = 0; i < maxPages; i++) {
      const start = i * resultsPerPage;
      const randomVariation = variations[i % variations.length]; // Gunakan variasi bergantian
      const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query + " " + randomVariation)}&tbm=isch&start=${start}&tbs=isz:l`;
      searchUrls.push(searchUrl);
    }

    try {
      // Fetch semua halaman secara paralel (lebih cepat)
      const responses = await Promise.all(
        searchUrls.map((url) =>
          fetch(url, {
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
              "Referer": "https://www.google.com/",
            },
          }).then((res) => (res.ok ? res.text() : ""))
        )
      );

      // Ekstrak data dari semua halaman yang berhasil
      let allImages = responses.flatMap((html) => (html ? extractImageData(html) : []));

      // Filter gambar agar hanya yang valid yang dikembalikan
      allImages = await filterValidImages(allImages);

      return new Response(JSON.stringify({ images: allImages }), {
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

// Fungsi untuk mengekstrak data gambar dari HTML
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
  }));
}

// Fungsi untuk memeriksa apakah gambar valid
async function filterValidImages(images) {
  const checkImage = async (image) => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000); // Timeout 3 detik

      const response = await fetch(image.url, { method: "HEAD", signal: controller.signal });
      clearTimeout(timeout);

      // Pastikan gambar bisa dimuat dan memiliki "Content-Type" yang valid
      const contentType = response.headers.get("Content-Type");
      if (!response.ok || !contentType || !contentType.startsWith("image/")) {
        return null;
      }

      return image;
    } catch (error) {
      return null;
    }
  };

  const results = await Promise.all(images.map(checkImage));
  return results.filter((img) => img !== null); // Hanya menyertakan gambar yang valid
}

// Fungsi untuk menambahkan header CORS
function getCorsHeaders() {
  return {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}
