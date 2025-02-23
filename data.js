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
      const images = extractImageData(html).filter(image => 
        !/^https?:\/\/cdn[0-9]-production-images-kly\.akamaized\.net\//.test(image.url)
      );

      for (const image of images) {
        const resizedUrl = getCloudflareResizedUrl(image.url);
        const dimensions = await getImageDimensions(image.url);

        imageResults.push({
          image: image.url,
          thumbnail: resizedUrl,
          title: image.title,
          siteName: image.siteName,
          pageUrl: image.pageUrl,
          width: dimensions?.width || null,
          height: dimensions?.height || null,
        });
      }

      return new Response(JSON.stringify({ images: imageResults }), {
        status: 200,
        headers: getCorsHeaders(),
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: `Terjadi kesalahan. ${error.message}` }), {
        status: 500,
        headers: getCorsHeaders(),
      });
    }
  },
};

// Fungsi untuk mendapatkan URL gambar dari Cloudflare API
function getCloudflareResizedUrl(imageUrl) {
  return `https://images.weserv.nl/?url=${encodeURIComponent(imageUrl)}&output=webp&w=200&q=50`;
}

// Fungsi untuk mendapatkan dimensi gambar dengan membaca header file (tanpa memuat seluruh gambar)
async function getImageDimensions(imageUrl) {
  try {
    const response = await fetch(imageUrl, { headers: { Range: "bytes=0-32" } });
    if (!response.ok) return null;

    const buffer = await response.arrayBuffer();
    const view = new DataView(buffer);

    let width, height;

    if (view.getUint32(0, false) === 0x89504e47) { // PNG
      width = view.getUint32(16, false);
      height = view.getUint32(20, false);
    } else if (view.getUint16(0, false) === 0xffd8) { // JPEG
      let offset = 2;
      while (offset < view.byteLength) {
        if (view.getUint16(offset, false) === 0xffc0) { // Start of Frame (SOF0)
          height = view.getUint16(offset + 3, false);
          width = view.getUint16(offset + 5, false);
          break;
        }
        offset += view.getUint16(offset + 2, false) + 2;
      }
    } else {
      return null;
    }

    return { width, height };
  } catch (error) {
    return null;
  }
}

// Fungsi ekstraksi data gambar dari HTML hasil pencarian Google
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
