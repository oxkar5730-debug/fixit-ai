const { GoogleGenerativeAI } = require('@google/generative-ai');
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Añade esto temporalmente en tu index.js para que hable con Google al arrancar
async function verModelosPermitidos() {
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`);
        const data = await response.json();
        console.log("=== LISTA REAL DE MODELOS DISPONIBLES EN TU CUENTA ===");
        if (data.models) {
            data.models.forEach(m => console.log(m.name));
        } else {
            console.log(JSON.stringify(data, null, 2));
        }
    } catch (e) {
        console.error("Error al consultar modelos:", e);
    }
}
verModelosPermitidos();
