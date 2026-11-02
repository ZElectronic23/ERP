// Geofence math for attendance: distance to a circle geofence, or point-in-polygon when a
// polygon is defined. Pure functions — unit-testable and reused by the punch API.

export interface Geofence {
    id: string;
    name?: string;
    center_lat: number;
    center_lng: number;
    radius_m: number;
    polygon?: { lat: number; lng: number }[] | null;
}

const R = 6371000; // Earth radius (m)
const toRad = (d: number) => (d * Math.PI) / 180;

// Haversine great-circle distance in metres.
export function distanceMeters(aLat: number, aLng: number, bLat: number, bLng: number): number {
    const dLat = toRad(bLat - aLat);
    const dLng = toRad(bLng - aLng);
    const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

// Ray-casting point-in-polygon (polygon is an array of {lat,lng}).
export function pointInPolygon(lat: number, lng: number, poly: { lat: number; lng: number }[]): boolean {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const yi = poly[i].lat, xi = poly[i].lng;
        const yj = poly[j].lat, xj = poly[j].lng;
        const intersect = (yi > lat) !== (yj > lat) && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
        if (intersect) inside = !inside;
    }
    return inside;
}

export interface GeoCheck { within: boolean; distance_m: number; geofence_id: string | null; geofence_name?: string }

// Evaluate a GPS point against the employee's assigned geofences; returns the nearest and
// whether the point falls inside any of them.
export function evaluatePoint(lat: number, lng: number, fences: Geofence[]): GeoCheck {
    let best: GeoCheck = { within: false, distance_m: Infinity, geofence_id: null };
    for (const f of fences) {
        const d = Math.round(distanceMeters(lat, lng, f.center_lat, f.center_lng));
        const inPoly = Array.isArray(f.polygon) && f.polygon.length >= 3 ? pointInPolygon(lat, lng, f.polygon) : null;
        const within = inPoly !== null ? inPoly : d <= f.radius_m;
        if (within) return { within: true, distance_m: d, geofence_id: f.id, geofence_name: f.name };
        if (d < best.distance_m) best = { within: false, distance_m: d, geofence_id: f.id, geofence_name: f.name };
    }
    if (best.distance_m === Infinity) best.distance_m = 0;
    return best;
}
