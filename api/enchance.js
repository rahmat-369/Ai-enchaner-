import axios from 'axios';
import CryptoJS from 'crypto-js';

// Deteksi MIME Type Manual (ganti file-type)
function detectMimeType(buffer) {
  if (!buffer || buffer.length < 4) return 'image/jpeg';
  const hex = buffer.toString('hex', 0, 8).toUpperCase();
  if (hex.startsWith('89504E47')) return 'image/png';      // PNG
  if (hex.startsWith('FFD8FF')) return 'image/jpeg';       // JPEG
  if (hex.startsWith('52494646')) return 'image/webp';     // WEBP
  if (hex.startsWith('47494638')) return 'image/gif';      // GIF
  if (hex.startsWith('424D')) return 'image/bmp';          // BMP
  return 'image/jpeg'; // fallback
}

// Configuration
const ModelMap = {
  nano_banana: 2,
  seed_dream: 5,
  flux: 8,
  qwen_image: 9
};

const IMAGE_TO_ANIME_PRESETS = {
  manga: {
    size: "2K",
    aspect_ratio: "match_input_image",
    output_format: "jpg",
    sequential_image_generation: "disabled",
    max_images: 1,
    prompt: "Convert the provided image into a KOREAN-STYLE MANGA illustration. Apply strong stylization with clear and noticeable differences from the original image."
  },
  anime: {
    size: "2K",
    aspect_ratio: "match_input_image",
    output_format: "jpg",
    sequential_image_generation: "disabled",
    max_images: 1,
    prompt: "Convert the provided image into an ANIME-STYLE illustration. Apply strong stylization with clear and noticeable differences from the original image."
  },
  ghibli: {
    size: "2K",
    aspect_ratio: "match_input_image",
    output_format: "jpg",
    sequential_image_generation: "disabled",
    max_images: 1,
    prompt: "Convert the provided image into a STUDIO GHIBLI-STYLE illustration. Apply strong stylization with clear and noticeable differences from the original image."
  },
  cyberpunk: {
    size: "2K",
    aspect_ratio: "match_input_image",
    output_format: "jpg",
    sequential_image_generation: "disabled",
    max_images: 1,
    prompt: "Convert the provided image into a CYBERPUNK-STYLE illustration with neon colors, futuristic elements, and dark atmosphere."
  },
  watercolor: {
    size: "2K",
    aspect_ratio: "match_input_image",
    output_format: "png",
    sequential_image_generation: "disabled",
    max_images: 1,
    prompt: "Convert the provided image into a WATERCOLOR painting style with soft brush strokes and pastel colors."
  },
  pixelart: {
    size: "2K",
    aspect_ratio: "match_input_image",
    output_format: "png",
    sequential_image_generation: "disabled",
    max_images: 1,
    prompt: "Convert the provided image into PIXEL ART style with 8-bit retro gaming aesthetic."
  },
  sketch: {
    size: "2K",
    aspect_ratio: "match_input_image",
    output_format: "jpg",
    sequential_image_generation: "disabled",
    max_images: 1,
    prompt: "Convert the provided image into a detailed PENCIL SKETCH with realistic shading and artistic strokes."
  },
  oilpainting: {
    size: "2K",
    aspect_ratio: "match_input_image",
    output_format: "jpg",
    sequential_image_generation: "disabled",
    max_images: 1,
    prompt: "Convert the provided image into an OIL PAINTING style with thick brush strokes and rich colors."
  }
};

// AI Enhancer Class
class AIEnhancer {
  constructor() {
    this.AES_KEY = "ai-enhancer-web__aes-key";
    this.AES_IV = "aienhancer-aesiv";
    this.HEADERS = {
      "accept": "*/*",
      "content-type": "application/json",
      "Referer": "https://aienhancer.ai",
      "Referrer-Policy": "strict-origin-when-cross-origin"
    };
    this.POLLING_INTERVAL = 2000;
    this.MAX_POLLING_ATTEMPTS = 120;
  }

  encrypt(data) {
    const plaintext = typeof data === "string" ? data : JSON.stringify(data);
    return CryptoJS.AES.encrypt(
      plaintext,
      CryptoJS.enc.Utf8.parse(this.AES_KEY),
      {
        iv: CryptoJS.enc.Utf8.parse(this.AES_IV),
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7
      }
    ).toString();
  }

  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async processImage(image) {
    const mime = detectMimeType(image);
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/bmp'];
    if (!allowedTypes.includes(mime)) {
      throw new Error(`Format tidak didukung: ${mime}. Hanya support: ${allowedTypes.join(', ')}`);
    }
    const imgbase64 = image.toString("base64");
    return { base64: `data:${mime};base64,${imgbase64}`, mime };
  }

  async createTask(apiUrl, model, image, config) {
    const { base64 } = await this.processImage(image);
    const settings = typeof config === "string" ? config : this.encrypt(config);
    const { data } = await axios.post(apiUrl, {
      model,
      image: base64,
      settings
    }, { headers: this.HEADERS });
    if (data.code !== 100000 || !data.data.id) {
      throw new Error(`Gagal membuat task: ${data.message}`);
    }
    return data.data.id;
  }

  async checkTaskStatus(resultUrl, taskId) {
    const { data } = await axios.post(resultUrl, { task_id: taskId }, { headers: this.HEADERS });
    return data;
  }

  async pollTaskResult(resultUrl, taskId) {
    let attempts = 0;
    while (attempts < this.MAX_POLLING_ATTEMPTS) {
      const response = await this.checkTaskStatus(resultUrl, taskId);
      if (response.code !== 100000) {
        throw new Error(`Cek status gagal: ${response.message}`);
      }
      const { status, error, output, input } = response.data;
      if ((status === "succeeded" || status === "success") && output && input) {
        return { id: taskId, output, input, status };
      }
      if (status === "failed" || status === "fail" || error) {
        throw new Error(`Task gagal: ${error || "Unknown error"}`);
      }
      await this.sleep(this.POLLING_INTERVAL);
      attempts++;
    }
    throw new Error(`Timeout setelah ${this.MAX_POLLING_ATTEMPTS} percobaan`);
  }

  async imageToAnime(image, preset = "anime") {
    const apiUrl = "https://aienhancer.ai/api/v1/r/image-enhance/create";
    const resultUrl = "https://aienhancer.ai/api/v1/r/image-enhance/result";
    const model = 5;
    const config = IMAGE_TO_ANIME_PRESETS[preset] || preset;
    const taskId = await this.createTask(apiUrl, model, image, config);
    return await this.pollTaskResult(resultUrl, taskId);
  }

  async RemoveBackground(image) {
    const apiUrl = "https://aienhancer.ai/api/v1/r/image-enhance/create";
    const resultUrl = "https://aienhancer.ai/api/v1/r/image-enhance/result";
    const model = 4;
    const config = {
      threshold: 0,
      reverse: false,
      background_type: "rgba",
      format: "png",
    };
    const taskId = await this.createTask(apiUrl, model, image, config);
    return await this.pollTaskResult(resultUrl, taskId);
  }

  async AIImageUpscale(image, scale = 6) {
    const apiUrl = "https://aienhancer.ai/api/v1/r/image-enhance/create";
    const resultUrl = "https://aienhancer.ai/api/v1/r/image-enhance/result";
    const model = 3;
    const config = { scale };
    const taskId = await this.createTask(apiUrl, model, image, config);
    return await this.pollTaskResult(resultUrl, taskId);
  }

  async AIImageUpscalePrompt(image, prompt) {
    const apiUrl = "https://aienhancer.ai/api/v1/r/image-enhance/create";
    const resultUrl = "https://aienhancer.ai/api/v1/r/image-enhance/result";
    const model = 3;
    const config = {
      image_size: "auto",
      output_format: "png",
      prompt: prompt
    };
    const taskId = await this.createTask(apiUrl, model, image, config);
    return await this.pollTaskResult(resultUrl, taskId);
  }

  async ImageAIEditor(image, model, prompt, config = {}) {
    const apiUrl = "https://aienhancer.ai/api/v1/k/image-enhance/create";
    const resultUrl = "https://aienhancer.ai/api/v1/k/image-enhance/result";
    const modelId = ModelMap[model] || ModelMap.nano_banana;
    const defaultConfig = {
      size: "4K",
      aspect_ratio: "match_input_image",
      go_fast: true,
      prompt: prompt,
      output_quality: 100,
      disable_safety_checker: true,
      ...config
    };
    const taskId = await this.createTask(apiUrl, modelId, image, defaultConfig);
    return await this.pollTaskResult(resultUrl, taskId);
  }

  async customAnime(image, customPrompt) {
    const apiUrl = "https://aienhancer.ai/api/v1/r/image-enhance/create";
    const resultUrl = "https://aienhancer.ai/api/v1/r/image-enhance/result";
    const model = 5;
    const config = {
      size: "4K",
      aspect_ratio: "match_input_image",
      output_format: "png",
      sequential_image_generation: "disabled",
      max_images: 1,
      prompt: customPrompt
    };
    const taskId = await this.createTask(apiUrl, model, image, config);
    return await this.pollTaskResult(resultUrl, taskId);
  }
}

// Vercel API Handler
export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS, GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Handle GET - Show API info
  if (req.method === 'GET') {
    return res.json({
      name: 'AI Enhancer API',
      version: '1.0',
      endpoints: ['/api/enhance'],
      methods: ['POST'],
      features: ['toanime', 'rmbg', 'upscale', 'editimg', 'customanime']
    });
  }
  
  // Handle POST - Process image
  if (req.method === 'POST') {
    try {
      const { image, action = 'toanime', style = 'anime', prompt, scale, model = 'nano_banana' } = req.body;
      
      if (!image) {
        return res.status(400).json({ error: 'No image provided' });
      }
      
      // Convert base64 to Buffer
      const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      
      const ai = new AIEnhancer();
      let result;
      
      switch (action) {
        case 'toanime':
          result = await ai.imageToAnime(buffer, style);
          break;
        case 'rmbg':
          result = await ai.RemoveBackground(buffer);
          break;
        case 'upscale':
          if (scale) {
            result = await ai.AIImageUpscale(buffer, parseInt(scale));
          } else if (prompt) {
            result = await ai.AIImageUpscalePrompt(buffer, prompt);
          } else {
            result = await ai.AIImageUpscale(buffer, 6);
          }
          break;
        case 'editimg':
          if (!prompt) {
            return res.status(400).json({ error: 'Prompt required for editimg' });
          }
          result = await ai.ImageAIEditor(buffer, model, prompt);
          break;
        case 'customanime':
          if (!prompt) {
            return res.status(400).json({ error: 'Prompt required for customanime' });
          }
          result = await ai.customAnime(buffer, prompt);
          break;
        default:
          return res.status(400).json({ error: `Unknown action: ${action}` });
      }
      
      return res.json(result);
      
    } catch (error) {
      console.error('API Error:', error);
      return res.status(500).json({ 
        error: error.message,
        details: 'Check console for more info' 
      });
    }
  }
  
  // Method not allowed
  return res.status(405).json({ error: 'Method not allowed' });
    }
