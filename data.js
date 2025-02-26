export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === "/favicon.ico") {
      return new Response(null, { status: 204 });
    }

    const query = url.searchParams.get("q");
    const start = parseInt(url.searchParams.get("start")) || 0;
    const articleUrl = url.searchParams.get("url");

    if (!query && !articleUrl) {
      return new Response(JSON.stringify({ error: "Query parameter 'q' is required" }), {
        status: 400,
        headers: getCorsHeaders(),
      });
    }

    if (url.pathname === "/images") {
      return fetchImages(query, start);
    } else if (url.pathname === "/news") {
      return fetchNews(query, start);
    } else if (url.pathname === "/thumbnail" && articleUrl) {
      return fetchThumbnail(articleUrl);
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
      const images = extractImageData(html);

      for (const image of images) {
        const secureUrl = ensureHttps(image.url);
        const resizedUrl = getCloudflareResizedUrl(secureUrl);
        imageResults.push({
          image: secureUrl,
          thumbnail: resizedUrl,
          title: image.title,
          siteName: image.siteName,
          pageUrl: image.pageUrl,
        });
      }

      console.log("Response JSON:", { query, images: imageResults });

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


async function fetchNews(query, start) {
  let allNews = [];
  const maxStart = 60; // Maksimum start value
  const step = 10; // Setiap permintaan mengambil 10 berita

  try {
    while (start < maxStart) {
      const searchUrl = `https://www.google.com/search?hl=id&q=${encodeURIComponent(query)}&tbm=nws&start=${start}`;
      const response = await fetch(searchUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0",
          "Referer": "https://www.google.com/",
        },
      });

      if (!response.ok) throw new Error("Failed to fetch news");
      const html = await response.text();

      const newsData = extractNewsData(html);
      if (newsData.length === 0) break; // Stop jika tidak ada data lagi

      allNews.push(...newsData);
      start += step; // Tambah nilai start untuk mengambil batch berikutnya
    }

    return new Response(JSON.stringify({ query, items: allNews }), {
      status: 200,
      headers: getCorsHeaders(),
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: getCorsHeaders(),
    });
  }
}





async function fetchNsews(query, start) {
  try {
    const searchUrl = `https://www.google.com/search?hl=id&q=${encodeURIComponent(query)}&tbm=nws&start=${start}`;
    const response = await fetch(searchUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Referer": "https://www.google.com/",
      },
    });

    if (!response.ok) throw new Error("Failed to fetch news");
    const html = await response.text();
    const sethtml = function(t) {
      return t;
    };
    const htmlContent = ({ html }) => `${html}`;
      return new Response(JSON.stringify({ query: query, items: extractNewsData(html) }), {
        status: 200,
        headers: getCorsHeaders(),
      });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: getCorsHeaders(),
    });
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

function extractNewsData(html) {
  const newsRegex = /<a href="\/url\?q=(.*?)&amp;.*?"><div[^>]*class="[^"]*BNeawe vvjwJb AP7Wnd[^"]*"[^>]*>(.*?)<\/div>.*?<div[^>]*class="[^"]*BNeawe UPmit AP7Wnd lRVwie[^"]*"[^>]*>(.*?)<\/div>.*?<div[^>]*class="[^"]*BNeawe s3v9rd AP7Wnd[^"]*"[^>]*>(.*?)<\/div>.*?<img[^>]*class="h1hFNe"[^>]*src="(.*?)"/gs;

  const matches = [...html.matchAll(newsRegex)];

  return matches
    .map(match => {
      const url = decodeURIComponent(match[1]); // Ambil & decode URL berita
      if (shouldExcludeUrl(url)) return null; // Hapus berita dari URL yang tidak diinginkan

      const snippet = cleanHTML(match[4]); // Bersihkan snippet dari tag HTML
      const posttime = extractPosttime(snippet); // Ambil bagian terakhir dari snippet

      return {
        url,
        title: match[2].trim(),
        source: match[3].trim(),
        snippet, // Simpan snippet yang sudah dibersihkan
        thumbnail: match[5] || null, // Ambil URL thumbnail
        posttime, // Ambil waktu publikasi dari bagian akhir snippet
      };
    })
    .filter(item => item !== null); // Hapus hasil yang di-filter
}

// Fungsi untuk menyaring URL yang tidak diinginkan
function shouldExcludeUrl(url) {
  const blockedDomains = [
    "https://maps.google.com" // Tambahkan URL yang ingin diblokir di sini
  ];
  return blockedDomains.some(blocked => url.startsWith(blocked));
}

// Fungsi untuk mengambil bagian terakhir dari snippet sebagai publish time
function extractPosttime(snippet) {
  const parts = snippet.split("\n"); // Pisahkan berdasarkan baris baru
  const lastPart = parts[parts.length - 1].trim(); // Ambil bagian terakhir dan hapus spasi
  return lastPart || null; // Kembalikan nilai atau null jika kosong
}





async function fetchThumbnail(articleUrl) {
  try {
    const response = await fetch(articleUrl);
    const html = await response.text();

    console.log("HTML Retrieved:", html);  // Log HTML untuk debugging

    const metaTags = html.match(/<meta[^>]+>/g) || [];
    let thumbnail = null;

    for (const tag of metaTags) {
      if (/property=["']og:image["']/.test(tag) || 
          /name=["']twitter:image["']/.test(tag) || 
          /itemprop=["']image["']/.test(tag) || 
          /name=["']image["']/.test(tag)) {

        console.log("Matching Meta Tag:", tag);  // Log meta tag yang cocok
        const match = tag.match(/content=["'](https?:\/\/[^"']+)["']/);
        if (match) {
          thumbnail = match[1];
          break;
        }
      }
    }

    // Jika masih belum ada thumbnail, cek <link rel="image_src">
    if (!thumbnail) {
      const linkMatch = html.match(/<link[^>]+rel=["']image_src["'][^>]+href=["'](https?:\/\/[^"']+)["']/);
      if (linkMatch) {
        thumbnail = linkMatch[1];
      }
    }

    // Jika masih belum ada, coba ambil gambar pertama dalam artikel <img>
    if (!thumbnail) {
      const imgMatch = html.match(/<img[^>]+src=["'](https?:\/\/[^"']+)["']/);
      if (imgMatch) {
        thumbnail = imgMatch[1];
      }
    }

    if (!thumbnail) {
      return new Response(JSON.stringify({ error: "No thumbnail found" }), { status: 404 });
    }

    return new Response(JSON.stringify({ thumbnail }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Fetch Error:", error);
    return new Response(JSON.stringify({ error: "Failed to fetch the article" }), { status: 500 });
  }
}



function cleanHTML(html) {
  return html
    .replace(/<br\s*\/?>/gi, "\n") // Ubah <br> jadi newline
    .replace(/<[^>]+>/g, "") // Hapus semua tag HTML
    .trim();
}


function getCloudflareResizedUrl(imageUrl) {
  return `https://images.weserv.nl/?url=${encodeURIComponent(imageUrl)}&output=webp&w=200&q=10`;
}


function ensureHttps(url) {
  if (url.startsWith("http://")) {
    return url.replace("http://", "https://");
  }
  return url;
}

function getCorsHeaders() {
  return {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}
