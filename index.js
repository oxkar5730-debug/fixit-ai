const express = require('express');
const cors = require('cors');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(__dirname));

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ID oficial de Amazon Afiliados
const AMAZON_TAG = "fixia01-21";

// Función para generar los enlaces de afiliado de Amazon
function generarEnlaceAmazon(material) {
    const query = encodeURIComponent(material);
    return `https://www.amazon.es/s?k=${query}&tag=${AMAZON_TAG}`;
}

// Modelos ordenados dando prioridad a la variante lite y alternativas modernas
const modelosRespaldo = [
    "gemini-3.5-flash-lite",
    "gemini-3.5-flash",
    "gemini-3.6-flash"
];

async function generarConRespaldoLite(contenido) {
    let ultimoError = null;

    for (const nombreModelo of modelosRespaldo) {
        try {
            console.log(`[Fixia] Intentando conectar con: ${nombreModelo}`);
            const model = genAI.getGenerativeModel({ model: nombreModelo });
            const resultado = await model.generateContent(contenido);
            const respuesta = await resultado.response;
            console.log(`[Fixia] ¡Éxito usando ${nombreModelo}!`);
            return respuesta;
        } catch (error) {
            console.log(`[Fixia] El modelo ${nombreModelo} falló:`, error.message);
            ultimoError = error;
            
            if (error.status === 503 || (error.message && error.message.includes('503'))) {
                await new Promise(resolve => setTimeout(resolve, 1500));
            }
        }
    }

    throw ultimoError;
}

app.post('/api/analizar', async (req, res) => {
    try {
        const { mensaje, imagen } = req.body;
        
        // Instrucción actualizada para exigir los enlaces de Amazon de cada material mencionado
        const instruccionFixia = "Eres Fixia, un asistente experto en bricolaje y reparaciones del hogar. Analiza la consulta y proporciona obligatoriamente la respuesta estructurada con los siguientes apartados: 1. Pasos o solución detallada, 2. Tiempo estimado de reparación, 3. Coste aproximado estimado (en euros), y 4. Lista de materiales y herramientas necesarias. IMPORTANTE: En el apartado 4, para cada material o herramienta que sea necesario adquirir, debes incluir obligatoriamente su enlace de búsqueda directa en Amazon usando exactamente este formato de URL: https://www.amazon.es/s?k=NOMBRE_DEL_MATERIAL&tag=fixia01-21 (reemplazando los espacios del nombre del material por signos de más +). No utilices ningún tipo de formato Markdown, asteriscos, almohadillas (#) ni negritas. Escribe todo en texto plano y limpio usando únicamente saltos de línea, incluyendo las URLs de Amazon correspondientes.\n\nConsulta del usuario: ";
        
        let textoConsulta = mensaje || "Analiza esta consulta de bricolaje";
        let contenido = [instruccionFixia + textoConsulta];

        if (imagen) {
            contenido.push({
                inlineData: {
                    data: imagen,
                    mimeType: "image/jpeg"
                }
            });
        }

        const respuestaObj = await generarConRespaldoLite(contenido);
        res.json({ respuesta: respuestaObj.text() });
    } catch (error) {
        console.error("Error crítico:", error);
        res.status(500).json({ error: "Los servidores están experimentando alta demanda. Por favor, prueba de nuevo en unos segundos." });
    }
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Fixia escuchando en el puerto ${PORT}`);
});
