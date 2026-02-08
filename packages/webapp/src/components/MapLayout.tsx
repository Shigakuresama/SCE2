import React, { useState, useCallback, useRef, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import { Property, AddressInput, PropertyStatus } from '../types';
import { fetchAddressesInBounds, Bounds } from '../lib/overpass';
import { isApartment } from '../lib/apartment-detector';
import { AddressSelectionManager } from './AddressSelectionManager';
import { RouteProcessor } from './RouteProcessor';

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
          'User-Agent': 'SCE2-Map-Selector',
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
  properties?: Property[];
  onPropertiesUpdated?: () => void;
}

type DrawMode = null | 'rectangle' | 'circle';

// Component to handle map events and drawing
function MapController({
  drawMode,
  onDrawComplete,
  onMapReady,
}: {
  drawMode: DrawMode;
  onDrawComplete: (bounds: Bounds) => void;
  onMapReady?: (map: L.Map) => void;
}) {
  const map = useMap();

  // Notify parent when map is ready
  useEffect(() => {
    if (map && onMapReady) {
      onMapReady(map);
    }
  }, [map, onMapReady]);
  const drawModeRef = useRef(drawMode);

  // Drawing state refs
  const rectangleStartRef = useRef<L.LatLng | null>(null);
  const rectangleMarkerRef = useRef<L.CircleMarker | null>(null);

  const circleCenterRef = useRef<L.LatLng | null>(null);
  const circleMarkerRef = useRef<L.CircleMarker | null>(null);
  const circleRadiusLineRef = useRef<L.Polyline | null>(null);

  // Update drawMode ref when prop changes
  useEffect(() => {
    drawModeRef.current = drawMode;
  }, [drawMode]);

  useEffect(() => {
    if (!drawMode) {
      // Clean up any existing drawing artifacts
      if (rectangleMarkerRef.current) {
        map.removeLayer(rectangleMarkerRef.current);
        rectangleMarkerRef.current = null;
      }
      if (circleMarkerRef.current) {
        map.removeLayer(circleMarkerRef.current);
        circleMarkerRef.current = null;
      }
      if (circleRadiusLineRef.current) {
        map.removeLayer(circleRadiusLineRef.current);
        circleRadiusLineRef.current = null;
      }
      return;
    }

    // Set cursor style
    const mapContainer = map.getContainer();
    mapContainer.style.cursor = 'crosshair';

    // Rectangle mode handlers
    const handleRectangleClick = (e: L.LeafletMouseEvent) => {
      if (drawModeRef.current !== 'rectangle') return;

      if (!rectangleStartRef.current) {
        // First click - set start point
        rectangleStartRef.current = e.latlng;

        // Add marker to show start point
        rectangleMarkerRef.current = L.circleMarker(e.latlng, {
          radius: 5,
          color: '#2196F3',
          fillColor: '#2196F3',
          fillOpacity: 0.8,
        }).addTo(map);

        console.log('[MapLayout] Rectangle start point:', e.latlng);
      } else {
        // Second click - complete rectangle
        const startPoint = rectangleStartRef.current;
        const bounds = L.latLngBounds(startPoint, e.latlng);

        // Draw rectangle
        L.rectangle(bounds, {
          color: '#2196F3',
          weight: 2,
          fillColor: '#2196F3',
          fillOpacity: 0.1,
        }).addTo(map);

        // Clean up marker
        if (rectangleMarkerRef.current) {
          map.removeLayer(rectangleMarkerRef.current);
          rectangleMarkerRef.current = null;
        }

        // Calculate bounds for API
        const north = bounds.getNorth();
        const south = bounds.getSouth();
        const east = bounds.getEast();
        const west = bounds.getWest();

        console.log('[MapLayout] Rectangle completed:', { north, south, east, west });

        // Trigger callback
        onDrawComplete({ north, south, east, west });

        // Reset state
        rectangleStartRef.current = null;
        mapContainer.style.cursor = '';
      }
    };

    const handleRectangleMove = (e: L.LeafletMouseEvent) => {
      if (drawModeRef.current !== 'rectangle' || !rectangleMarkerRef.current) return;

      // Move marker to show preview
      rectangleMarkerRef.current.setLatLng(e.latlng);
    };

    // Circle mode handlers
    const handleCircleClick = (e: L.LeafletMouseEvent) => {
      if (drawModeRef.current !== 'circle') return;

      if (!circleCenterRef.current) {
        // First click - set center
        circleCenterRef.current = e.latlng;

        // Add marker to show center
        circleMarkerRef.current = L.circleMarker(e.latlng, {
          radius: 5,
          color: '#FF9800',
          fillColor: '#FF9800',
          fillOpacity: 0.8,
        }).addTo(map);

        console.log('[MapLayout] Circle center:', e.latlng);
      } else {
        // Second click - complete circle
        const center = circleCenterRef.current;
        const radius = center.distanceTo(e.latlng);

        // Draw circle
        L.circle(center, {
          radius: radius,
          color: '#FF9800',
          weight: 2,
          fillColor: '#FF9800',
          fillOpacity: 0.1,
        }).addTo(map);

        // Calculate bounds for API (approximate bounding box)
        const latDelta = radius / 111000;
        const lngDelta = radius / (111000 * Math.cos(center.lat * Math.PI / 180));

        const north = center.lat + latDelta;
        const south = center.lat - latDelta;
        const east = center.lng + lngDelta;
        const west = center.lng - lngDelta;

        // Clean up
        if (circleMarkerRef.current) {
          map.removeLayer(circleMarkerRef.current);
          circleMarkerRef.current = null;
        }
        if (circleRadiusLineRef.current) {
          map.removeLayer(circleRadiusLineRef.current);
          circleRadiusLineRef.current = null;
        }

        console.log('[MapLayout] Circle completed - radius:', radius, 'meters');

        // Trigger callback
        onDrawComplete({ north, south, east, west });

        // Reset state
        circleCenterRef.current = null;
        mapContainer.style.cursor = '';
      }
    };

    const handleCircleMove = (e: L.LeafletMouseEvent) => {
      if (drawModeRef.current !== 'circle' || !circleCenterRef.current) return;

      // Show radius line
      if (circleRadiusLineRef.current) {
        circleRadiusLineRef.current.setLatLngs([circleCenterRef.current, e.latlng]);
      } else {
        circleRadiusLineRef.current = L.polyline([circleCenterRef.current, e.latlng], {
          color: '#FF9800',
          weight: 1,
          dashArray: '5, 10',
        }).addTo(map);
      }
    };

    // Add event listeners based on mode
    if (drawMode === 'rectangle') {
      map.on('click', handleRectangleClick);
      map.on('mousemove', handleRectangleMove);
    } else if (drawMode === 'circle') {
      map.on('click', handleCircleClick);
      map.on('mousemove', handleCircleMove);
    }

    // Cleanup - only remove listeners that were actually added
    return () => {
      if (drawMode === 'rectangle') {
        map.off('click', handleRectangleClick);
        map.off('mousemove', handleRectangleMove);
      } else if (drawMode === 'circle') {
        map.off('click', handleCircleClick);
        map.off('mousemove', handleCircleMove);
      }
      if (mapContainer.style.cursor === 'crosshair') {
        mapContainer.style.cursor = '';
      }
    };
  }, [map, drawMode, onDrawComplete]);

  return null;
}

export const MapLayout: React.FC<MapLayoutProps> = ({
  onAddressesSelected,
  existingProperties = [],
  properties: propList = [],
  onPropertiesUpdated,
}) => {
  // Unified property state: use existing properties from API, or propList, or local state
  const [localProperties, setLocalProperties] = useState<Property[]>([]);

  // The source of truth for properties shown on map and used in selection
  const properties = existingProperties.length > 0 ? existingProperties : (propList.length > 0 ? propList : localProperties);

  const [mapCenter] = useState<[number, number]>([33.8361, -117.8897]);
  const [loading, setLoading] = useState(false);
  const [hasSelectedArea, setHasSelectedArea] = useState(false);
  const [addressCount, setAddressCount] = useState(0);
  const [isClickToPinMode, setIsClickToPinMode] = useState(false);
  const [drawMode, setDrawMode] = useState<DrawMode>(null);
  const [clickMarkers, setClickMarkers] = useState<L.Marker[]>([]);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [mapInstance, setMapInstance] = useState<L.Map | null>(null);

  // Address selection state
  const [selectedProperties, setSelectedProperties] = useState<Property[]>([]);

  // Handler for when addresses are selected via map drawing or search
  // Must be defined before handleFetchAddresses since it depends on this
  const handleAddressesSelectedInternal = useCallback((addresses: AddressInput[]) => {
    // Convert AddressInput to local property format (string IDs for local, number for API)
    const newProps = addresses.map((addr, index) => {
      const now = new Date();
      return {
        id: `local_${now.getTime()}_${index}` as unknown as number, // Cast string to number for local use
        createdAt: now,
        updatedAt: now,
        addressFull: addr.addressFull,
        streetNumber: addr.streetNumber || null,
        streetName: addr.streetName || null,
        zipCode: addr.zipCode || null,
        city: addr.city || null,
        state: addr.state || null,
        latitude: addr.latitude || null,
        longitude: addr.longitude || null,
        customerName: null,
        customerPhone: null,
        customerEmail: null,
        customerAge: null,
        fieldNotes: null,
        sceCaseId: null,
        status: PropertyStatus.PENDING_SCRAPE,
        routeId: null,
      } as Property; // Cast to Property since local properties have string IDs internally
    });

    setLocalProperties(prev => [...prev, ...newProps]);

    // Also call the original callback if provided
    if (onAddressesSelected) {
      onAddressesSelected(addresses);
    }
  }, [onAddressesSelected]);

  // Handler to refresh properties from API (called after route processing)
  const handlePropertiesUpdated = useCallback(() => {
    if (onPropertiesUpdated) {
      onPropertiesUpdated();
    }
    // Also clear local properties when API refresh happens
    setLocalProperties([]);
  }, [onPropertiesUpdated]);

  const handleFetchAddresses = useCallback(
    async (bounds: Bounds) => {
      setLoading(true);
      setFetchError(null);
      try {
        const addresses = await fetchAddressesInBounds(bounds);
        setAddressCount(addresses.length);
        setHasSelectedArea(true);

        if (addresses.length > 0) {
          handleAddressesSelectedInternal(addresses);
          console.log(`[MapLayout] Found ${addresses.length} addresses`);
        } else {
          console.log('[MapLayout] No addresses found in selected area');
        }
      } catch (error) {
        console.error('Failed to fetch addresses:', error);
        setAddressCount(0);
        setFetchError(error instanceof Error ? error.message : 'Failed to fetch addresses');
      } finally {
        setLoading(false);
      }
    },
    [handleAddressesSelectedInternal]
  );

  const handleDrawComplete = useCallback(
    (bounds: Bounds) => {
      handleFetchAddresses(bounds);
      setDrawMode(null); // Exit draw mode after completion
    },
    [handleFetchAddresses, handleAddressesSelectedInternal]
  );

  // Handle map click for click-to-pin functionality
  const handleMapClick = async (e: L.LeafletMouseEvent) => {
    if (drawMode !== null) return; // Don't handle if in draw mode
    if (!isClickToPinMode) return;

    const { lat, lng } = e.latlng;
    console.log('[MapLayout] Clicked at:', lat, lng);

    const address = await reverseGeocode(lat, lng);

    if (!address) {
      console.error('[MapLayout] Failed to geocode clicked location');
      return;
    }

    console.log('[MapLayout] Geocoded address:', address);

    // Create marker (will be added when map ref is available)
    const markerId = `marker-${Date.now()}`;
    const marker = L.marker([lat, lng], { icon: pinIcon });
    marker.bindPopup(`
      <div style="min-width: 200px;">
        <strong>📍 ${address.streetNumber} ${address.streetName}</strong><br/>
        ${address.city}, ${address.state} ${address.zipCode}<br/>
        <button
          data-marker-id="${markerId}"
          style="margin-top: 8px; padding: 4px 12px; background: #ef4444; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;"
          onclick="window.sce2DeleteMarker && window.sce2DeleteMarker('${markerId}')"
        >
          🗑️ Delete Pin
        </button>
      </div>
    `);

    // Store marker ID on the marker object for lookup
    (marker as any).markerId = markerId;

    setClickMarkers((prev) => [...prev, marker]);

    // Queue the address using the internal handler
    handleAddressesSelectedInternal([address]);
    console.log('[MapLayout] Address queued successfully');
  };

  const handleEnableRectangle = () => {
    setDrawMode('rectangle');
    setIsClickToPinMode(false);
    setHasSelectedArea(false);
    setAddressCount(0);
    console.log('[MapLayout] Rectangle draw mode enabled - Click start point');
  };

  const handleEnableCircle = () => {
    setDrawMode('circle');
    setIsClickToPinMode(false);
    setHasSelectedArea(false);
    setAddressCount(0);
    console.log('[MapLayout] Circle draw mode enabled - Click center point');
  };

  const handleDisableDrawMode = () => {
    setDrawMode(null);
    setHasSelectedArea(false);
    setAddressCount(0);
    console.log('[MapLayout] Draw mode disabled');
  };

  const handleToggleClickToPin = () => {
    setIsClickToPinMode(!isClickToPinMode);
    setDrawMode(null);
    if (isClickToPinMode) {
      clickMarkers.forEach((marker) => marker.remove());
      setClickMarkers([]);
    }
  };

  const handleClearClickMarkers = () => {
    clickMarkers.forEach((marker) => marker.remove());
    setClickMarkers([]);
  };

  // Set up global delete handler for markers
  useEffect(() => {
    // @ts-ignore - Adding custom function to window
    window.sce2DeleteMarker = (markerId: string) => {
      setClickMarkers((prev) => {
        const markerToDelete = prev.find((m) => (m as any).markerId === markerId);
        if (markerToDelete) {
          markerToDelete.remove();
        }
        return prev.filter((m) => (m as any).markerId !== markerId);
      });
    };

    return () => {
      // @ts-ignore - Cleanup
      delete window.sce2DeleteMarker;
    };
  }, []);

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-blue-900 mb-2">
          🗺️ Map Address Selection
        </h3>

        {/* Address Search Bar */}
        <div className="flex items-center gap-2 mb-3">
          <div className="flex-1">
            <label className="text-xs font-semibold text-gray-600 mb-1 block">Search & Pin Address</label>
            <div className="flex gap-2">
              <input
                type="text"
                id="addressSearch"
                placeholder="1909 W Martha Ln, Santa Ana, CA"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    (document.getElementById('searchBtn') as HTMLButtonElement)?.click();
                  }
                }}
              />
              <button
                id="searchBtn"
                onClick={async () => {
                  const input = document.getElementById('addressSearch') as HTMLInputElement;
                  const address = input.value.trim();
                  if (!address) return;

                  // Show loading state
                  const btn = document.getElementById('searchBtn') as HTMLButtonElement;
                  btn.textContent = '⏳';
                  btn.disabled = true;

                  try {
                    // Use Nominatim to search for the address
                    const response = await fetch(
                      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address + ', Orange County, CA')}`,
                      {
                        headers: { 'User-Agent': 'SCE2-Map-Search' },
                      }
                    );

                    const data = await response.json();

                    if (data && data.length > 0) {
                      const result = data[0];
                      const lat = parseFloat(result.lat);
                      const lon = parseFloat(result.lon);

                      console.log('[MapLayout] Found address:', result.display_name, 'at', lat, lon);

                      // Move map to location and add pin
                      if (mapInstance) {
                        mapInstance.setView([lat, lon], 17);

                        // Create marker
                        const markerId = `marker-${Date.now()}`;
                        const marker = L.marker([lat, lon], { icon: pinIcon });
                        marker.bindPopup(`
                          <div style="min-width: 200px;">
                            <strong>📍 ${result.display_name}</strong><br/>
                            <button
                              data-marker-id="${markerId}"
                              style="margin-top: 8px; padding: 4px 12px; background: #ef4444; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;"
                              onclick="window.sce2DeleteMarker && window.sce2DeleteMarker('${markerId}')"
                            >
                              🗑️ Delete Pin
                            </button>
                          </div>
                        `).addTo(mapInstance);

                        // Store marker ID on the marker object for lookup
                        (marker as any).markerId = markerId;

                        setClickMarkers((prev) => [...prev, marker]);

                        // Queue the address
                        const addressData = {
                          addressFull: result.display_name,
                          streetNumber: '0',
                          streetName: result.display_name.split(',')[0]?.trim() || 'Unknown',
                          city: result.address?.city || result.address?.town || result.address?.village || null,
                          state: result.address?.state || 'CA',
                          zipCode: result.address?.postcode || '00000',
                          latitude: lat,
                          longitude: lon,
                        };

                        handleAddressesSelectedInternal([addressData]);
                        console.log('[MapLayout] Address queued successfully');

                        // Show success message
                        input.value = '';
                      }
                    } else {
                      alert('Address not found. Try:\n- Include the full address\n- Add "Orange County, CA" or the city name\n- Check the spelling');
                    }
                  } catch (error) {
                    console.error('[MapLayout] Search failed:', error);
                    alert('Failed to search for address. Please try again.');
                  } finally {
                    btn.textContent = '🔍';
                    btn.disabled = false;
                  }
                }}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm font-medium"
              >
                🔍
              </button>
            </div>
            <div className="text-xs text-gray-500">
              Type address and press Enter or click 🔍
            </div>
          </div>
        </div>

        {/* Draw mode buttons */}
        <div className="flex items-center gap-2 flex-wrap mb-3">
          <div className="text-sm text-blue-700 flex-1">
            <span className="font-medium">Drawing Tools:</span>
          </div>
          <button
            onClick={handleEnableRectangle}
            className={`px-4 py-2 rounded-md font-medium text-sm transition-colors ${
              drawMode === 'rectangle'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
            title="Click to set rectangle start point, click again to complete"
          >
            ⬜ Rectangle
          </button>
          <button
            onClick={handleEnableCircle}
            className={`px-4 py-2 rounded-md font-medium text-sm transition-colors ${
              drawMode === 'circle'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
            title="Click to set circle center, click again to set radius"
          >
            ⭕ Circle
          </button>
          {drawMode && (
            <button
              onClick={handleDisableDrawMode}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm font-medium"
            >
              Cancel
            </button>
          )}
        </div>

        {/* Instructions based on mode */}
        {drawMode === 'rectangle' && (
          <div className="bg-yellow-50 border border-yellow-200 rounded p-2 mb-3">
            <p className="text-sm text-yellow-800">
              <strong>Rectangle Mode:</strong> Click to set start point, move mouse, click again to complete rectangle
            </p>
          </div>
        )}
        {drawMode === 'circle' && (
          <div className="bg-yellow-50 border border-yellow-200 rounded p-2 mb-3">
            <p className="text-sm text-yellow-800">
              <strong>Circle Mode:</strong> Click to set center, move mouse to set radius, click again to complete
            </p>
          </div>
        )}

        {/* Click to pin mode */}
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

        {/* Loading indicator */}
        {loading && (
          <div className="mt-3 flex items-center">
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-600 mr-2"></div>
            <span className="text-sm text-blue-700">Fetching addresses...</span>
          </div>
        )}

        {/* Results */}
        {!loading && hasSelectedArea && (
          <div className="mt-3 bg-green-50 border border-green-200 rounded p-3">
            <div className="text-sm text-green-800">
              <span className="font-medium">Area selected!</span>
              <br />
              Found {addressCount} address{addressCount !== 1 ? 'es' : ''} in the selected area.
              {addressCount > 0 && ' These have been queued for scraping.'}
            </div>
          </div>
        )}

        {/* Error message */}
        {!loading && fetchError && (
          <div className="mt-3 bg-red-50 border border-red-200 rounded p-3">
            <div className="text-sm text-red-800">
              <span className="font-medium">Failed to fetch addresses:</span>
              <br />
              {fetchError}
              <br />
              <span className="text-xs">Tip: Try drawing a smaller area or wait a moment and try again.</span>
            </div>
          </div>
        )}
      </div>

      <MapContainer
        center={mapCenter}
        zoom={13}
        style={{ height: '500px', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Map controller for drawing and clicks */}
        <MapController
          drawMode={drawMode}
          onDrawComplete={handleDrawComplete}
          onMapReady={setMapInstance}
        />

        {/* Click handler wrapper */}
        <MapClickHandler onClick={handleMapClick} />

        {/* Show existing properties as markers */}
        {properties.map((prop) => {
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

      {/* Address Selection Manager */}
      <AddressSelectionManager
        properties={properties}
        setProperties={setLocalProperties}
        selectedProperties={selectedProperties}
        setSelectedProperties={setSelectedProperties}
        onEnablePinMode={() => setIsClickToPinMode(true)}
      />

      {/* Route Processor - Extract customer data from SCE */}
      {selectedProperties.length > 0 && (
        <RouteProcessor
          properties={properties}
          selectedProperties={selectedProperties}
          onProcessingComplete={(results) => {
            console.log('[MapLayout] Route processing complete:', results);
            handlePropertiesUpdated(); // Refresh properties from API
          }}
          onPropertiesUpdated={handlePropertiesUpdated}
        />
      )}

      {/* Selected Properties floating action bar */}
      {selectedProperties.length > 0 && (
        <div className="fixed bottom-4 right-4 bg-white rounded-lg shadow-lg p-4 z-[1000]">
          <div className="font-semibold mb-2">{selectedProperties.length} addresses selected</div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setSelectedProperties([]);
              }}
              className="px-3 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
            >
              Clear
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// Component to handle map click events
function MapClickHandler({ onClick }: { onClick: (e: L.LeafletMouseEvent) => void }) {
  const map = useMap();

  useEffect(() => {
    const handleClick = (e: L.LeafletMouseEvent) => {
      onClick(e);
    };

    map.on('click', handleClick);

    return () => {
      map.off('click', handleClick);
    };
  }, [map, onClick]);

  return null;
}
