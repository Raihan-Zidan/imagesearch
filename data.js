export default {
  async fetch(request) {
    const url = new URL(request.url);
    const imageUrl = url.searchParams.get("img");
    
    if (!imageUrl) {
      return new Response(JSON.stringify({ error: "Parameter 'img' diperlukan" }), {
        status: 400,
        headers: getCorsHeaders(),
      });
    }

    try {
      const compressedImage = await compressImage(imageUrl);
      
      return new Response(JSON.stringify({ compressedImage }), {
        status: 200,
        headers: getCorsHeaders(),
      });

    } catch (error) {
      return new Response(JSON.stringify({ error: "Gagal mengompresi gambar" }), {
        status: 500,
        headers: getCorsHeaders(),
      });
    }
  },
};

async function compressImage(imageUrl) {
  const response = await fetch(imageUrl);
  if (!response.ok) throw new Error("Gagal mengambil gambar");

  const imageBlob = await response.blob();
  
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(imageBlob);
    
    reader.onload = () => {
      const img = new Image();
      img.src = reader.result;
      
      img.onload = () => {
        const canvas = new OffscreenCanvas(100, 100); // Resolusi kecil (100x100)
        const ctx = canvas.getContext("2d");
        
        canvas.width = 100;
        canvas.height = 100;
        
        ctx.drawImage(img, 0, 0, 100, 100);
        
        canvas.convertToBlob({ type: "image/jpeg", quality: 0.5 }).then(blob => {
          const reader2 = new FileReader();
          reader2.readAsDataURL(blob);
          
          reader2.onload = () => resolve(reader2.result);
          reader2.onerror = reject;
        });
      };
      
      img.onerror = reject;
    };

    reader.onerror = reject;
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
