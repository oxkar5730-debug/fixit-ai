const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
app.use(express.json({ limit: '30mb' }));

function getGeminiModel() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Falta la variable de entorno GEMINI_API_KEY en Render.");
  }
  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
}

app.get('/manifest.json', (req, res) => {
  res.json({
    "name": "FixIt",
    "short_name": "FixIt",
    "start_url": "/",
    "display": "standalone",
    "background_color": "#0f172a",
    "theme_color": "#2563eb",
    "description": "Diagnóstico de averías, reparaciones y repuestos.",
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
      return res.status(400).json({ success: false, error: 'No se ha proporcionado ninguna imagen.' });
    }

    const model = getGeminiModel();
    
    const prompt = 'Actúa como un maestro experto en reparaciones, bricolaje, fontanería, carpintería, electricidad y electrodomésticos. Analiza la imagen aportada y devuelve una respuesta en formato JSON puro (sin bloques de código markdown, solo el texto JSON plano).\n\nEstructura obligatoria del JSON:\n{\n  "object_name": "Nombre claro del objeto o avería detectada",\n  "verdict": {\n    "summary": "Resumen directo del problema en una frase",\n    "detailed_analysis": "Explicación detallada de los daños visibles y qué ha provocado la avería."\n  },\n  "solution": {\n    "needs_pro": false,\n    "pro_reason": "",\n    "steps": [\n      "Paso 1 detallado para solucionarlo",\n      "Paso 2 detallado"\n    ],\n    "amazon_parts": [\n      {\n        "name": "Nombre de la pieza o herramienta necesaria",\n        "search_query": "Termino de busqueda optimizado para Amazon"\n      }\n    ]\n  }\n}\n\nNota de seguridad: Si la foto muestra un peligro crítico, pon "needs_pro": true, rellena "pro_reason", y deja "steps" y "amazon_parts" como arrays vacíos [].';

    const result = await model.generateContent([
      prompt,
      { inlineData: { data: imageBase64, mimeType: mimeType || 'image/jpeg' } }
    ]);

    const rawText = result.response.text();
    const cleanJsonString = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
    
    let parsedData;
    try {
      parsedData = JSON.parse(cleanJsonString);
    } catch (parseError) {
      console.error("Error al parsear respuesta de Gemini:", rawText);
      return res.status(500).json({ 
        success: false, 
        error: 'La IA no pudo procesar correctamente la imagen. Intenta hacer otra foto con mejor luz.' 
      });
    }

    return res.json({ success: true, data: parsedData });

  } catch (error) {
    console.error('Error en /api/diagnose:', error);
    return res.status(500).json({ success: false, error: error.message || 'Error interno al analizar la foto.' });
  }
});

app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'Mensaje vacío.' });

    const model = getGeminiModel();
    const prompt = `Eres el asistente técnico de FixIt, experto en reparaciones. Responde a: "${message}"`;

    const result = await model.generateContent(prompt);
    res.json({ success: true, reply: result.response.text() });
  } catch (error) {
    console.error('Error en chat:', error);
    res.status(500).json({ error: 'Error al procesar el chat.' });
  }
});

const htmlContent = `<!DOCTYPE html>
<html lang="es" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <link rel="manifest" href="/manifest.json">
  <meta name="theme-color" content="#0f172a">
  <title>FixIt</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-slate-950 text-slate-100 font-sans min-h-screen flex flex-col justify-between select-none">

  <!-- Header -->
  <header class="w-full p-4 flex justify-between items-center border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-40">
    <h1 class="text-3xl font-black tracking-tight text-blue-500">FixIt</h1>
    <span class="text-xs font-mono text-slate-500 bg-slate-800 px-2 py-1 rounded">v1.2.0</span>
  </header>

  <!-- Contenido -->
  <main class="flex-1 p-4 max-w-md mx-auto w-full overflow-y-auto mb-16">

    <!-- INICIO / CÁMARA -->
    <section id="tab-home" class="space-y-5">
      <div class="border-2 border-dashed border-slate-700 hover:border-blue-500 rounded-3xl p-6 text-center bg-slate-900/60 transition cursor-pointer flex flex-col items-center justify-center min-h-[260px] relative overflow-hidden" onclick="document.getElementById('fileInput').click()">
        <input type="file" id="fileInput" accept="image/*" capture="environment" class="hidden" onchange="handleImageUpload(event)">
        
        <div id="camPrompt" class="space-y-3">
          <div class="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mx-auto border border-slate-700 shadow-inner">
            <svg class="w-10 h-10 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 011.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
          </div>
          <p class="text-sm font-medium text-slate-300">Toca para hacer una foto a la avería</p>
        </div>

        <img id="imgPreview" class="hidden absolute inset-0 w-full h-full object-cover">
      </div>

      <!-- Spinner -->
      <div id="homeLoading" class="hidden text-center py-6">
        <div class="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-500 border-t-transparent"></div>
        <p class="text-xs text-slate-400 mt-2">Analizando imagen con IA...</p>
      </div>

      <!-- Opciones -->
      <div id="homeOptions" class="hidden space-y-3 pt-2">
        <div class="bg-slate-900 border border-slate-800 p-3 rounded-xl text-center mb-2">
          <p class="text-[10px] uppercase font-bold text-slate-500">Objeto analizado</p>
          <p id="detectedObject" class="text-base font-bold text-blue-400"></p>
        </div>

        <button onclick="openModal('verdict')" class="w-full bg-slate-900 hover:bg-slate-800 border border-slate-700 p-4 rounded-2xl flex items-center justify-between text-left transition shadow-md group">
          <div class="flex items-center gap-3">
            <span class="text-xl text-blue-400">➔</span>
            <div>
              <h3 class="font-bold text-slate-100 group-hover:text-blue-400">Veredicto</h3>
              <p class="text-xs text-slate-400">¿Qué le pasa y cuál es el origen?</p>
            </div>
          </div>
        </button>

        <button onclick="openModal('solution')" class="w-full bg-slate-900 hover:bg-slate-800 border border-slate-700 p-4 rounded-2xl flex items-center justify-between text-left transition shadow-md group">
          <div class="flex items-center gap-3">
            <span class="text-xl text-emerald-400">➔</span>
            <div>
              <h3 class="font-bold text-slate-100 group-hover:text-emerald-400">Solución</h3>
              <p class="text-xs text-slate-400">Pasos de arreglo o repuestos de Amazon</p>
            </div>
          </div>
        </button>
      </div>
    </section>

    <!-- CHAT IA -->
    <section id="tab-chat" class="hidden flex flex-col h-[75vh] space-y-3">
      <div class="border-b border-slate-800 pb-2">
        <h2 class="text-lg font-bold text-slate-100">Asistente Técnico FixIt</h2>
        <p class="text-xs text-slate-400">Preguntas sobre bricolaje y reparaciones</p>
      </div>
      <div id="chatHistory" class="flex-1 overflow-y-auto space-y-3 p-3 bg-slate-900/50 rounded-2xl border border-slate-800 text-xs">
        <div class="bg-slate-800 p-3 rounded-xl text-slate-300 max-w-[85%]">¡Hola! Pregúntame lo que necesites sobre reparaciones.</div>
      </div>
      <div class="flex gap-2">
        <input type="text" id="chatMsg" placeholder="Escribe tu consulta..." class="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-3 text-xs focus:outline-none focus:border-blue-500">
        <button onclick="sendAppChat()" class="bg-blue-600 hover:bg-blue-500 text-white px-4 rounded-xl text-xs font-bold transition">Enviar</button>
      </div>
    </section>

    <!-- TIENDA REPUESTOS -->
    <section id="tab-shop" class="hidden space-y-4">
      <div class="border-b border-slate-800 pb-2">
        <h2 class="text-lg font-bold text-slate-100">Buscador de Repuestos</h2>
        <p class="text-xs text-slate-400">Filtra piezas en Amazon</p>
      </div>
      <div class="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-3">
        <div>
          <label class="text-xs text-slate-400 block mb-1">Buscar:</label>
          <input type="text" id="shopQuery" placeholder="Ej: Silicona antimoho, llave inglesa..." class="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-blue-500">
        </div>
        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="text-[10px] text-slate-400 block mb-1">Categoría:</label>
            <select id="shopCategory" class="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-slate-200">
              <option value="">Todas</option>
              <option value="fontaneria">Fontanería</option>
              <option value="carpinteria">Carpintería</option>
              <option value="electricidad">Electricidad</option>
              <option value="herramientas">Herramientas</option>
            </select>
          </div>
          <div>
            <label class="text-[10px] text-slate-400 block mb-1">Ordenar:</label>
            <select id="shopSort" class="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-slate-200">
              <option value="">Relevancia</option>
              <option value="precio mas bajo">Menor precio</option>
              <option value="precio mas alto">Mayor precio</option>
            </select>
          </div>
        </div>
        <button onclick="executeAmazonSearch()" class="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-2.5 rounded-xl text-xs transition">🛒 Buscar en Amazon</button>
      </div>
    </section>

  </main>

  <!-- MODAL -->
  <div id="modalOverlay" class="hidden fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
    <div class="bg-slate-900 border border-slate-800 w-full max-w-md rounded-2xl p-5 space-y-4 max-h-[80vh] overflow-y-auto relative">
      <button onclick="closeModal()" class="absolute top-4 right-4 text-slate-400 hover:text-white font-bold text-lg">✕</button>

      <div id="modalVerdictContent" class="hidden space-y-3">
        <h3 class="text-lg font-bold text-blue-400">📋 Veredicto</h3>
        <p id="verdictSummary" class="text-xs font-semibold text-white bg-slate-800 p-3 rounded-xl border border-slate-700"></p>
        <p id="verdictDetails" class="text-xs text-slate-300 leading-relaxed"></p>
      </div>

      <div id="modalSolutionContent" class="hidden space-y-3">
        <h3 class="text-lg font-bold text-emerald-400">🛠️ Solución</h3>
        <div id="proAlert" class="hidden bg-rose-950/60 border border-rose-800 p-4 rounded-xl text-xs text-rose-200 space-y-2">
          <p class="font-bold text-sm">⚠️ Requiere Profesional</p>
          <p id="proReason"></p>
        </div>
        <div id="diyContent" class="hidden space-y-4">
          <ol id="solutionSteps" class="space-y-2 text-xs text-slate-300 list-decimal ml-4"></ol>
          <div id="amazonLinksList" class="space-y-2"></div>
        </div>
      </div>
    </div>
  </div>

  <!-- NAVEGACIÓN INFERIOR -->
  <nav class="fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-800 py-2 px-6 flex justify-around items-center z-40">
    <button onclick="switchTab('chat')" id="nav-chat" class="flex flex-col items-center text-slate-500 transition"><svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"/></svg></button>
    <button onclick="switchTab('home')" id="nav-home" class="flex flex-col items-center text-blue-500 transition"><div class="bg-slate-800 border border-slate-700 p-2 rounded-xl"><svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg></div></button>
    <button onclick="switchTab('shop')" id="nav-shop" class="flex flex-col items-center text-slate-500 transition"><svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg></button>
  </nav>

  <script>
    var diagnosticResult = null;

    function switchTab(tab) {
      var tabs = ['home', 'chat', 'shop'];
      for (var i = 0; i < tabs.length; i++) {
        document.getElementById('tab-' + tabs[i]).classList.add('hidden');
        document.getElementById('nav-' + tabs[i]).className = "flex flex-col items-center text-slate-500 transition";
      }
      document.getElementById('tab-' + tab).classList.remove('hidden');
      document.getElementById('nav-' + tab).className = "flex flex-col items-center text-blue-500 transition";
    }

    async function handleImageUpload(e) {
      var file = e.target.files[0];
      if (!file) return;

      document.getElementById('camPrompt').classList.add('hidden');
      document.getElementById('homeLoading').classList.remove('hidden');
      document.getElementById('homeOptions').classList.add('hidden');

      var compressed = await compressImg(file, 900, 0.75);
      document.getElementById('imgPreview').src = compressed;
      document.getElementById('imgPreview').classList.remove('hidden');

      try {
        var res = await fetch('/api/diagnose', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64: compressed.split(',')[1], mimeType: 'image/jpeg' })
        });
        var payload = await res.json();

        if (payload.success) {
          diagnosticResult = payload.data;
          document.getElementById('detectedObject').innerText = diagnosticResult.object_name;
          document.getElementById('homeOptions').classList.remove('hidden');
        } else {
          alert('Error: ' + (payload.error || 'No se pudo interpretar la imagen.'));
          resetCam();
        }
      } catch (err) {
        alert('Error de red al enviar la foto.');
        resetCam();
      } finally {
        document.getElementById('homeLoading').classList.add('hidden');
      }
    }

    function resetCam() {
      document.getElementById('camPrompt').classList.remove('hidden');
      document.getElementById('imgPreview').classList.add('hidden');
      document.getElementById('fileInput').value = '';
    }

    function compressImg(file, maxWidth, quality) {
      return new Promise(function(resolve) {
        var reader = new FileReader();
        reader.onload = function(e) {
          var img = new Image();
          img.onload = function() {
            var canvas = document.createElement('canvas');
            var w = img.width, h = img.height;
            if (w > maxWidth) { h = Math.round((h * maxWidth) / w); w = maxWidth; }
            canvas.width = w; canvas.height = h;
            var ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, w, h);
            resolve(canvas.toDataURL('image/jpeg', quality));
          };
          img.src = e.target.result;
        };
        reader.readAsDataURL(file);
      });
    }

    function openModal(type) {
      if (!diagnosticResult) return;
      document.getElementById('modalOverlay').classList.remove('hidden');
      document.getElementById('modalVerdictContent').classList.add('hidden');
      document.getElementById('modalSolutionContent').classList.add('hidden');

      if (type === 'verdict') {
        document.getElementById('modalVerdictContent').classList.remove('hidden');
        document.getElementById('verdictSummary').innerText = diagnosticResult.verdict.summary;
        document.getElementById('verdictDetails').innerText = diagnosticResult.verdict.detailed_analysis;
      } else if (type === 'solution') {
        document.getElementById('modalSolutionContent').classList.remove('hidden');
        if (diagnosticResult.solution.needs_pro) {
          document.getElementById('proAlert').classList.remove('hidden');
          document.getElementById('proReason').innerText = diagnosticResult.solution.pro_reason;
          document.getElementById('diyContent').classList.add('hidden');
        } else {
          document.getElementById('proAlert').classList.add('hidden');
          document.getElementById('diyContent').classList.remove('hidden');
          
          var stepsHtml = '';
          var stepsArr = diagnosticResult.solution.steps || [];
          for (var i = 0; i < stepsArr.length; i++) {
            stepsHtml += '<li class="bg-slate-800 p-2 rounded-xl border border-slate-700">' + stepsArr[i] + '</li>';
          }
          document.getElementById('solutionSteps').innerHTML = stepsHtml;

          var partsHtml = '';
          var partsArr = diagnosticResult.solution.amazon_parts || [];
          for (var j = 0; j < partsArr.length; j++) {
            var item = partsArr[j];
            partsHtml += '<a href="https://www.amazon.es/s?k=' + encodeURIComponent(item.search_query) + '" target="_blank" class="block bg-blue-600/20 border border-blue-500/40 p-3 rounded-xl text-blue-300 font-semibold text-xs hover:bg-blue-600/30 transition flex items-center justify-between"><span>🛒 ' + item.name + '</span><span class="text-[10px] text-blue-400">Ver →</span></a>';
          }
          document.getElementById('amazonLinksList').innerHTML = partsHtml;
        }
      }
    }

    function closeModal() {
      document.getElementById('modalOverlay').classList.add('hidden');
    }

    async function sendAppChat() {
      var input = document.getElementById('chatMsg');
      var text = input.value.trim();
      if (!text) return;
      var history = document.getElementById('chatHistory');
      history.innerHTML += '<div class="bg-blue-600 p-3 rounded-xl text-white ml-auto max-w-[85%]" style="overflow-wrap: anywhere;">' + text + '</div>';
      input.value = '';
      history.scrollTop = history.scrollHeight;

      try {
        var res = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: text }) });
        var payload = await res.json();
        if (payload.success) {
          history.innerHTML += '<div class="bg-slate-800 p-3 rounded-xl text-slate-300 max-w-[85%]" style="overflow-wrap: anywhere;">' + payload.reply + '</div>';
          history.scrollTop = history.scrollHeight;
        }
      } catch (e) {
        history.innerHTML += '<div class="text-rose-400">Error de conexión.</div>';
 
