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
      const imageUrls = extractAllImageUrls(html);

      return new Response(JSON.stringify({ images: imageUrls }), {
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

// Fungsi untuk mengekstrak semua URL gambar dari HTML
function extractAllImageUrls(html) {
  const imageRegex = /"https?:\/\/[^"]+\.(jpg|jpeg|png|gif|webp)"/g;
  const classRegex = /Q6A6Dc\s+ddBkwd/;

  // Ambil semua URL gambar
  const imageMatches = html.match(imageRegex);
  const imageUrls = imageMatches ? imageMatches.map(url => url.replace(/"/g, "")) : [];

  // Cek apakah class "Q6A6Dc ddBkwd" ada dalam HTML
  const containsTargetClass = classRegex.test(html);

  return {
    imageUrls,
    containsTargetClass
  };
}

// Fungsi untuk menambahkan header CORS
function getCorsHeaders() {
  return {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*", // Mengizinkan semua domain
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}
