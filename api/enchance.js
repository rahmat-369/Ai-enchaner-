import axios from 'axios';
import CryptoJS from 'crypto-js';

// GANTI: Fungsi deteksi manual (hapus file-type)
function detectMimeType(buffer) {
  if (!buffer || buffer.length < 4) return 'image/jpeg';
  const hex = buffer.toString('hex', 0, 8).toUpperCase();
  if (hex.startsWith('89504E47')) return 'image/png';
  if (hex.startsWith('FFD8FF')) return 'image/jpeg';
  if (hex.startsWith('52494646')) return 'image/webp';
  if (hex.startsWith('47494638')) return 'image/gif';
  return 'image/jpeg';
}

// Salin semua config asli
const ModelMap = { nano_banana: 2, seed_dream: 5, flux: 8, qwen_image: 9 };
const IMAGE_TO_ANIME_PRESETS = { /* salin semua dari kode */ };

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
      { iv: CryptoJS.enc.Utf8.parse(this.AES_IV), mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7 }
    ).toString();
  }

  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async processImage(image) {
    const mime = detectMimeType(image);
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/bmp'];
    if (!allowed.includes(mime)) throw new Error(`Format tidak didukung: ${mime}`);
    const imgbase64 = image.toString("base64");
    return { base64: `data:${mime};base64,${imgbase64}`, mime };
  }

  async createTask(apiUrl, model, image, config) {
    const { base64 } = await this.processImage(image);
    const settings = typeof config === "string" ? config : this.encrypt(config);
    const { data } = await axios.post(apiUrl, { model, image: base64, settings }, { headers: this.HEADERS });
    if (data.code !== 100000 || !data.data.id) throw new Error(`Gagal: ${data.message}`);
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
      if (response.code !== 100000) throw new Error(`Cek status gagal: ${response.message}`);
      const { status, error, output, input } = response.data;
      if ((status === "succeeded" || status === "success") && output && input) {
        return { id: taskId, output, input, status };
      }
      if (status === "failed" || status === "fail" || error) throw new Error(`Gagal: ${error || "Unknown"}`);
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
    const config = { threshold: 0, reverse: false, background_type: "rgba", format: "png" };
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
    const config = { image_size: "auto", output_format: "png", prompt: prompt };
    const taskId = await this.createTask(apiUrl, model, image, config);
    return await this.pollTaskResult(resultUrl, taskId);
  }

  async ImageAIEditor(image, model, prompt, config = {}) {
    const apiUrl = "https://aienhancer.ai/api/v1/k/image-enhance/create";
    const resultUrl = "https://aienhancer.ai/api/v1/k/image-enhance/result";
    const modelId = ModelMap[model] || ModelMap.nano_banana;
    const defaultConfig = {
      size: "4K", aspect_ratio: "match_input_image", go_fast: true,
      prompt: prompt, output_quality: 100, disable_safety_checker: true, ...config
    };
    const taskId = await this.createTask(apiUrl, modelId, image, defaultConfig);
    return await this.pollTaskResult(resultUrl, taskId);
  }

  async customAnime(image, customPrompt) {
    const apiUrl = "https://aienhancer.ai/api/v1/r/image-enhance/create";
    const resultUrl = "https://aienhancer.ai/api/v1/r/image-enhance/result";
    const model = 5;
    const config = {
      size: "4K", aspect_ratio: "match_input_image", output_format: "png",
      sequential_image_generation: "disabled", max_images: 1, prompt: customPrompt
    };
    const taskId = await this.createTask(apiUrl, model, image, config);
    return await this.pollTaskResult(resultUrl, taskId);
  }
}

export default async function handler(req, res) {
  // Set CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Hanya POST' });

  try {
    const { image, action, style, prompt, scale, model } = req.body;
    if (!image) return res.status(400).json({ error: 'Tidak ada gambar' });

    const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    const ai = new AIEnhancer();
    let result;

    if (action === 'toanime') result = await ai.imageToAnime(buffer, style || 'anime');
    else if (action === 'rmbg') result = await ai.RemoveBackground(buffer);
    else if (action === 'upscale') {
      if (scale) result = await ai.AIImageUpscale(buffer, parseInt(scale));
      else if (prompt) result = await ai.AIImageUpscalePrompt(buffer, prompt);
    } else if (action === 'editimg') result = await ai.ImageAIEditor(buffer, model || 'nano_banana', prompt);
    else if (action === 'customanime') result = await ai.customAnime(buffer, prompt);
    else return res.status(400).json({ error: 'Action tidak valid' });

    res.status(200).json(result);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
}
