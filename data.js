export default {
  async fetch(request) {
    const url = new URL(request.url);
    const query = url.searchParams.get("q");

    if (!query) {
      return new Response(JSON.stringify({ error: "Query parameter 'q' is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
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
          headers: { "Content-Type": "application/json" },
        });
      }

      const html = await response.text();
      const imageUrls = extractAllImageUrls(html);

      return new Response(JSON.stringify({ images: imageUrls }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });

    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
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
