async function isValidImage(url) {
  try {
    const response = await fetch(url, { method: "HEAD", timeout: 3000 }); // Timeout 3 detik agar tidak terlalu lama
    return response.ok && response.headers.get("content-type")?.startsWith("image/");
  } catch (error) {
    return false;
  }
}

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

    try {
      const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}&tbm=isch&start=${start}`;
      const response = await fetch(searchUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0",
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
      const images = extractImageData(html);

      // Cek gambar secara paralel menggunakan Promise.all
      const validImages = await Promise.all(
        images.map(async (image) => {
          if (await isValidImage(image.url)) {
            return {
              image: image.url,
              thumbnail: getCloudflareResizedUrl(image.url),
              title: image.title,
              siteName: image.siteName,
              pageUrl: image.pageUrl,
            };
          }
          return null; // Hapus gambar yang tidak valid
        })
      );

      // Hanya ambil gambar yang valid
      const imageResults = validImages.filter((img) => img !== null);

      return new Response(JSON.stringify({ query, images: imageResults }), {
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
