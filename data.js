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
      const results = extractImageData(html);

      return new Response(JSON.stringify({ results }), {
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

// Fungsi untuk mengekstrak gambar + judul + URL halaman sumber
function extractImageData(html) {
  const imageRegex = /"https?:\/\/[^"]+\.(jpg|jpeg|png|gif|webp)"/g;
  const titleRegex = /<div class="Q6A6Dc ddBkwd">([^<]+)<\/div>/g;
  const pageUrlRegex = /<a href="\/imgres\?imgurl=(.*?)&amp;imgrefurl=(.*?)"/g;

  const imageMatches = html.match(imageRegex) || [];
  const titleMatches = [...html.matchAll(titleRegex)];
  const pageUrlMatches = [...html.matchAll(pageUrlRegex)];

  let results = [];

  for (let i = 0; i < imageMatches.length; i++) {
    const imageUrl = imageMatches[i].replace(/"/g, "");

    let title = "Unknown";
    let pageUrl = "#";

    if (titleMatches[i]) {
      title = titleMatches[i][1].trim(); // Ambil teks dalam <div class="Q6A6Dc ddBkwd">
    }

    if (pageUrlMatches[i]) {
      pageUrl = decodeURIComponent(pageUrlMatches[i][2]); // URL halaman sumber
    }

    results.push({ imageUrl, title, pageUrl });
  }

  return results;
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
