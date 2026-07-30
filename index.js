import express from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';

const app = express();
app.use(express.json({ limit: '10mb' }));

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Endpoint manifiesto PWA para PWABuilder
app.get('/manifest.json', (req, res) => {
  res.json({
    "name": "FixIt AI",
    "short_name": "FixIt",
    "start_url": "/",
    "display": "standalone",
    "background_color": "#ffffff",
    "theme_color": "#2563eb",
    "description": "Diagnóstico inteligente de averías de electrodomésticos.",
    "icons": [
      {
        "src": "https://cdn-icons-png.flaticon.com/512/1041/1041886.png",
        "sizes": "512x512",
        "type": "image/png",
        "purpose": "any maskable"
      }
    ]
  });
});

app.post('/api/diagnose', async (req, res) => {
  try {
    const { imageBase64, mimeType } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ error: 'Se requiere una imagen' });
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt = `Eres FixIt AI, una herramienta experta en diagnóstico de electrodomésticos. 
    Analiza esta foto (código de error, etiqueta de serie o componente dañado). 
    Responde ÚNICAMENTE con un objeto JSON válido con este formato exacto:
    {
      "appliance_type": "Tipo de electrodoméstico (ej: Lavadora)",
      "detected_issue": "Descripción del fallo o código de error",
      "severity": "SAFE_DIY, ADVANCED_DIY o HAZARDOUS_PRO_REQUIRED",
      "safety_warnings": ["Lista de advertencias de seguridad"],
      "part_info": {
        "part_name": "Nombre de la pieza",
        "part_number": "Número de pieza o referencia"
      },
      "repair_steps": ["Paso 1", "Paso 2", "Paso 3"]
    }`;

    const imagePart = {
      inlineData: {
        data: imageBase64,
        mimeType: mimeType || 'image/jpeg'
      }
    };

    const result = await model.generateContent([prompt, imagePart]);
    const responseText = result.response.text();
    
    const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
    const diagnosticResult = JSON.parse(cleanJson);
    
    const partSearchQuery = encodeURIComponent(`${diagnosticResult.appliance_type} ${diagnosticResult.part_info.part_name} ${diagnosticResult.part_info.part_number}`);
    diagnosticResult.part_info.buy_url = `https://www.amazon.es/s?k=${partSearchQuery}`;

    res.json({ success: true, data: diagnosticResult });

  } catch (error) {
    console.error('Error de diagnóstico:', error);
    res.status(500).json({ error: 'Error al diagnosticar la imagen del electrodoméstico.' });
  }
});

app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="manifest" href="/manifest.json">
  <meta name="theme-color" content="#2563eb">
  <title>FixIt AI – Diagnóstico de Electrodomésticos</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-100 text-gray-900 font-sans min-h-screen p-4 flex flex-col items-center">

  <header class="w-full max-w-md text-center my-4">
    <h1 class="text-2xl font-bold text-blue-600">🛠️ FixIt AI</h1>
    <p class="text-sm text-gray-600">Haz una foto al código de error o pieza rota para un diagnóstico instantáneo.</p>
  </header>

  <main class="w-full max-w-md bg-white rounded-xl shadow-md p-5 space-y-4">
    <div class="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-500 transition cursor-pointer" onclick="document.getElementById('fileInput').click()">
      <input type="file" id="fileInput" accept="image/*" capture="environment" class="hidden" onchange="previewAndDiagnose(event)">
      <div id="uploadPrompt" class="space-y-2">
        <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 011.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
        <p class="text-sm font-medium text-gray-700">Toca para hacer foto o subir imagen</p>
      </div>
      <img id="preview" class="hidden w-full h-48 object-cover rounded-md">
    </div>

    <div id="loading" class="hidden text-center py-6">
      <div class="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-600 border-t-transparent"></div>
      <p class="text-sm text-gray-500 mt-2">Analizando imagen y detectando piezas...</p>
    </div>

    <div id="results" class="hidden space-y-4">
      <div class="flex justify-between items-start border-b pb-3">
        <div>
          <h2 id="applianceType" class="text-lg font-bold"></h2>
          <p id="detectedIssue" class="text-sm text-gray-600"></p>
        </div>
        <span id="severityBadge" class="px-2 py-1 text-xs font-bold rounded"></span>
      </div>

      <div id="warningContainer" class="bg-red-50 border-l-4 border-red-500 p-3 rounded text-sm text-red-700 hidden">
        <strong>⚠️ Advertencia de seguridad:</strong>
        <ul id="warningList" class="list-disc ml-5 mt-1"></ul>
      </div>

      <div class="bg-blue-50 p-4 rounded-lg border border-blue-200">
        <h3 class="text-xs uppercase font-bold text-blue-800 tracking-wider">Pieza de repuesto necesaria</h3>
        <p id="partName" class="font-bold text-gray-900 mt-1"></p>
        <p id="partNumber" class="text-xs text-gray-500"></p>
        <a id="buyBtn" href="#" target="_blank" class="mt-3 inline-block w-full text-center bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded transition text-sm">
          Buscar Repuesto Online →
        </a>
      </div>

      <div>
        <h3 class="font-bold text-sm mb-2">Pasos para la reparación:</h3>
        <ol id="stepsList" class="list-decimal ml-5 space-y-1 text-sm text-gray-700"></ol>
      </div>
    </div>
  </main>

  <script>
    async function previewAndDiagnose(event) {
      const file = event.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (e) => {
        document.getElementById('preview').src = e.target.result;
        document.getElementById('preview').classList.remove('hidden');
        document.getElementById('uploadPrompt').classList.add('hidden');
        document.getElementById('loading').classList.remove('hidden');
        document.getElementById('results').classList.add('hidden');

        const base64Data = e.target.result.split(',')[1];
        await sendForDiagnosis(base64Data, file.type);
      };
      reader.readAsDataURL(file);
    }

    async function sendForDiagnosis(imageBase64, mimeType) {
      try {
        const res = await fetch('/api/diagnose', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64, mimeType })
        });
        const payload = await res.json();
        
        if (payload.success) renderResults(payload.data);
        else alert('Error: ' + payload.error);
      } catch (err) {
        alert('Error en el diagnóstico.');
      } finally {
        document.getElementById('loading').classList.add('hidden');
      }
    }

    function renderResults(data) {
      document.getElementById('results').classList.remove('hidden');
      document.getElementById('applianceType').innerText = data.appliance_type;
      document.getElementById('detectedIssue').innerText = data.detected_issue;

      const badge = document.getElementById('severityBadge');
      badge.innerText = data.severity.replace(/_/g, ' ');
      if (data.severity === 'SAFE_DIY') badge.className = 'px-2 py-1 text-xs font-bold rounded bg-green-100 text-green-800';
      else if (data.severity === 'ADVANCED_DIY') badge.className = 'px-2 py-1 text-xs font-bold rounded bg-yellow-100 text-yellow-800';
      else badge.className = 'px-2 py-1 text-xs font-bold rounded bg-red-100 text-red-800';

      if (data.safety_warnings && data.safety_warnings.length > 0) {
        document.getElementById('warningContainer').classList.remove('hidden');
        document.getElementById('warningList').innerHTML = data.safety_warnings.map(w => \`<li>\${w}</li>\`).join('');
      }

      document.getElementById('partName').innerText = data.part_info.part_name;
      document.getElementById('partNumber').innerText = \`Nº de pieza: \${data.part_info.part_number}\`;
      document.getElementById('buyBtn').href = data.part_info.buy_url;

      document.getElementById('stepsList').innerHTML = data.repair_steps.map(s => \`<li>\${s}</li>\`).join('');
    }
  </script>
</body>
</html>
  `);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor activo en el puerto ${PORT}`));
