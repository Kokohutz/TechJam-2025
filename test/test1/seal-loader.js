import SEAL from 'node-seal/throws_wasm_web_es';

export async function initializeSEAL() {
    return await SEAL();
}