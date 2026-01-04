import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { formatDistanceToNow } from 'date-fns';


interface ExecutiveLocation {
  id: string;
  staff_id: string;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  recorded_at: string;
  staff_name: string;
  staff_position: string;
  check_in: string | null;
}

interface Props {
  locations: ExecutiveLocation[];
}

// Custom marker icon
const createCustomIcon = () => {
  return L.divIcon({
    className: 'custom-marker',
    html: `<div style="background-color: hsl(var(--primary)); width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3);"></div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
};

export default function ExecutiveLocationsMap({ locations }: Props) {
  if (!locations || locations.length === 0) {
    return null;
  }

  return (
    <MapContainer
      center={[locations[0].latitude, locations[0].longitude]}
      zoom={13}
      style={{ height: '100%', width: '100%' }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {locations.map((loc) => (
        <Marker
          key={loc.id}
          position={[loc.latitude, loc.longitude]}
          icon={createCustomIcon()}
        >
          <Popup>
            <div className="text-sm">
              <p className="font-semibold">{loc.staff_name}</p>
              <p className="text-muted-foreground">{loc.staff_position}</p>
              <p className="text-xs mt-1">
                Updated {formatDistanceToNow(new Date(loc.recorded_at), { addSuffix: true })}
              </p>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
