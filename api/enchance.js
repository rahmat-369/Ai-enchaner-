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
    
    console.log('Creating task with model:', model, 'URL:', apiUrl);
    
    const { data } = await axios.post(apiUrl, {
      model,
      image: base64,
      settings
    }, { headers: this.HEADERS });
    
    if (data.code !== 100000 || !data.data?.id) {
      throw new Error(`Gagal membuat task: ${data.message || 'Unknown error'}`);
    }
    
    console.log('Task created with ID:', data.data.id);
    return data.data.id;
  }

  async checkTaskStatus(resultUrl, taskId) {
    const { data } = await axios.post(resultUrl, { task_id: taskId }, { headers: this.HEADERS });
    return data;
  }

  async pollTaskResult(resultUrl, taskId) {
    let attempts = 0;
    console.log(`Polling task ${taskId}...`);
    
    while (attempts < this.MAX_POLLING_ATTEMPTS) {
      const response = await this.checkTaskStatus(resultUrl, taskId);
      
      if (response.code !== 100000) {
        throw new Error(`Cek status gagal: ${response.message}`);
      }
      
      const { status, error, output, input } = response.data;
      console.log(`Attempt ${attempts + 1}: Status = ${status}`);
      
      if ((status === "succeeded" || status === "success") && output && input) {
        console.log('Task succeeded!');
        return { 
          id: taskId, 
          output, 
          input, 
          status,
          taskId: taskId,
          success: true
        };
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
    console.log(`Converting to ${preset} style`);
    
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
    
    console.log('Removing background...');
    const taskId = await this.createTask(apiUrl, model, image, config);
    return await this.pollTaskResult(resultUrl, taskId);
  }

  async AIImageUpscale(image, scale = 6) {
    const apiUrl = "https://aienhancer.ai/api/v1/r/image-enhance/create";
    const resultUrl = "https://aienhancer.ai/api/v1/r/image-enhance/result";
    const model = 3;
    
    const config = { scale };
    console.log(`Upscaling with scale ${scale}x`);
    
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
    
    console.log(`Upscaling with prompt: ${prompt}`);
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
    
    console.log(`Editing image with model ${model} (ID: ${modelId})`);
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
    
    console.log(`Custom anime with prompt: ${customPrompt}`);
    const taskId = await this.createTask(apiUrl, model, image, config);
    return await this.pollTaskResult(resultUrl, taskId);
  }
}

// Vercel API Handler
export default async function handler(req, res) {
  // Enable CORS for all origins
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS, GET, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept');
  res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Handle GET - Show API info
  if (req.method === 'GET') {
    return res.status(200).json({
      status: 'online',
      name: 'AI Enhancer API',
      version: '1.0.0',
      endpoints: ['/api/enhance'],
      methods: ['POST', 'GET', 'OPTIONS'],
      features: ['toanime', 'rmbg', 'upscale', 'editimg', 'customanime'],
      credits: 'AlfiXD',
      source: 'https://whatsapp.com/channel/0029Vb4fjWE1yT25R7epR110',
      note: 'Use POST method with JSON body to process images'
    });
  }
  
  // Handle POST - Process image
  if (req.method === 'POST') {
    try {
      console.log('Received POST request to /api/enhance');
      
      // Parse request body
      let body;
      if (typeof req.body === 'string') {
        body = JSON.parse(req.body);
      } else {
        body = req.body;
      }
      
      const { 
        image, 
        action = 'toanime', 
        style = 'anime', 
        prompt, 
        scale, 
        model = 'nano_banana' 
      } = body;
      
      // Validate required fields
      if (!image) {
        console.error('No image provided in request');
        return res.status(400).json({ 
          error: true,
          message: 'No image provided. Please include base64 image data.',
          code: 'NO_IMAGE'
        });
      }
      
      console.log(`Processing action: ${action}, style: ${style}`);
      
      // Validate image data format
      if (!image.startsWith('data:image/')) {
        return res.status(400).json({
          error: true,
          message: 'Invalid image format. Must be data:image/*;base64,...',
          code: 'INVALID_IMAGE_FORMAT'
        });
      }
      
      // Convert base64 to Buffer
      const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
      let buffer;
      try {
        buffer = Buffer.from(base64Data, 'base64');
      } catch (bufferError) {
        return res.status(400).json({
          error: true,
          message: 'Invalid base64 image data',
          code: 'INVALID_BASE64'
        });
      }
      
      // Validate buffer size
      if (buffer.length === 0) {
        return res.status(400).json({
          error: true,
          message: 'Image data is empty',
          code: 'EMPTY_IMAGE'
        });
      }
      
      // Initialize AI Enhancer
      const ai = new AIEnhancer();
      let result;
      
      // Process based on action
      switch (action) {
        case 'toanime':
          if (!IMAGE_TO_ANIME_PRESETS[style]) {
            return res.status(400).json({
              error: true,
              message: `Invalid style: ${style}. Valid styles: ${Object.keys(IMAGE_TO_ANIME_PRESETS).join(', ')}`,
              code: 'INVALID_STYLE'
            });
          }
          result = await ai.imageToAnime(buffer, style);
          break;
          
        case 'rmbg':
          result = await ai.RemoveBackground(buffer);
          break;
          
        case 'upscale':
          if (scale) {
            const scaleNum = parseInt(scale);
            if (isNaN(scaleNum) || scaleNum < 1 || scaleNum > 10) {
              return res.status(400).json({
                error: true,
                message: 'Scale must be a number between 1 and 10',
                code: 'INVALID_SCALE'
              });
            }
            result = await ai.AIImageUpscale(buffer, scaleNum);
          } else if (prompt) {
            result = await ai.AIImageUpscalePrompt(buffer, prompt);
          } else {
            result = await ai.AIImageUpscale(buffer, 6); // Default scale 6
          }
          break;
          
        case 'editimg':
          if (!prompt || prompt.trim() === '') {
            return res.status(400).json({
              error: true,
              message: 'Prompt is required for editimg action',
              code: 'MISSING_PROMPT'
            });
          }
          result = await ai.ImageAIEditor(buffer, model, prompt);
          break;
          
        case 'customanime':
          if (!prompt || prompt.trim() === '') {
            return res.status(400).json({
              error: true,
              message: 'Prompt is required for customanime action',
              code: 'MISSING_PROMPT'
            });
          }
          result = await ai.customAnime(buffer, prompt);
          break;
          
        default:
          return res.status(400).json({
            error: true,
            message: `Unknown action: ${action}. Valid actions: toanime, rmbg, upscale, editimg, customanime`,
            code: 'UNKNOWN_ACTION'
          });
      }
      
      // Return success response
      console.log('Processing successful!');
      return res.status(200).json({
        success: true,
        ...result,
        timestamp: new Date().toISOString(),
        action: action,
        style: style
      });
      
    } catch (error) {
      console.error('API Processing Error:', error.message);
      console.error('Error stack:', error.stack);
      
      return res.status(500).json({
        error: true,
        message: error.message || 'Internal server error',
        code: 'PROCESSING_ERROR',
        timestamp: new Date().toISOString(),
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }
  
  // Method not allowed
  return res.status(405).json({
    error: true,
    message: 'Method not allowed. Use POST or GET.',
    code: 'METHOD_NOT_ALLOWED'
  });
}
