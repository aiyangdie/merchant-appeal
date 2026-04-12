import systemConfigModel from '../../models/SystemConfig.js';
import logger from '../../utils/logger.js';
import fetch from 'node-fetch'; // Should be global in Node 18+, but ensuring

class LLMService {
  async getConfig(userId = null) {
    // Logic to get active model config
    // For now simplistic version
    // In production: check user custom key, else system default
    const provider = await systemConfigModel.get('ai_provider') || 'deepseek';
    const apiKey = await systemConfigModel.get(`${provider}_api_key`);
    const model = await systemConfigModel.get(`${provider}_model`);
    const endpoint = provider === 'deepseek' ? 'https://api.deepseek.com/chat/completions' : 'https://open.bigmodel.cn/api/paas/v4/chat/completions';
    
    return { provider, apiKey, model, endpoint };
  }

  async streamChat(messages, res, onComplete) {
    const config = await this.getConfig();
    if (!config.apiKey) {
      res.write('Error: AI API Key not configured');
      res.end();
      return;
    }

    try {
      const response = await fetch(config.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`
        },
        body: JSON.stringify({
          model: config.model,
          messages,
          stream: true,
          temperature: 0.7
        })
      });

      if (!response.ok) {
        throw new Error(`AI API Error: ${response.statusText}`);
      }

      // Set headers for SSE if not set
      if (!res.headersSent) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
      }

      let fullText = '';

      // Stream processing
      // We need to parse SSE chunks to get the actual content
      // Format: data: {"id":..., "choices":[{"delta":{"content":"..."}}]}
      if (response.body.on) {
        response.body.on('data', (chunk) => {
          const lines = chunk.toString().split('\n');
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith('data: ')) continue;
            if (trimmed === 'data: [DONE]') continue;
            
            try {
              const json = JSON.parse(trimmed.slice(6));
              const content = json.choices?.[0]?.delta?.content || '';
              if (content) {
                fullText += content;
                // Forward the raw chunk to client
                res.write(trimmed + '\n\n');
              }
            } catch (e) {
              // ignore parse errors for partial chunks
            }
          }
        });

        response.body.on('end', () => {
          res.end();
          if (onComplete) onComplete(fullText);
        });
        
        response.body.on('error', (err) => {
          logger.error('Stream Error', err);
          res.end();
        });
      } else {
        // Fallback for non-stream response (rare if stream=true)
        const json = await response.json();
        const content = json.choices?.[0]?.message?.content || '';
        res.write(`data: ${JSON.stringify({choices:[{delta:{content}}]})}\n\n`);
        res.write('data: [DONE]\n\n');
        res.end();
        if (onComplete) onComplete(content);
      }

    } catch (error) {
      logger.error('LLM Call Error', error);
      res.write(`data: {"error": "${error.message}"}\n\n`);
      res.end();
    }
  }

  async completeChat(messages) {
    const config = await this.getConfig();
    if (!config.apiKey) throw new Error('AI API Key not configured');

    const response = await fetch(config.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        stream: false,
        temperature: 0.7
      })
    });

    if (!response.ok) {
      throw new Error(`AI API Error: ${response.statusText}`);
    }

    const json = await response.json();
    return json.choices?.[0]?.message?.content || '';
  }
}

export default new LLMService();
