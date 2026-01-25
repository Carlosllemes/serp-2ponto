function base64EncodeUtf8(str) {
    return Buffer.from(str, 'utf8').toString('base64');
}

/**
 * Gera UULE (versão a+cm9...) a partir de lat/lng.
 * Baseado no formato “ascii” descrito em pesquisas públicas.
 * @param {number} lat
 * @param {number} lng
 * @param {number} radius
 * @returns {string} uule (URL-encoded pronto para querystring)
 */
function makeUuleFromLatLng(lat, lng, radius = 93000) {
    const latitude_e7 = Math.round(lat * 1e7);
    const longitude_e7 = Math.round(lng * 1e7);
    const timestamp = String(Date.now() * 1000); // micros

    const ascii = [
        'role:1',
        'producer:12',
        'provenance:6',
        `timestamp:${timestamp}`,
        'latlng{',
        `latitude_e7:${latitude_e7}`,
        `longitude_e7:${longitude_e7}`,
        '}',
        `radius:${radius}`,
        '',
    ].join('\n');

    const b64 = base64EncodeUtf8(ascii);
    // Importante: manter o '+' literal na string; para URL use encodeURIComponent.
    return encodeURIComponent(`a+${b64}`);
}

module.exports = {
    makeUuleFromLatLng,
};

