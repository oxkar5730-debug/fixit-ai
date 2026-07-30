import express from 'express';
import { GoogleGenAI, Type } from '@google/genai';

const app = express();
app.use(express.json({ limit: '10mb' }));

// Inicializar el cliente de Google Gen AI usando variables de entorno
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Esquema de diagnóstico estructurado
const diagnosticSchema = {
  type: Type.OBJECT,
  properties: {
    appliance_type: { type: Type.STRING, description: 'Tipo de electrodoméstico (ej: Lavadora, Lavavajillas)' },
    detected_issue: { type: Type.STRING, description: 'Descripción breve del código de error o problema visible' },
    severity: { 
      type: Type.STRING, 
      enum: ['SAFE_DIY', 'ADVANCED_DIY', 'HAZARDOUS_PRO_REQUIRED'],
      description: 'Nivel de seguridad y dificultad de reparación' 
    },
    safety_warnings: { 
      type: Type.ARRAY, 
      items: { type: Type.STRING },
      description: 'Advertencias de seguridad importantes (ej: desenchufar primero)'
    },
    part_info: {
      type: Type.OBJECT,
      properties: {
        part_name: { type: Type.STRING },
        part_number: { type: Type.STRING, description: 'Número de pieza del fabricante o término de búsqueda' }
      },
      required: ['part_name', 'part_number']
    },
    repair_steps: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'Pasos claros (3-5) para solucionar el problema'
    }
  },
  required: ['appliance_type', 'detected_issue', 'severity', 'safety_warnings', 'part_info', 'repair_steps']
};

// 1. Endpoint API del Backend
app.post('/api/diagnose', async (req, res) => {
  try {
    const { imageBase64, mimeType } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ error: 'Se requiere una imagen' });
    }

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          inlineData: {
            mimeType: mimeType || 'image/jpeg',
            data: imageBase64
          }
        },
        `Eres FixIt AI, una herramienta experta en diagnóstico de electrodomésticos. 
         Analiza esta foto (código de error, etiqueta de serie o componente dañado). 
         Extrae el código de error o defecto visual, diagnostica el fallo exacto, 
         evalúa riesgos de seguridad y proporciona instrucciones de reparación paso a paso en español.`
      ],
      config: {
        responseMimeType: 'application/json',
        responseSchema: diagnosticSchema
      }
    });

    const diagnosticResult = JSON.parse(response.text);
    
    // Enlace de búsqueda de la pieza
    const partSearchQuery = encodeURIComponent(`${diagnosticResult.appliance_type} ${diagnosticResult.part_info.part_name} ${diagnosticResult.part_info.part_number}`);
    diagnosticResult.part_info.buy_url = `https://www.amazon.es/s?k=${partSearchQuery}`;

    res.json({ success: true, data: diagnosticResult });

  } catch (error) {
    console.error('Error de diagnóstico:', error);
    res.status(500).json({ error: 'Error al diagnosticar la imagen del electrodoméstico.' });
  }
});

// 2. Interfaz web integrada
app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>FixIt AI – Diagnóstico de Electrodomésticos</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-100 text-gray-900 font-sans min-h-screen p-4 flex flex-col items-center">

  <header class="w-full max-w-md text-center my-4">
    <h1 class="text-2xl font-bold text-blue-600">🛠️ FixIt AI</h1>
    <p class="text-sm text-gray-600">Haz una foto al código de error o pieza rota para un diagnóstico instantáneo.</p>
  </header>

  <main class="w-full max-w-md bg-white rounded-xl shadow-md p-5 space-y-4">
    <!-- Área de cámara/subida -->
    <div class="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-500 transition cursor-pointer" onclick="document.getElementById('fileInput').click()">
      <input type="file" id="fileInput" accept="image/*" capture="environment" class="hidden" onchange="previewAndDiagnose(event)">
      <div id="uploadPrompt" class="space-y-2">
        <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
        <p class="text-sm font-medium text-gray-700">Toca para hacer foto o subir imagen</p>
      </div>
      <img id="preview" class="hidden w-full h-48 object-cover rounded-md">
    </div>

    <!-- Estado de carga -->
    <div id="loading" class="hidden text-center py-6">
      <div class="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-600 border-t-transparent"></div>
      <p class="text-sm text-gray-500 mt-2">Analizando imagen y detectando piezas...</p>
    </div>

    <!-- Resultado del diagnóstico -->
    <div id="results" class="hidden space-y-4">
      <div class="flex justify-between items-start border-b pb-3">
        <div>
          <h2 id="applianceType" class="text-lg font-bold"></h2>
          <p id="detectedIssue" class="text-sm text-gray-600"></p>
        </div>
        <span id="severityBadge" class="px-2 py-1 text-xs font-bold rounded"></span>
      </div>

      <!-- Advertencias -->
      <div id="warningContainer" class="bg-red-50 border-l-4 border-red-500 p-3 rounded text-sm text-red-700 hidden">
        <strong>⚠️ Advertencia de seguridad:</strong>
        <ul id="warningList" class="list-disc ml-5 mt-1"></ul>
      </div>

      <!-- Ficha de repuesto -->
      <div class="bg-blue-50 p-4 rounded-lg border border-blue-200">
        <h3 class="text-xs uppercase font-bold text-blue-800 tracking-wider">Pieza de repuesto necesaria</h3>
        <p id="partName" class="font-bold text-gray-900 mt-1"></p>
        <p id="partNumber" class="text-xs text-gray-500"></p>
        <a id="buyBtn" href="#" target="_blank" class="mt-3 inline-block w-full text-center bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded transition text-sm">
          Buscar Repuesto Online →
        </a>
      </div>

      <!-- Pasos de reparación -->
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

      if (data.safety_warnings.length > 0) {
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
