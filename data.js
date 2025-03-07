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
    } else if (url.pathname === "/dimage") {
      return fetchBingImages(query, start);
    }

    return new Response(JSON.stringify({ error: "Invalid endpoint" }), {
      status: 404,
      headers: getCorsHeaders(),
    });
  },
};

async function fetchImages(query, start) {
    let imageResults = [];
    let proxyList = [];
    
    // Daftar API Key (utama & backup)
    const apiKeys = [
        "ks265xsdzcb67puwxval",  // Ganti dengan API Key utama
        "aa603wlnuw6do0a41tp3"   // Ganti dengan API Key backup
    ];

    // Ambil daftar proxy dengan API Key yang masih jalan
    for (const apiKey of apiKeys) {
        try {
            const proxyListUrl = `https://api.proxyscrape.com/v2/?request=getproxies&protocol=http&timeout=10000&premium=true&key=${apiKey}`;
            const proxyListResponse = await fetch(proxyListUrl);
            const proxyText = await proxyListResponse.text();
            proxyList = proxyText.trim().split("\n");

            if (proxyList.length > 0) break; // Stop kalau proxy berhasil diambil
        } catch (error) {
            console.error(`API Key ${apiKey} gagal: ${error.message}`);
        }
    }

    if (proxyList.length === 0) return new Response(JSON.stringify({ error: "No proxies available" }), { status: 500 });

    // Pilih proxy random dari daftar yang didapat
    const randomProxy = proxyList[Math.floor(Math.random() * proxyList.length)];
    console.log(`Pakai proxy: ${randomProxy}`);

    try {
        const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}&tbm=isch&start=${start}`;

        const response = await fetch(searchUrl, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
                "Referer": "https://www.google.com/",
            },
            cf: {
                // Proxy via Cloudflare Workers
                cacheTtl: 0,
                cacheEverything: false
            },
            redirect: "follow"
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
            let resizedUrl = getCloudflareResizedUrl(secureUrl);
            const excludedDomainRegex = /^https?:\/\/cdn[0-9]+-production-images-kly\.akamaized\.net/;
            if (excludedDomainRegex.test(resizedUrl)) {
              resizedUrl = secureUrl;
            }
            imageResults.push({
                image: secureUrl,
                thumbnail: resizedUrl,
                title: image.title,
                siteName: image.siteName,
                pageUrl: image.pageUrl,
            });
        }

        return new Response(JSON.stringify({ query, images: imageResults }), {
            status: 200,
            headers: getCorsHeaders(),
        });

    } catch (error) {
        console.error("Fetch Error Details:", {
            name: error.name,
            message: error.message,
            stack: error.stack
        });

        return new Response(JSON.stringify({ 
            error: `Terjadi kesalahan: ${error.name} - ${error.message || "Tidak ada pesan error"}` 
        }), {
            status: 500,
            headers: getCorsHeaders(),
        });
    }
}

async function fetchImageSize(imageUrl) {
    try {
        const response = await fetch(`https://images.weserv.nl/?url=${encodeURIComponent(imageUrl)}&output=json`);
        if (!response.ok) throw new Error("Failed to fetch image size");

        const data = await response.json();
        return { width: data.width, height: data.height };
    } catch (error) {
        console.error("Error fetching image size:", error);
        return { width: null, height: null };
    }
}

async function fetchNews(query) {
  try {
    const searchUrl = `https://www.google.com/search?hl=id&q=${encodeURIComponent(query)}&tbm=nws`;
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


async function fetchBingImages(query, start) {
  try {
    const images = [];
    for (let i = 0; i < 4; i++) {
      const offset = start + i * 20;
      const searchUrl = `https://www.bing.com/images/search?q=${encodeURIComponent(query)}&first=${offset}`;
      const response = await fetch(searchUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0",
          "Referer": "https://www.bing.com/",
        },
      });

      if (!response.ok) {
        return new Response(JSON.stringify({ error: "Failed to fetch images from Bing" }), {
          status: response.status,
          headers: getCorsHeaders(),
        });
      }

      const html = await response.text();
      images.push(...extractBingImageData(html));
    }
      return new Response(JSON.stringify({ query, items: images }), {
        status: 200,
        headers: getCorsHeaders(),
      });
  } catch (error) {
    return new Response(JSON.stringify({ error: `Terjadi kesalahan: ${error.message}` }), {
      status: 500,
      headers: getCorsHeaders(),
    });
  }
}

function extractBingImageData(html) {
  const entryRegex = /<img[^>]+(?:data-src|src)=["']([^"']+)["'][^>]*>.*?<a[^>]+data-hookid=["']pgdom["'][^>]+href=["']([^"']+)["'][^>]*>(.*?)<\/a>.*?<a[^>]+title=["']([^"']+)["']/gs;

  const images = [];
  let match;

  while ((match = entryRegex.exec(html)) !== null) {
    const imageUrl = match[1];
    const pageUrl = match[2];
    const siteName = match[3].trim();
    const title = match[4].trim();

    if (/^\/rp\//.test(imageUrl)) {
      continue;
    }

    images.push({ title, image: imageUrl, thumbnail: imageUrl, pageUrl, siteName });
  }

  return images;
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

function cleanHTML(html) {
  return html
    .replace(/<br\s*\/?>/gi, "\n") // Ubah <br> jadi newline
    .replace(/<[^>]+>/g, "") // Hapus semua tag HTML
    .trim();
}

function getCloudflareResizedUrl(imageUrl) {
  return `https://images.weserv.nl/?url=${encodeURIComponent(imageUrl)}&output=webp&w=200&q=30`;
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

          
