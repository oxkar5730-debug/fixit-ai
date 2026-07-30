const express = require('express');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
app.use(express.json({ limit: '30mb' }));

function getGeminiModel() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Falta la variable GEMINI_API_KEY en Render.");
  return new GoogleGenerativeAI(apiKey).getGenerativeModel({ model: 'gemini-2.0-flash' });
}

app.get('/manifest.json', (req, res) => {
  res.json({
    "name": "Fixia",
    "short_name": "Fixia",
    "start_url": "/",
    "display": "standalone",
    "background_color": "#09090b",
    "theme_color": "#f59e0b",
    "description": "Diagnóstico de averías, reparaciones y repuestos.",
    "icons": [{ "src": "https://cdn-icons-png.flaticon.com/512/1041/1041886.png", "sizes": "512x512", "type": "image/png" }]
  });
});

app.post('/api/diagnose', async (req, res) => {
  try {
    const { imageBase64, mimeType, userNote } = req.body;
    if (!imageBase64) return res.status(400).json({ success: false, error: 'No hay imagen.' });

    const model = getGeminiModel();
    let prompt = 'Actúa como un maestro experto en reparaciones y bricolaje. Analiza la imagen y la descripción aportada y devuelve un JSON puro (sin bloques markdown):\n{\n  "object_name": "Nombre de la avería",\n  "verdict": {\n    "summary": "Resumen en una frase",\n    "detailed_analysis": "Explicación detallada"\n  },\n  "solution": {\n    "needs_pro": false,\n    "pro_reason": "",\n    "steps": ["Paso 1", "Paso 2"],\n    "amazon_parts": [{"name": "Pieza", "search_query": "busqueda amazon"}]\n  }\n}';

    if (userNote && userNote.trim() !== '') {
      prompt += `\n\nDescripción adicional del usuario sobre lo que ocurre: "${userNote}"`;
    }

    const result = await model.generateContent([
      prompt,
      { inlineData: { data: imageBase64, mimeType: mimeType || 'image/jpeg' } }
    ]);

    const clean = result.response.text().replace(/```json/gi, '').replace(/```/g, '').trim();
    res.json({ success: true, data: JSON.parse(clean) });
  } catch (error) {
    console.error('Error en diagnose:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ success: false, error: 'Mensaje vacío.' });
    
    const model = getGeminiModel();
    const result = await model.generateContent(`Eres el asistente técnico de Fixia, experto en reparaciones y bricolaje. Responde de forma útil, directa y cercana a: "${message}"`);
    
    res.json({ success: true, reply: result.response.text() });
  } catch (error) {
    console.error('Error en chat:', error);
    res.status(500).json({ success: false, error: error.message || 'Error en chat.' });
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`Fixia v1.4 en puerto ${PORT}`));
