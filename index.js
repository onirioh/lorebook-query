import { extension_settings } from '../../../extensions.js';
import { characters, this_chid } from '../../../main.js';
import { eventSource, event_types } from '../../../../script.js';
import { world_info } from '../../../world_info.js';
import { registerTool } from '../../../tools.js';

const MODULE_NAME = 'lorebook_query';
const DEFAULT_TOOL_NAME = 'query_lorebook';
const DEFAULT_TOOL_DESC = 'Search the lorebook or world info for a specific keyword or topic to get background information.';

// Setup default settings if they don't exist
if (!extension_settings[MODULE_NAME]) {
    extension_settings[MODULE_NAME] = {
        globalEnabled: true,
        characters: {}
    };
}

// Helper to get the current character's unique identifier (avatar string)
function getCharAvatar() {
    if (this_chid === undefined || !characters[this_chid]) return null;
    return characters[this_chid].avatar;
}

// Helper to fetch or initialize per-character settings
function getCharSettings() {
    const avatar = getCharAvatar();
    if (!avatar) return null;
    
    if (!extension_settings[MODULE_NAME].characters[avatar]) {
        extension_settings[MODULE_NAME].characters[avatar] = {
            enabled: true,
            toolName: DEFAULT_TOOL_NAME,
            toolDescription: DEFAULT_TOOL_DESC
        };
    }
    return extension_settings[MODULE_NAME].characters[avatar];
}

// The core search logic for the tool
async function performLorebookSearch(query) {
    if (!query) return "Error: No search query provided.";
    
    const q = query.toLowerCase().trim();
    let results = [];
    
    // Iterate through active SillyTavern world_info array
    for (const entry of world_info) {
        const keys = entry.key || [];
        const secondaryKeys = entry.keysecondary || [];
        const allKeys = [...keys, ...secondaryKeys].map(k => k.toLowerCase().trim());
        
        // Match if the query is in the key, or the key is in the query
        const matches = allKeys.some(k => k.includes(q) || q.includes(k));
        
        if (matches) {
            results.push(`**Lore Entry**: ${entry.content}`);
        }
    }
    
    if (results.length === 0) {
        return `No lorebook entries found matching "${query}".`;
    }
    
    // Limit to top 5 results to prevent massive context overflow
    if (results.length > 5) {
        results = results.slice(0, 5);
        results.push(`*(Note: More entries matched, but results were truncated for brevity. Try a more specific query.)*`);
    }
    
    return `Lorebook results for "${query}":\n\n${results.join('\n\n---\n\n')}`;
}

// -------------------------------------------------------------------------
// Tool Definition
// -------------------------------------------------------------------------
// We register this object ONCE. By modifying its properties directly, 
// SillyTavern will automatically send the updated name/desc to the LLM.

const lorebookTool = {
    name: DEFAULT_TOOL_NAME,
    description: DEFAULT_TOOL_DESC,
    parameters: {
        type: "object",
        properties: {
            query: {
                type: "string",
                description: "The keyword or topic to search for in the lorebook."
            }
        },
        required: ["query"]
    },
    callback: async (args) => {
        return await performLorebookSearch(args.query);
    },
    getIsEnabled: () => {
        // Master override
        if (!extension_settings[MODULE_NAME].globalEnabled) return false;
        
        // Per-character override
        const charSettings = getCharSettings();
        return charSettings ? charSettings.enabled : false;
    }
};

// -------------------------------------------------------------------------
// UI & Event Hooks
// -------------------------------------------------------------------------

function saveSettings() {
    // Standard ST global function for saving settings to settings.json
    if (typeof saveSettingsDebounced === 'function') {
        saveSettingsDebounced();
    }
}

function updateToolProperties() {
    const charSettings = getCharSettings();
    if (charSettings) {
        // Enforce valid tool names (no spaces, special chars)
        const safeName = (charSettings.toolName || DEFAULT_TOOL_NAME).replace(/[^a-zA-Z0-9_-]/g, '');
        lorebookTool.name = safeName;
        lorebookTool.description = charSettings.toolDescription || DEFAULT_TOOL_DESC;
    }
}

function refreshUI() {
    const isGlobalEnabled = extension_settings[MODULE_NAME].globalEnabled;
    $('#lbtc_global_enable').prop('checked', isGlobalEnabled);

    const charSettings = getCharSettings();
    if (charSettings) {
        $('#lbtc_char_settings_container').show();
        $('#lbtc_no_char_warning').hide();
        
        $('#lbtc_char_enable').prop('checked', charSettings.enabled);
        $('#lbtc_tool_name').val(charSettings.toolName);
        $('#lbtc_tool_desc').val(charSettings.toolDescription);
    } else {
        $('#lbtc_char_settings_container').hide();
        $('#lbtc_no_char_warning').show();
    }
}

async function init() {
    debugger;
    console.log("PENE");
    // Load the UI template and append it to the extensions settings menu
    const html = await $.get(`${extension_folder}/lorebook-tool-caller/index.html`);
    $('#extensions_settings').append(html);

    // Register the Tool with SillyTavern
    registerTool(lorebookTool);

    // Initial UI Setup
    refreshUI();
    updateToolProperties();

    // -- Event Listeners for UI --
    
    $('#lbtc_global_enable').on('change', function() {
        extension_settings[MODULE_NAME].globalEnabled = $(this).is(':checked');
        saveSettings();
    });

    $('#lbtc_char_enable').on('change', function() {
        const charSettings = getCharSettings();
        if (charSettings) {
            charSettings.enabled = $(this).is(':checked');
            saveSettings();
        }
    });

    $('#lbtc_tool_name').on('input', function() {
        const charSettings = getCharSettings();
        if (charSettings) {
            charSettings.toolName = $(this).val();
            updateToolProperties();
            saveSettings();
        }
    });

    $('#lbtc_tool_desc').on('input', function() {
        const charSettings = getCharSettings();
        if (charSettings) {
            charSettings.toolDescription = $(this).val();
            updateToolProperties();
            saveSettings();
        }
    });

    // When the user switches to a different character card
    eventSource.on(event_types.CHAT_CHANGED, () => {
        refreshUI();
        updateToolProperties();
    });
}

// Wait for SillyTavern extensions to be fully loaded before initializing
jQuery(async () => {
  console.log("AAAAAAAAAAAA");
    await init();
});