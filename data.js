export default {
  async fetch(request) {
    const allowedOrigin = "https://raihan-zidan.github.io";
    const origin = request.headers.get("Origin");
    if (origin !== allowedOrigin) {
      return new Response(JSON.stringify({ error: "Akses ditolak." }), {
        headers: { "Content-Type": "application/json" },
        status: 403,
      });
    }
    const url = new URL(request.url);
    const path = url.pathname;

    if (path.startsWith("/images/")) {
      return await proxyGambar(request);
    } else if (path.startsWith("/suggest")) {
      return await fetchEcosiaSuggestions(url);
    } else if (path.startsWith("/favicon")) {
      return await fetchGoogleFavicon(url);
    } else if (path.startsWith("/api")) {
      return await fetchGoogleSearchData(url);
    } else {
      return await fetchDuckDuckGoData(url);
    }
  },
};

async function fetchDuckDuckGoData(url) {
  const query = url.searchParams.get("q");

  if (!query || query.toLowerCase().includes("israel")) {
    return new Response(JSON.stringify({ error: "Parameter tidak valid." }), {
      headers: { "Content-Type": "application/json" },
      status: 400,
    });
  }

  function generateRandomString(length) {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  }

  const duckduckgoURL = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_redirect=1&no_html=1&skip_disambig=1&m=${generateRandomString(5)}`;

  try {
    const response = await fetch(duckduckgoURL, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        "Accept": "application/json",
      },
    });

    if (!response.ok) {
      return new Response(JSON.stringify({ error: "Terjadi kesalahan." }), {
        headers: { "Content-Type": "application/json" },
        status: response.status,
      });
    }

    let results = await response.json();

    let filteredData = {
      title: results.Heading || "",
      type: results.Infobox?.content?.some(item => item.label === "Capital") ? "country" : "",
      image: results.Image ? `https://datasearch.raihan-zidan2709.workers.dev/images/${results.Image.replace("/i/", "")}` : "",
      source: results.AbstractSource || "",
      sourceUrl: results.AbstractURL || "",
      snippet: results.Abstract || "",
      url: results.AbstractURL || "",
      infobox: results.Infobox ? results.Infobox.content : [],
    };

    return new Response(JSON.stringify(filteredData), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: "Terjadi kesalahan" }), {
      headers: { "Content-Type": "application/json" },
      status: 500,
    });
  }
}

async function proxyGambar(request) {
  const url = new URL(request.url);
  const imagePath = url.pathname.replace("/images/", "");

  if (!imagePath) {
    return new Response(null, { status: 204 });
  }

  const imageUrl = `https://duckduckgo.com/i/${imagePath}`;

  try {
    const response = await fetch(imageUrl, {
      headers: { "User-Agent": "Mozilla/5.0" },
    });

    if (!response.ok) {
      return new Response(null, { status: 204 });
    }

    return new Response(response.body, {
      headers: {
        "Content-Type": response.headers.get("Content-Type"),
        "Cache-Control": "public, max-age=86400",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    return new Response(null, { status: 204 });
  }
}

//  suggest  //

async function fetchEcosiaSuggestions(url) {
  const query = url.searchParams.get("q");
  if (!query) {
    return new Response(JSON.stringify([]), {
      headers: { "Content-Type": "application/json" },
      status: 400,
    });
  }

  const ecosiaURL = `https://ac.ecosia.org/autocomplete?q=${encodeURIComponent(query)}`;

  try {
    const response = await fetch(ecosiaURL, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Accept": "application/json",
      },
    });

    const suggestions = await response.json();

    return new Response(JSON.stringify(suggestions), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    return new Response(JSON.stringify([]), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      status: 200, // Tetap mengembalikan status 200 agar tidak dianggap error
    });
  }
}

//  favicon  //

async function fetchGoogleFavicon(url) {
  const site = url.searchParams.get("url");
  if (!site) {
    return new Response(JSON.stringify({ error: "Parameter tidak valid." }), {
      headers: { "Content-Type": "application/json" },
      status: 400,
    });
  }

  const faviconUrl = `https://www.google.com/s2/favicons?sz=64&domain=${encodeURIComponent(site)}`;

  // SVG default jika favicon tidak ditemukan
  const defaultFaviconSVG = `
    <svg focusable="false" fill="#0657d1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"></path>
    </svg>
  `;

  try {
    const response = await fetch(faviconUrl, { headers: { "User-Agent": "Mozilla/5.0" } });

    if (!response.ok || response.headers.get("Content-Length") === "0") {
      return new Response(defaultFaviconSVG, {
        headers: {
          "Content-Type": "image/svg+xml",
          "Cache-Control": "public, max-age=86400",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    return new Response(response.body, {
      headers: {
        "Content-Type": response.headers.get("Content-Type"),
        "Cache-Control": "public, max-age=86400",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    return new Response(defaultFaviconSVG, {
      headers: {
        "Content-Type": "image/svg+xml",
        "Cache-Control": "public, max-age=86400",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }
}

// search api //

async function fetchGoogleSearchData(url) {
  try {
    const query = url.searchParams.get("q");
    const tbm = url.searchParams.get("tbm");
    const maxResults = url.searchParams.get("maxResults");
    const sort = url.searchParams.get("sort");
    const startIndex = url.searchParams.get("page") || "1";
    const gl = url.searchParams.get("gl");
    const hl = url.searchParams.get("hl");

    if (!query) {
      return new Response(JSON.stringify({ error: "Parameter q diperlukan." }), {
        headers: { "Content-Type": "application/json" },
        status: 400,
      });
    }

    const apikey = [
      "AIzaSyCJ3RgcZOxOm_V1hq-UXCJwPsWquHggQrg",
      "AIzaSyDuBTV5q0NAgfSY-2X9h5-ggbrX-a3EJBU",
      "AIzaSyB7eZUGjFCrSPEEI9OlDmtRW5fRTQIKIus",
      "AIzaSyC1etlk90G0YK1pNmblThRrIpYXWVCe8no",
      "AIzaSyAeibL6090vetveJ2IxkZ0h8JpmCUAEFAU",
      "AIzaSyBOETA8ym9-I5zMAq7IoEhQ1p4PajPvzHk",
      "AIzaSyBeCeoUn9efByemCErnTfNOW85H6WhUU8Q",
      "AIzaSyDJAlDofWRoODKtvr4gtDkHYNAHPZzSVX0",
      "AIzaSyDYZQDK3--oAlN9P80kFbr5Ae81Xv4r4Ew",
      "AIzaSyDBficXMaK97bS7ys4mAGvz5tLwwBSKbbg",
      "AIzaSyBK7tP0QHWR0x4YUd71sN298A4raMfLqKY",
      "AIzaSyD4KHQg1v9wFVlaKEVVVlZpiq8Y8L4UouI",
      "AIzaSyBj7aEZNIwRQG2cjuHZyPfW1UNywqsMcNo",
      "AIzaSyCmS3naxRClDgCH_ugTbn6dSqtArX0xj2o",
      "AIzaSyBtnDuoWCx30xG2gmUgRdB_pqGUzdr7s-A",
      "AIzaSyD69KZdQRASdg0QxpOA74adD4HeFRgHwx8",
      "AIzaSyDKPUq-VyTWsEA6PTozWnMEwNes3fu3CSY",
      "AIzaSyA-ZFRhlpU4PBS10Kp5Ipp6UD4xK--M-j8",
      "AIzaSyBni04n3gqNYKqAvtzNSWhau9LOoNzRFj4",
      "AIzaSyAB3o1QppoePI655jiTC3ArSBfQs_SuGyw",
      "AIzaSyAIyON_dQEybmn0HVilGHnPG2Hz0kheatk",
      "AIzaSyBIWWb7muhPm7yo4QPq1vcqi4XWaNtIJOY",
      "AIzaSyBm9AN4slsELMKW8fL401ZNC6ahIzWHjuc",
      "AIzaSyA8uJOYnA1ohf_7qIKJ15Evpyldq3CVl9M",
      "AIzaSyDgDhEyznphPnYHWQzIqiVJfkgwrxo2-2A"
    ];
    const ytapikey = [
      "AIzaSyDl_e_6hP6mKPXmzXbahlduZG3ErglkHSY",
      "AIzaSyAqc7T67GDJ208Y8CvR8YaPrNZlzKa2XbE"
    ];

    let googleSearchURL;
    if (tbm === "vid") {
      const YtAPIKey = ytapikey[Math.floor(Math.random() * ytapikey.length)];
      googleSearchURL = `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=10&q=${encodeURIComponent(query)}&type=video&key=${YtAPIKey}`;
      if (maxResults) googleSearchURL += `&maxResults=${maxResults}`;
    } else {
      const googleAPIKey = apikey[Math.floor(Math.random() * apikey.length)];
      const googleCX = tbm === "nws" ? "f7113f6d71c8f48c8" : "435bdb05f0b5e47bb";
      googleSearchURL = `https://www.googleapis.com/customsearch/v1?key=${googleAPIKey}&cx=${googleCX}&q=${encodeURIComponent(query)}&start=${startIndex}`;
      
      if (gl) googleSearchURL += `&gl=${gl}`;
      if (hl) googleSearchURL += `&hl=${hl}`;
      if (sort) googleSearchURL += `&sort=${sort}`;
    }

    const response = await fetch(googleSearchURL, { headers: { "User-Agent": "Mozilla/5.0" } });

    if (!response.ok) {
      return new Response(JSON.stringify({ error: "Terjadi kesalahan." }), {
        headers: { "Content-Type": "application/json" },
        status: response.status,
      });
    }

    const data = await response.json();

    return new Response(JSON.stringify(data), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: "Terjadi kesalahan" }), {
      headers: { "Content-Type": "application/json" },
      status: 500,
    });
  }
}

