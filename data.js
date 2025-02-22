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
      const images = extractImagesWithTitles(html);

      return new Response(JSON.stringify({ images }), {
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

// Fungsi untuk mengekstrak URL gambar dan judul dari HTML
function extractImagesWithTitles(html) {
  const imageRegex = /"https?:\/\/[^"']+\.(jpg|jpeg|png|gif|webp)"/g; // Fix syntax error
  const matches = html.match(imageRegex);
  const imageUrls = matches ? matches.map(url => url.replace(/"/g, "")) : [];

  const domParser = new DOMParser();
  const doc = domParser.parseFromString(html, "text/html");
  const titleParents = doc.querySelectorAll(".toI8Rb.OSrXXb");

  const titles = Array.from(titleParents).map(parent => {
    const titleElement = parent.querySelector(".Q6A6Dc.ddBkwd");
    return titleElement ? titleElement.textContent.trim() : "";
  });

  return imageUrls.map((url, index) => ({
    url,
    title: titles[index] || ""
  }));
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
