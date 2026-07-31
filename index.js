const express = require('express');
const cors = require('cors');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(__dirname));

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
let modeloActivo = null;

async function inicializarModeloDinamico() {
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`);
        const data = await response.json();
        
        if (data.models) {
            const candidato = data.models.find(m => 
                m.supportedGenerationMethods && 
                m.supportedGenerationMethods.includes("generateContent") &&
                m.name.includes("gemini") &&
                !m.name.includes("embedding")
            );
            
            if (candidato) {
                const nombreLimpio = candidato.name.replace("models/", "");
                modeloActivo = genAI.getGenerativeModel({ model: nombreLimpio });
                console.log(`[EXITO] Modelo detectado y seleccionado automáticamente: ${nombreLimpio}`);
            } else {
                console.error("No se encontró ningún modelo de texto compatible en tu cuenta.");
            }
        }
    } catch (e) {
        console.error("Error al negociar el modelo con Google:", e);
    }
}

app.post('/api/analizar', async (req, res) => {
    try {
        if (!modeloActivo) {
            return res.status(500).json({ error: "El modelo de IA todavía se está inicializando o no está disponible." });
        }

        const { mensaje, imagen } = req.body;
        let contenido = [mensaje || "Analiza esta consulta"];

        if (imagen) {
            contenido.push({
                inlineData: {
                    data: imagen,
                    mimeType: "image/jpeg"
                }
            });
        }

        const resultado = await modeloActivo.generateContent(contenido);
        const respuesta = await resultado.response;
        
        res.json({ respuesta: respuesta.text() });
    } catch (error) {
        console.error("Error en la petición:", error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
    console.log(`Servidor arrancado en puerto ${PORT}`);
    await inicializarModeloDinamico();
});
