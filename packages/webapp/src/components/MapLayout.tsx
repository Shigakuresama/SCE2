import React, { useState, useCallback, useRef, useEffect } from 'react';
import { MapContainer, TileLayer, FeatureGroup, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet-draw';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import { Property, AddressInput } from '../types';
import { fetchAddressesInBounds, Bounds } from '../lib/overpass';
import { isApartment } from '../lib/apartment-detector';

// Fix for default marker icons in react-leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

// Custom marker icons
const apartmentIcon = L.divIcon({
  className: 'custom-marker apartment-marker',
  html: `<div style="
    position: relative;
    width: 30px;
    height: 30px;
  ">
    <div style="
      position: absolute;
      font-size: 24px;
      color: #ff6b35;
      text-shadow: 0 1px 2px rgba(0,0,0,0.3);
    ">📍</div>
    <div style="
      position: absolute;
      bottom: -2px;
      right: -2px;
      background: #ff6b35;
      color: white;
      font-size: 8px;
      font-weight: bold;
      padding: 1px 3px;
      border-radius: 3px;
      border: 1px solid white;
    ">Apt</div>
  </div>`,
  iconSize: [30, 30],
  iconAnchor: [15, 30],
  popupAnchor: [0, -30],
});

const houseIcon = L.icon({
  iconUrl: markerIcon,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowUrl: markerShadow,
  shadowSize: [41, 41],
  shadowAnchor: [12, 41],
});

// Custom pin icon for click-to-pin (green)
const pinIcon = L.divIcon({
  className: 'custom-marker pin-marker',
  html: `<div style="
    position: relative;
    width: 30px;
    height: 30px;
  ">
    <div style="
      position: absolute;
      font-size: 24px;
      color: #22c55e;
      text-shadow: 0 1px 2px rgba(0,0,0,0.3);
    ">📌</div>
  </div>`,
  iconSize: [30, 30],
  iconAnchor: [15, 30],
  popupAnchor: [0, -30],
});

/**
 * Reverse geocode coordinates to get address using Nominatim (OSM)
 */
async function reverseGeocode(lat: number, lng: number): Promise<AddressInput | null> {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
      {
        headers: {
          'User-Agent': 'SCE2-Map-Selector', // Nominatim requires user-agent
        },
      }
    );

    if (!response.ok) {
      console.error('Nominatim API error:', response.status);
      return null;
    }

    const data = await response.json();

    if (!data || data.error) {
      return null;
    }

    const addr = data.address || {};
    const houseNumber = addr.house_number || '';
    const street = addr.road || addr.street || '';
    const city = addr.city || addr.town || addr.village || addr.suburb || '';
    const postcode = addr.postcode || '';
    const state = addr.state || 'CA';

    // Must have at least a street name
    if (!street) {
      return null;
    }

    return {
      addressFull: `${houseNumber} ${street}, ${city || 'Unknown'}, ${postcode || '00000'}`,
      streetNumber: houseNumber || '0',
      streetName: street,
      city: city || null,
      state: state,
      zipCode: postcode || '00000',
      latitude: lat,
      longitude: lng,
    };
  } catch (error) {
    console.error('Failed to reverse geocode:', error);
    return null;
  }
}

interface MapLayoutProps {
  onAddressesSelected: (addresses: AddressInput[]) => void;
  existingProperties?: Property[];
}

export const MapLayout: React.FC<MapLayoutProps> = ({
  onAddressesSelected,
  existingProperties = [],
}) => {
  const [mapCenter] = useState<[number, number]>([33.8361, -117.8897]); // Orange County, CA
  const [loading, setLoading] = useState(false);
  const [hasSelectedArea, setHasSelectedArea] = useState(false);
  const [currentBounds, setCurrentBounds] = useState<Bounds | null>(null);
  const [addressCount, setAddressCount] = useState(0);
  const [isClickToPinMode, setIsClickToPinMode] = useState(false);
  const [clickMarkers, setClickMarkers] = useState<L.Marker[]>([]);
  const mapRef = useRef<L.Map | null>(null);
  const featureGroupRef = useRef<L.FeatureGroup>(null);

  const handleFetchAddresses = useCallback(
    async (bounds: Bounds) => {
      setLoading(true);
      try {
        const addresses = await fetchAddressesInBounds(bounds);
        setAddressCount(addresses.length);
        if (addresses.length > 0) {
          onAddressesSelected(addresses);
        }
      } catch (error) {
        console.error('Failed to fetch addresses:', error);
        setAddressCount(0);
      } finally {
        setLoading(false);
      }
    },
    [onAddressesSelected]
  );

  // Initialize drawing controls when map is ready
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !featureGroupRef.current) return;

    // Add leaflet-draw controls
    const drawControl = new L.Control.Draw({
      position: 'topright',
      draw: {
        polygon: false,
        polyline: false,
        rectangle: {
          shapeOptions: {
            color: '#3388ff',
            weight: 2,
            fillOpacity: 0.2,
          },
          showArea: true,
          metric: true,
        },
        circle: {
          shapeOptions: {
            color: '#3388ff',
            weight: 2,
            fillOpacity: 0.2,
          },
          metric: true,
        },
        circlemarker: false,
        marker: false,
      },
      edit: {
        featureGroup: featureGroupRef.current,
        remove: true,
        edit: false,
      },
    });

    map.addControl(drawControl);

    // Disable map dragging when a draw tool is activated (using DRAWSTART event)
    map.on(L.Draw.Event.DRAWSTART, () => {
      map.dragging.disable();
      console.log('[MapLayout] Drawing mode activated - map dragging disabled');
    });

    // Re-enable map dragging when drawing is disabled (using DRAWSTOP event)
    map.on(L.Draw.Event.DRAWSTOP, () => {
      map.dragging.enable();
      console.log('[MapLayout] Drawing mode deactivated - map dragging enabled');
    });

    // Listen for draw:created events
    map.on(L.Draw.Event.CREATED, (e) => {
      const layer = (e as L.DrawEvents.Created).layer;
      featureGroupRef.current?.addLayer(layer);

      if (layer instanceof L.Rectangle || layer instanceof L.Circle) {
        const bounds = layer.getBounds();
        const boundsObj: Bounds = {
          north: bounds.getNorth(),
          south: bounds.getSouth(),
          east: bounds.getEast(),
          west: bounds.getWest(),
        };

        setCurrentBounds(boundsObj);
        setHasSelectedArea(true);
        handleFetchAddresses(boundsObj);
      }

      // Re-enable dragging after drawing is complete
      map.dragging.enable();
    });

    // Listen for draw:deleted events
    map.on(L.Draw.Event.DELETED, () => {
      setHasSelectedArea(false);
      setCurrentBounds(null);
      setAddressCount(0);
    });

    return () => {
      map.removeControl(drawControl);
      map.off(L.Draw.Event.DRAWSTART);
      map.off(L.Draw.Event.DRAWSTOP);
      map.off(L.Draw.Event.CREATED);
      map.off(L.Draw.Event.DELETED);
    };
  }, [handleFetchAddresses]);

  // Handle map click for click-to-pin functionality
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const handleMapClick = async (e: L.LeafletMouseEvent) => {
      if (!isClickToPinMode) return;

      const { lat, lng } = e.latlng;

      // Show loading state
      console.log('[MapLayout] Clicked at:', lat, lng);

      // Reverse geocode to get address
      const address = await reverseGeocode(lat, lng);

      if (!address) {
        console.error('[MapLayout] Failed to geocode clicked location');
        return;
      }

      console.log('[MapLayout] Geocoded address:', address);

      // Create marker
      const marker = L.marker([lat, lng], { icon: pinIcon });
      marker.bindPopup(`
        <div style="min-width: 200px;">
          <strong>📍 ${address.streetNumber} ${address.streetName}</strong><br/>
          ${address.city}, ${address.state} ${address.zipCode}<br/>
          <button
            onclick="window.queueAddress('${encodeURIComponent(JSON.stringify(address))}')"
            style="margin-top: 8px; padding: 4px 12px; background: #22c55e; color: white; border: none; border-radius: 4px; cursor: pointer;"
          >
            Queue for Scraping
          </button>
        </div>
      `);

      marker.addTo(map);

      // Add to markers list
      setClickMarkers(prev => [...prev, marker]);

      // Queue the address automatically
      try {
        await onAddressesSelected([address]);
        console.log('[MapLayout] Address queued successfully');
      } catch (error) {
        console.error('[MapLayout] Failed to queue address:', error);
      }
    };

  // Expose queueAddress function globally for popup button
    (window as any).queueAddress = async (encodedAddress: string) => {
      const address = JSON.parse(decodeURIComponent(encodedAddress));
      try {
        await onAddressesSelected([address]);
        alert('Address queued for scraping!');
      } catch (error) {
        console.error('Failed to queue address:', error);
        alert('Failed to queue address. See console for details.');
      }
    };

    map.on('click', handleMapClick);

    return () => {
      map.off('click', handleMapClick);
      delete (window as any).queueAddress;
    };
  }, [isClickToPinMode, onAddressesSelected]);

  const handleClearSelection = () => {
    if (featureGroupRef.current) {
      featureGroupRef.current.eachLayer((layer) => {
        featureGroupRef.current?.removeLayer(layer);
      });
    }
    setHasSelectedArea(false);
    setCurrentBounds(null);
    setAddressCount(0);
  };

  const handleToggleClickToPin = () => {
    setIsClickToPinMode(!isClickToPinMode);
    // Clear click markers when disabling
    if (isClickToPinMode) {
      clickMarkers.forEach(marker => marker.remove());
      setClickMarkers([]);
    }
  };

  const handleClearClickMarkers = () => {
    clickMarkers.forEach(marker => marker.remove());
    setClickMarkers([]);
  };

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-blue-900 mb-2">
          🗺️ Map Address Selection
        </h3>
        <p className="text-sm text-blue-700 mb-3">
          Use the drawing tools (rectangle or circle) in the top-right corner to draw a shape on the map.
          All addresses in the selected area will be queued for scraping.
        </p>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="text-sm text-blue-700">
            <span className="font-medium">Instructions:</span>
            <ol className="list-decimal list-inside mt-1 space-y-1">
              <li>Click the rectangle or circle tool in the top-right corner</li>
              <li>Click and drag on the map to draw a shape</li>
              <li>Addresses will be fetched automatically</li>
            </ol>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-blue-200">
          <div className="flex items-center gap-4">
            <button
              onClick={handleToggleClickToPin}
              className={`px-4 py-2 rounded-md font-medium text-sm transition-colors ${
                isClickToPinMode
                  ? 'bg-green-600 text-white hover:bg-green-700'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {isClickToPinMode ? '📍 Clicking Mode ON' : '📍 Click to Add Pin'}
            </button>
            <div className="text-sm text-blue-700">
              {isClickToPinMode
                ? 'Click anywhere on the map to add a pin and queue that address'
                : 'Enable click mode to add individual addresses by clicking on the map'}
            </div>
            {clickMarkers.length > 0 && (
              <button
                onClick={handleClearClickMarkers}
                className="px-3 py-1 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm font-medium"
              >
                Clear Pins ({clickMarkers.length})
              </button>
            )}
          </div>
        </div>

        {loading && (
          <div className="mt-3 flex items-center">
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-600 mr-2"></div>
            <span className="text-sm text-blue-700">Fetching addresses...</span>
          </div>
        )}

        {!loading && hasSelectedArea && (
          <div className="mt-3 bg-green-50 border border-green-200 rounded p-3">
            <div className="text-sm text-green-800">
              <span className="font-medium">Area selected!</span>
              <br />
              Found {addressCount} address{addressCount !== 1 ? 'es' : ''} in the selected area.
              {addressCount > 0 && ' These have been queued for scraping.'}
            </div>
            {currentBounds && (
              <div className="mt-2 text-xs text-green-700 font-mono bg-green-100 rounded p-2">
                Bounds: {currentBounds.north.toFixed(4)}, {currentBounds.south.toFixed(4)},{' '}
                {currentBounds.east.toFixed(4)}, {currentBounds.west.toFixed(4)}
              </div>
            )}
            <button
              onClick={handleClearSelection}
              className="mt-2 px-3 py-1 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm font-medium"
            >
              Clear Selection
            </button>
          </div>
        )}
      </div>

      <MapContainer
        ref={mapRef}
        center={mapCenter}
        zoom={13}
        style={{ height: '500px', width: '100%', zIndex: 0 }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <FeatureGroup ref={featureGroupRef}>
          {/* Drawing controls are added programmatically via useEffect */}
        </FeatureGroup>

        {/* Show existing properties as markers */}
        {existingProperties.map((prop) => {
          if (!prop.latitude || !prop.longitude) return null;

          const isApt = isApartment(prop);
          const icon = isApt ? apartmentIcon : houseIcon;

          return (
            <Marker
              key={prop.id}
              position={[prop.latitude, prop.longitude]}
              icon={icon}
            >
              <Popup>
                <div className="text-sm">
                  <strong>{prop.addressFull}</strong>
                  {isApt && (
                    <>
                      <br />
                      <span className="text-orange-600 font-medium">🏢 Apartment Complex</span>
                    </>
                  )}
                  <br />
                  Status: {prop.status}
                  {prop.customerName && (
                    <>
                      <br />
                      Customer: {prop.customerName}
                    </>
                  )}
                  <br />
                  <a
                    href={`http://localhost:5173/properties/${prop.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    View Details →
                  </a>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
};
