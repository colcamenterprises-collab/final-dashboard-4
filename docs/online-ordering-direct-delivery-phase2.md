# Online Ordering — Direct Delivery Map Phase 2

## Customer flow

1. Customer chooses Delivery at checkout.
2. Customer uses device location or taps the exact delivery point on the map.
3. The browser shows the configured restaurant delivery radius and immediately indicates whether the selected point is inside the service area.
4. Customer still enters villa, hotel/building, room/unit and driver instructions as delivery details.
5. The order sends latitude, longitude and the client-calculated distance to the server.
6. The server recalculates the distance from the restaurant coordinates and rejects locations outside the configured radius.
7. The server applies the configured standard delivery value and customer delivery charge rather than trusting fee values supplied by the browser.

## Stored order data

The ordering service adds these columns if they do not already exist:

- `delivery_latitude`
- `delivery_longitude`
- `delivery_distance_km`
- `delivery_in_service_area`

No manual database migration is required.

## Configuration

Online Ordering → Settings controls:

- restaurant latitude / longitude
- delivery enabled
- delivery radius (km)
- standard delivery value
- customer delivery charge

The settings page includes **Use Current Location** so the restaurant pin can be captured from a phone/tablet while physically at the restaurant.

## Map provider

The customer map uses Leaflet 1.9.4 with OpenStreetMap map tiles. It does not require a Google Maps or Mapbox API key.
