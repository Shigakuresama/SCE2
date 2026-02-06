import React, { useState, useCallback, useRef } from 'react';
import { MapContainer, TileLayer, FeatureGroup, Marker, Popup } from 'react-leaflet';
import { EditControl } from 'react-leaflet-draw';
import L from 'leaflet';
import 'leaflet-draw/dist/leaflet.draw.css';
import { Property, AddressInput } from '../types';

// Fix for default marker icons in react-leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

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
          circle: false,
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
  const featureGroupRef = useRef<L.FeatureGroup>(null);

  const fetchAddressesInBounds = useCallback(
    async (bounds: Bounds) => {
      setLoading(true);
      try {
        const bbox = `${bounds.west},${bounds.south},${bounds.east},${bounds.north}`;
        const query = `
          [out:json][timeout:25];
          (
            way["addr:street"]["addr:housenumber"](${bbox});
          );
          out body;
        `;

        const response = await fetch(
          `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`
        );
        const data = await response.json();

        if (data.elements && data.elements.length > 0) {
          const addresses: AddressInput[] = data.elements
            .map((el: AddressFromOverpass) => {
              const street = el.tags['addr:street'];
              const housenumber = el.tags['addr:housenumber'];
              const city = el.tags['addr:city'];
              const postcode = el.tags['addr:postcode'];

              if (!street || !housenumber || !postcode) {
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
        console.error('Failed to fetch addresses:', error);
        setAddressCount(0);
      } finally {
        setLoading(false);
      }
    },
    [onAddressesSelected]
  );

  const handleCreated = (e: any) => {
    const layer = e.layer;

    if (layer instanceof L.Rectangle) {
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
              <li>Click the rectangle tool in the top-right corner</li>
              <li>Click and drag on the map to draw a box</li>
              <li>Addresses will be fetched automatically</li>
            </ol>
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
        center={mapCenter}
        zoom={13}
        style={{ height: '500px', width: '100%', zIndex: 0 }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <FeatureGroup ref={featureGroupRef}>
          <DrawControl
            onCreated={handleCreated}
            onDeleted={handleDeleted}
          />
        </FeatureGroup>

        {/* Show existing properties as markers */}
        {existingProperties.map((prop) => {
          if (!prop.latitude || !prop.longitude) return null;

          return (
            <Marker
              key={prop.id}
              position={[prop.latitude, prop.longitude]}
            >
              <Popup>
                <div className="text-sm">
                  <strong>{prop.addressFull}</strong>
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
