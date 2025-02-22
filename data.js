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

    let imageUrls = [];

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
      const images = extractImageData(html).filter(image => image.url !== "https://ssl.gstatic.com/gb/images/bar/al-icon.png");

      imageUrls = await Promise.all(
        images.map(async (image) => {
          const thumbnailUrl = getCloudflareResizedUrl(image.url, 300);
          const thumbnailBlob = await fetch(thumbnailUrl).then(res => res.blob());
          
          return {
            original: image.url,
            thumbnail: await convertBlobToBase64(getCloudflareResizedUrl(thumbnailBlob, 300)),
            title: image.title,
            siteName: image.siteName,
            pageUrl: image.pageUrl
          };
        })
      );

      return new Response(JSON.stringify({ images: imageUrls }), {
        status: 200,
        headers: getCorsHeaders(),
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: "Terjadi kesalahan." }), {
        status: 500,
        headers: getCorsHeaders(),
      });
    }
  },
};

// Fungsi untuk mengubah gambar menjadi progressive (menggunakan Cloudflare Image Resizing)
function getCloudflareResizedUrl(imageUrl, width) {
  return `https://images.weserv.nl/?url=${encodeURIComponent(imageUrl)}&w=${width}&q=50`;
}

// Fungsi untuk mengonversi Blob menjadi Base64
async function convertBlobToBase64(blob) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.readAsDataURL(blob);
  });
}

// Fungsi ekstraksi data gambar
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
  }).filter(image => image.url !== "https://ssl.gstatic.com/gb/images/bar/al-icon.png");
}

// Fungsi untuk mengatur CORS
function getCorsHeaders() {
  return {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}
