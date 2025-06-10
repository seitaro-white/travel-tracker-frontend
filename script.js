import { LineStyles } from './src/features/geojson/geojsonStyles.js';
import { addGeoJsonLineLayer, addGeoJsonPointLayer } from './src/features/geojson/geojsonService.js';
import { animateChainedGeoJson } from './src/features/animations/animateChainedFeatures.js';

// Function to initialize the map
function initializeMap(mapId, centerCoordinates, zoomLevel) {
    const map = L.map(mapId).setView(centerCoordinates, zoomLevel);
    L.tileLayer('https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.{ext}', {
        maxZoom: 20,
        attribution: '© <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        ext: 'png',
    }).addTo(map);
    return map;
}


// Specific callback for photo popups
function onEachPhotoFeature(feature, layer) {
    if (feature.properties && feature.properties.filepath) {

        layer.on('click', function () {
            showAnimatedPolaroid(feature);
        });
    }

    // Mouseover event (keep existing for marker icon hover effect)
    layer.on('mouseover', function () {
        const iconDiv = this._icon; // Get the L.divIcon's main div element
        if (iconDiv) {
            const imgElement = iconDiv.querySelector('img.photo-marker-image');
            if (imgElement) {
                // Apply hover styles by adding a class
                imgElement.classList.add('photo-marker-image-hover');
            }

            // Ensure the iconDiv container allows the (now larger) image to be fully visible
            // and that the iconDiv itself is on top.
            iconDiv.style.overflow = 'visible';
            iconDiv.style.zIndex = 1000;
        }
    });

    // Mouseout event (keep existing for marker icon hover effect)
    layer.on('mouseout', function () {
        const iconDiv = this._icon;
        if (iconDiv) {
            const imgElement = iconDiv.querySelector('img.photo-marker-image');
            if (imgElement) {
                // Revert to original styles by removing the class
                imgElement.classList.remove('photo-marker-image-hover');
            }

            //iconDiv.style.zIndex = ''; // Revert z-index if needed
            // iconDiv.style.overflow = 'hidden'; // Revert overflow if needed
        }
    });
}

// Specific callback for photo markers
function pointToLayerForPhotos(feature, latlng) {
    if (feature.properties && feature.properties.filepath) {
        const imagePath = `assets/geotagged_photos/thumbnail/${feature.properties.filepath}`;
        // Ensure the img fills the iconDiv and maintains its appearance
        const iconHtml = `<img src="${imagePath}" alt="Photo location" class="photo-marker-image">`;

        const customIcon = L.divIcon({
            html: iconHtml,
            className: '', // Set to empty to avoid default Leaflet divIcon styling
            iconSize: [20, 20], // This sets the initial size of the iconDiv
            iconAnchor: [10, 10], // Anchor should be center of the iconSize
            popupAnchor: [0, -10]
        });
        return L.marker(latlng, { icon: customIcon });
    }
    return L.marker(latlng); // Fallback to default marker
}


// NEW FUNCTIONS for animated polaroid

function showAnimatedPolaroid(feature) {
    // remove old overlay
    const existingWrapper = document.querySelector('.polaroid-animated-wrapper-overlay');
    if (existingWrapper) {
        existingWrapper.remove();
    }

    const imagePath = `assets/geotagged_photos/display/${feature.properties.filepath}`;
    const captionText = feature.properties.filename || feature.properties.filepath.split('/').pop() || "Photo";

    // Create overlay
    const wrapper = document.createElement('div');
    wrapper.className = 'polaroid-animated-wrapper-overlay';
    wrapper.onclick = function (event) {
        if (event.target === wrapper) {
            hideAnimatedPolaroidOnClick();
        }
    };

    // Create polaroid element
    const polaroidElement = document.createElement('div');
    polaroidElement.className = 'polaroid'; // Use existing .polaroid styles

    polaroidElement.innerHTML = `
        <img src="${imagePath}" alt="Photo">
        <p class="caption">${captionText}</p>
    `;

    // Prevent clicks on the polaroid itself from closing it via the wrapper's click listener
    polaroidElement.onclick = function (event) {
        event.stopPropagation();
    };

    wrapper.appendChild(polaroidElement);
    document.body.appendChild(wrapper);

    // Trigger the animation by adding 'visible' class to wrapper.
    // Using requestAnimationFrame ensures the element is in the DOM and initial styles are applied
    // before the class change, allowing the CSS transition to occur.
    requestAnimationFrame(() => {
        // A second rAF can help ensure the transition triggers reliably in all browsers
        requestAnimationFrame(() => {
            wrapper.classList.add('visible');
        });
    });
}

function hideAnimatedPolaroidOnClick() {
    const wrapper = document.querySelector('.polaroid-animated-wrapper-overlay');
    if (wrapper && wrapper.classList.contains('visible')) {
        wrapper.classList.remove('visible');

        // Listen for the end of the opacity transition on the wrapper to remove it from DOM
        const onTransitionEnd = (event) => {
            if (event.target === wrapper && event.propertyName === 'opacity') {
                if (wrapper.parentElement) { // Check again before removing
                    wrapper.remove();
                }
            }
        };
        wrapper.addEventListener('transitionend', onTransitionEnd, { once: true });
    }
}

// Main function to set up the map and layers
async function setupMap() {
  const map = initializeMap('map', [36.2048, 138.2529], 7);

  // Start the chained line animation using the separated animation service.
  await animateChainedGeoJson(
    map,
    'assets/lines/animation_tracks.geojson'
  );

  // Add various static GeoJSON line layers.
  await addGeoJsonLineLayer(map, 'assets/lines/public_transport.geojson', LineStyles.publicTransport);
  await addGeoJsonLineLayer(map, 'assets/lines/walking_routes.geojson',      LineStyles.walking);
  await addGeoJsonLineLayer(map, 'assets/lines/cycling_routes.geojson',      LineStyles.cycling);
  await addGeoJsonLineLayer(map, 'assets/lines/ferries.geojson',             LineStyles.ferry);

  // Configuration for and loading of point layers.
  const pointLayersConfig = [
      {
          type: 'point',
          filePath: 'assets/points/geotagged_photos.geojson',
          onEachFeature: onEachPhotoFeature,
          pointToLayer: pointToLayerForPhotos,
          staggerDelay: 1
      }
  ];

  for (const layerConfig of pointLayersConfig) {
      if (layerConfig.type === 'point') {
          const staggerMilliseconds = layerConfig.staggerDelay !== undefined ? layerConfig.staggerDelay : 50;
          await addGeoJsonPointLayer(map, layerConfig.filePath, layerConfig.onEachFeature, layerConfig.pointToLayer, staggerMilliseconds);
      }
  }

  // Example marker for Kyoto.
  const kyotoMarker = L.marker([35.0116, 135.7681]).addTo(map);
  kyotoMarker.bindPopup("<b>Kyoto</b><br>Historic former capital.");
}

// Wait for the DOM to be fully loaded before running map logic.
document.addEventListener('DOMContentLoaded', setupMap);