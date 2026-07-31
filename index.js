const express = require('express');
const cors = require('cors');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(__dirname));

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Probamos directamente con el modelo que me has indicado en la captura
const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash" });

app.post('/api/analizar', async (req, res) => {
    try {
        const { mensaje, imagen } = req.body;
        let contenido = [mensaje || "Analiza esta consulta de bricolaje"];

        if (imagen) {
            contenido.push({
                inlineData: {
                    data: imagen,
                    mimeType: "image/jpeg"
                }
            });
        }

        const resultado = await model.generateContent(contenido);
        const respuesta = await resultado.response;
        
        res.json({ respuesta: respuesta.text() });
    } catch (error) {
        console.error("Error en Fixia:", error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Fixia escuchando en el puerto ${PORT}`);
});
