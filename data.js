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

async function getImageHeight(imageUrl) {
  try {
    const response = await fetch(`https://images.weserv.nl/?url=${encodeURIComponent(imageUrl)}&output=json`);
    const data = await response.json();
    
    if (data.height) {
      return data.height;
    } else {
      throw new Error("Tidak bisa mendapatkan tinggi gambar.");
    }
  } catch (error) {
    console.error(`Gagal mendapatkan tinggi gambar: ${imageUrl}`, error);
    return null;
  }
}

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


function getCorsHeaders() {
  return {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}
