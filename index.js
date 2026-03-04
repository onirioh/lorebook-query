import { extension_settings, getContext } from "../../../extensions.js";
import { saveSettingsDebounced, eventSource, event_types } from "../../../../script.js";

const extensionName = "st-lorebook-tool";
const extensionFolderPath = `scripts/extensions/third-party/${extensionName}`;

// Ajustes por defecto para un nuevo personaje
const defaultCharSettings = {
    disabled: false,
    toolName: "consultar_lorebook",
    toolDesc: "Consulta el lorebook para buscar información relevante sobre el mundo, los personajes o los conceptos."
};

// Inicializa el objeto de ajustes si es la primera vez
function initSettings() {
    if (!extension_settings[extensionName]) {
        extension_settings[extensionName] = {
            global_disable: false,
            characters: {} // Guardaremos los ajustes usando el ID del personaje como llave
        };
    }
}

let currentCharacterId = null;
let registeredToolName = null; // Para recordar qué herramienta desregistrar

// Carga los ajustes del personaje actual en la interfaz
function loadCharacterSettings() {
    const context = getContext();
    currentCharacterId = context.characterId;
    
    // Si no hay personaje seleccionado, no hacemos nada
    if (currentCharacterId === undefined || currentCharacterId === null) return;
    
    const settings = extension_settings[extensionName];
    if (!settings.characters[currentCharacterId]) {
        // Asignamos los valores por defecto si el personaje no tiene configuración previa
        settings.characters[currentCharacterId] = { ...defaultCharSettings };
    }
    
    const charSettings = settings.characters[currentCharacterId];
    
    // Actualizamos el HTML
    $("#loretool_char_disable").prop("checked", charSettings.disabled);
    $("#loretool_name").val(charSettings.toolName);
    $("#loretool_desc").val(charSettings.toolDesc);
    
    updateToolRegistration();
}

// Guarda los ajustes de la interfaz cuando el usuario escribe o hace clic
function saveCharacterSettings() {
    if (currentCharacterId === undefined || currentCharacterId === null) return;
    
    const settings = extension_settings[extensionName];
    
    settings.characters[currentCharacterId] = {
        disabled: Boolean($("#loretool_char_disable").prop("checked")),
        toolName: String($("#loretool_name").val()).trim() || "consultar_lorebook",
        toolDesc: String($("#loretool_desc").val()).trim() || defaultCharSettings.toolDesc
    };
    
    saveSettingsDebounced();
    updateToolRegistration();
}

// Lógica de búsqueda simplificada en el World Info (Lorebook) de SillyTavern
function queryLorebook(keyword) {
    let results = [];
    // SillyTavern guarda las entradas del lorebook activo en la variable global world_info
    if (window.world_info && Array.isArray(window.world_info)) {
        for (let entry of window.world_info) {
             // Comprobamos si la palabra clave coincide con las llaves (keys) de la entrada
             if (entry.keys && entry.keys.some(k => k.toLowerCase().includes(keyword.toLowerCase()))) {
                 results.push(entry.content);
             }
        }
    }
    
    if (results.length > 0) {
        return results.join("\n\n");
    }
    return `No se encontró información en el lorebook para la palabra clave: ${keyword}`;
}

// Registra (o desregistra) la herramienta dependiendo de los ajustes
function updateToolRegistration() {
    const context = getContext();
    
    // Desregistra la herramienta anterior para evitar duplicados
    if (registeredToolName && context.isToolCallingSupported && context.isToolCallingSupported()) {
        context.unregisterFunctionTool(registeredToolName);
        registeredToolName = null;
    }
    
    const settings = extension_settings[extensionName];
    
    // 1. Verificación: ¿Está la extensión desactivada globalmente?
    if (settings.global_disable) return;
    // 2. Verificación: ¿Hay un personaje activo?
    if (currentCharacterId === undefined || currentCharacterId === null) return;
    
    const charSettings = settings.characters[currentCharacterId];
    
    // 3. Verificación: ¿Está desactivado para este personaje en específico?
    if (charSettings.disabled) return;
    
    // 4. Verificación: ¿La API actual soporta llamadas a herramientas?
    if (!context.isToolCallingSupported || !context.isToolCallingSupported()) return;
    
    const toolName = charSettings.toolName;
    const toolDesc = charSettings.toolDesc;
    
    // Registramos la herramienta para la IA
    context.registerFunctionTool({
        name: toolName,
        description: toolDesc,
        parameters: {
            type: "object",
            properties: {
                keyword: {
                    type: "string",
                    description: "La palabra clave o concepto a buscar en el lorebook."
                }
            },
            required: ["keyword"]
        },
        execute: (args) => {
            const result = queryLorebook(args.keyword);
            console.log(`[Lorebook Tool] La IA consultó: ${args.keyword}`);
            return result;
        },
        formatMessage: (args) => {
            // Este es el mensaje que se mostrará al usuario como "Toast" o notificación
            return `Consultando el lorebook por: ${args.keyword}`;
        }
    });
    
    registeredToolName = toolName;
}

// Guarda la configuración global
function onGlobalInput() {
    extension_settings[extensionName].global_disable = Boolean($("#loretool_global_disable").prop("checked"));
    saveSettingsDebounced();
    updateToolRegistration();
}

// Función principal que se ejecuta al cargar la extensión
jQuery(async () => {
    initSettings();
    
    // Cargamos la interfaz desde el archivo HTML
    const settingsHtml = await $.get(`${extensionFolderPath}/settings.html`);
    $("#extensions_settings").append(settingsHtml);
    
    // Configuramos los estados iniciales de la UI global
    $("#loretool_global_disable").prop("checked", extension_settings[extensionName].global_disable);
    
    // Escuchamos cambios en la interfaz
    $("#loretool_global_disable").on("input", onGlobalInput);
    $("#loretool_char_disable").on("input", saveCharacterSettings);
    $("#loretool_name").on("input", saveCharacterSettings);
    $("#loretool_desc").on("input", saveCharacterSettings);
    
    // Detectamos cuándo se cambia de chat/personaje para refrescar el menú y la herramienta
    if (window.eventSource) {
        window.eventSource.on(window.event_types.CHAT_CHANGED, loadCharacterSettings);
    }
    
    // Cargamos la configuración del personaje al iniciar por primera vez
    loadCharacterSettings();
});