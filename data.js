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

    const startValues = [0, 10, 20, 30];
    let imageUrls = [];

    try {
      for (const start of startValues) {
        const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}&tbm=isch&start=${start}`;
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
        const images = await filterValidImages(extractImageData(html));
        imageUrls = imageUrls.concat(images);
      }

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

async function filterValidImages(images) {
  const validImages = [];
  for (const image of images) {
    if (await isImageLoadable(image.url)) {
      validImages.push(image);
    }
  }
  return validImages;
}

async function isImageLoadable(url) {
  try {
    const response = await fetch(url, { method: "HEAD" });
    return response.ok && response.headers.get("Content-Type")?.startsWith("image");
  } catch {
    return false;
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
  });
}



function getCorsHeaders() {
  return {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}
