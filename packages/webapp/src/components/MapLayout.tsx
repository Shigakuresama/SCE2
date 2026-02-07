import React, { useState, useCallback, useRef, useEffect } from 'react';
import { MapContainer, TileLayer, FeatureGroup, Marker, Popup } from 'react-leaflet';
import { EditControl } from 'react-leaflet-draw';
import L from 'leaflet';
import 'leaflet-draw/dist/leaflet.draw.css';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import { Property, AddressInput } from '../types';
import { searchAddress } from '../lib/geocoding';
import { isApartment } from '../lib/apartment-detector';

// Fix for default marker icons in react-leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

// Custom marker icons for apartments and houses
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
    ">🏢</div>
    <div style="
      position: absolute;
      bottom: -2px;
      right: -2px;
      background: #ff6b35;
      color: white;
      font-size: 7px;
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
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

// Constants for API and configuration
const OVERPASS_TIMEOUT = 25000; // 25 seconds for Overpass API

interface Bounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

interface AddressFromOverpass {
  id: number;
  lat: number;
  lon: number;
  tags: {
    ['addr:street']?: string;
    ['addr:city']?: string;
    ['addr:postcode']?: string;
    ['addr:housenumber']?: string;
  };
}

interface MapLayoutProps {
  onAddressesSelected: (addresses: AddressInput[]) => void;
  existingProperties?: Property[];
}

// Custom draw control with better styling
const DrawControl: React.FC<{
  onCreated: (e: any) => void;
  onDeleted: () => void;
}> = ({ onCreated, onDeleted }) => {
  return (
    <FeatureGroup>
      <EditControl
        position="topright"
        onCreated={onCreated}
        onDeleted={onDeleted}
        draw={{
          rectangle: {
            shapeOptions: {
              color: '#3388ff',
              weight: 2,
              fillOpacity: 0.2,
            },
            showArea: true,
            metric: true,
          },
          polygon: false,
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
          polyline: false,
        }}
        edit={{
          remove: true,
          edit: false,
        }}
      />
    </FeatureGroup>
  );
};

export const MapLayout: React.FC<MapLayoutProps> = ({
  onAddressesSelected,
  existingProperties = [],
}) => {
  const [mapCenter] = useState<[number, number]>([33.8361, -117.8897]); // Orange County, CA
  const [loading, setLoading] = useState(false);
  const [hasSelectedArea, setHasSelectedArea] = useState(false);
  const [currentBounds, setCurrentBounds] = useState<Bounds | null>(null);
  const [addressCount, setAddressCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const featureGroupRef = useRef<L.FeatureGroup>(null);
  const mapRef = useRef<L.Map | null>(null);

  // Track markers for cleanup
  const markersRef = useRef<L.Marker[]>([]);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<AddressInput | null>(null);

  const fetchAddressesInBounds = useCallback(
    async (bounds: Bounds) => {
      setLoading(true);
      setError(null);
      try {
        const bbox = `${bounds.west},${bounds.south},${bounds.east},${bounds.north}`;
        const query = `
          [out:json][timeout:25];
          (
            way["addr:street"]["addr:housenumber"](${bbox});
          );
          out body;
        `;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), OVERPASS_TIMEOUT);

        const response = await fetch(
          `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`,
          { signal: controller.signal }
        );
        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`Overpass API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();

        if (data.elements && data.elements.length > 0) {
          const addresses: AddressInput[] = data.elements
            .map((el: AddressFromOverpass) => {
              const street = el.tags['addr:street'];
              const housenumber = el.tags['addr:housenumber'];
              const city = el.tags['addr:city'];
              const postcode = el.tags['addr:postcode'];

              if (!street || !housenumber) {
                return null;
              }

              // Skip if no postcode (invalid address)
              if (!postcode) {
                return null;
              }

              return {
                addressFull: `${housenumber} ${street}, ${city || 'Unknown City'}, ${postcode}`,
                streetNumber: housenumber,
                streetName: street,
                zipCode: postcode,
                city: city || null,
                state: 'CA',
                latitude: el.lat,
                longitude: el.lon,
              };
            })
            .filter((addr: AddressInput | null): addr is AddressInput => addr !== null);

          setAddressCount(addresses.length);
          onAddressesSelected(addresses);
        } else {
          setAddressCount(0);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error('Failed to fetch addresses:', error);
        setError(`Failed to load addresses: ${message}`);
        setAddressCount(0);
      } finally {
        setLoading(false);
      }
    },
    [onAddressesSelected]
  );

  const handleCreated = (e: any) => {
    const layer = e.layer;

    if (layer instanceof L.Rectangle || layer instanceof L.Circle) {
      const bounds = layer.getBounds();
      const boundsObj = {
        north: bounds.getNorth(),
        south: bounds.getSouth(),
        east: bounds.getEast(),
        west: bounds.getWest(),
      };

      setCurrentBounds(boundsObj);
      setHasSelectedArea(true);
      fetchAddressesInBounds(boundsObj);
    }
  };

  const handleDeleted = () => {
    setHasSelectedArea(false);
    setCurrentBounds(null);
    setAddressCount(0);
  };

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

  const handleSearch = async () => {
    const trimmedQuery = searchQuery.trim();
    if (!trimmedQuery) return;

    setIsSearching(true);
    setSearchResult(null);
    setError(null);

    try {
      const result = await searchAddress(trimmedQuery);

      if (result) {
        const address: AddressInput = {
          addressFull: result.display_name,
          streetNumber: result.display_name.match(/^(\d+)/)?.[1] || '',
          streetName: result.display_name.replace(/^\d+\s+,?\s*/, '').split(',')[0]?.trim() || '',
          city: result.address.city || result.address.town || result.address.village || null,
          state: result.address.state || 'CA',
          zipCode: result.address.postcode || '',
          latitude: result.lat,
          longitude: result.lon,
        };

        setSearchResult(address);

        // Queue the found address
        await onAddressesSelected([address]);
        setAddressCount(1);
        setHasSelectedArea(true);

        // Pan map to the found location
        if (mapRef.current) {
          mapRef.current.setView([result.lat, result.lon], 16);
        }
      } else {
        setError('Address not found. Please check the address and try again.');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('Search failed:', error);
      setError(`Search failed: ${message}`);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  // Cleanup markers on unmount
  useEffect(() => {
    return () => {
      markersRef.current.forEach(marker => marker.remove());
      markersRef.current = [];
    };
  }, []);

  // Filter properties before rendering (performance optimization)
  const propertiesWithCoords = existingProperties.filter(
    prop => prop.latitude && prop.longitude
  );

  // Get origin URL for links (use window.location for proper origin)
  const originUrl = window.location.origin || 'http://localhost:5173';

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-blue-900 mb-2">
          🗺️ Map Address Selection
        </h3>
        <p className="text-sm text-blue-700 mb-3">
          Use the drawing tool (rectangle icon) in the top-right corner to draw a box on the map.
          All addresses in the selected area will be queued for scraping.
        </p>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="text-sm text-blue-700">
            <span className="font-medium">Instructions:</span>
            <ol className="list-decimal list-inside mt-1 space-y-1">
              <li>Click the rectangle/circle tool in the top-right corner</li>
              <li>Click and drag on the map to draw a shape</li>
              <li>Addresses will be fetched automatically</li>
            </ol>
          </div>
        </div>

        {/* Address Search */}
        <div className="mt-3 flex items-center gap-2">
          <input
            type="text"
            placeholder="Search address (e.g., 1909 W Martha Ln)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            className="flex-1 px-3 py-2 border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            disabled={isSearching}
          />
          <button
            onClick={handleSearch}
            disabled={isSearching || !searchQuery.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium"
          >
            {isSearching ? '🔍 Searching...' : '🔍 Search'}
          </button>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mt-3 bg-red-50 border border-red-200 rounded p-3">
            <div className="text-sm text-red-800">
              <span className="font-medium">Error:</span> {error}
            </div>
            <button
              onClick={() => setError(null)}
              className="mt-2 px-3 py-1 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm font-medium"
            >
              Dismiss
            </button>
          </div>
        )}

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
        center={mapCenter}
        zoom={13}
        style={{ height: '500px', width: '100%', zIndex: 0 }}
        ref={(map) => {
          if (map) {
            mapRef.current = map;
          }
        }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Show search result marker */}
        {searchResult && searchResult.latitude && searchResult.longitude && (
          <Marker
            position={[searchResult.latitude, searchResult.longitude]}
          >
            <Popup>
              <div className="text-sm">
                <strong>📍 Search Result</strong>
                <br />
                {searchResult.addressFull}
                <br />
                <span className="text-green-600">✓ Queued for scraping</span>
              </div>
            </Popup>
          </Marker>
        )}

        <FeatureGroup ref={featureGroupRef}>
          <DrawControl
            onCreated={handleCreated}
            onDeleted={handleDeleted}
          />
        </FeatureGroup>

        {/* Show existing properties as markers */}
        {propertiesWithCoords.map((prop) => {
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
                  <br />
                  {isApt && <span className="text-orange-600">🏢 Apartment Complex</span>}
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
                    href={`${originUrl}/properties/${prop.id}`}
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
