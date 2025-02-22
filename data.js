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
          "User-Agent": "Mozilla/5.0 (Linux; Android 10; SM-G960U) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.162 Mobile Safari/537.36",
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
  const regex = /"https?:\/\/[^"]+\.(jpg|jpeg|png|gif|webp)"/g;
  const matches = html.match(regex);
  return matches ? matches.map(url => url.replace(/"/g, "")) : [];
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
