// Vite build-time flag; accepting only the literal string true is fail-closed.
export const speechEnabled = (env = import.meta.env) => env.VITE_SPEECH_TO_TEXT_ENABLED === 'true';
