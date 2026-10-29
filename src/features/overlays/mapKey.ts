import rough from 'roughjs';
import { LineStyles } from '../geojson/geojsonStyles';

/** Build the key locally so its line samples can use the map's actual styles. */
export function createMapKey(): HTMLDivElement {
    const key = document.createElement('div');
    key.className = 'map-key mini-map-key';
    key.innerHTML = `
        <h3>Map Key</h3>
        <div class="map-key-columns">
            <div class="map-key-column">
                <div class="key-item">
                    <div class="key-icon"></div>
                    <span>Public transport</span>
                </div>
                <div class="key-item">
                    <div class="key-icon"></div>
                    <span>Walking / cycling</span>
                </div>
                <div class="key-item">
                    <div class="key-icon">
                        <div class="key-photo-marker">
                            <img src="assets/photos/thumbnail/IMG_0715.webp" alt="Photo marker" />
                        </div>
                    </div>
                    <span>Photo</span>
                </div>
                <div class="key-item">
                    <div class="key-icon key-places">🚉 ☕️ ⛩️ 🌲</div>
                    <span>Places</span>
                </div>
            </div>
        </div>`;

    const lineIcons = key.querySelectorAll('.key-icon');
    lineIcons[0].appendChild(createLineSample(LineStyles.publicTransport));
    // Walking and cycling share a colour and weight. Ferries belong to public
    // transport here; the key deliberately shows one solid sample for that row.
    lineIcons[1].appendChild(createLineSample(LineStyles.walking));
    return key;
}

function createLineSample(style: typeof LineStyles.publicTransport | typeof LineStyles.walking): SVGSVGElement {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.classList.add('key-line');
    svg.setAttribute('viewBox', '0 0 36 12');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('opacity', String(style.opacity));
    // Leave room above and below the old bar's centreline for rough.js's wobble.
    // A constant seed keeps the small sketch identical on every page load.
    svg.appendChild(rough.svg(svg).line(3, 6, 33, 6, {
        seed: 10,
        disableMultiStroke: true,
        stroke: style.color,
        strokeWidth: style.weight,
    }));
    return svg;
}
