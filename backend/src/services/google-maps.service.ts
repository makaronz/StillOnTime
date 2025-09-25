import { google } from "googleapis";
import { logger } from "../utils/logger";
import { RouteResult, RouteStep } from "../types";

export interface GoogleMapsRouteRequest {
  origin: string;
  destination: string;
  waypoints?: string[];
  departureTime?: Date;
  trafficModel?: "best_guess" | "pessimistic" | "optimistic";
  alternatives?: boolean;
}

export interface GoogleMapsRouteResponse {
  routes: GoogleMapsRoute[];
  status: string;
}

export interface GoogleMapsRoute {
  legs: GoogleMapsLeg[];
  overview_polyline: {
    points: string;
  };
  summary: string;
  warnings: string[];
  waypoint_order: number[];
}

export interface GoogleMapsLeg {
  distance: {
    text: string;
    value: number;
  };
  duration: {
    text: string;
    value: number;
  };
  duration_in_traffic?: {
    text: string;
    value: number;
  };
  end_address: string;
  end_location: {
    lat: number;
    lng: number;
  };
  start_address: string;
  start_location: {
    lat: number;
    lng: number;
  };
  steps: GoogleMapsStep[];
}

export interface GoogleMapsStep {
  distance: {
    text: string;
    value: number;
  };
  duration: {
    text: string;
    value: number;
  };
  end_location: {
    lat: number;
    lng: number;
  };
  html_instructions: string;
  polyline: {
    points: string;
  };
  start_location: {
    lat: number;
    lng: number;
  };
  travel_mode: string;
}

export class GoogleMapsService {
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.GOOGLE_MAPS_API_KEY || "";
    if (!this.apiKey) {
      throw new Error("GOOGLE_MAPS_API_KEY environment variable is required");
    }
  }

  /**
   * Calculate route between origin and destination with optional waypoints
   */
  async calculateRoute(
    request: GoogleMapsRouteRequest
  ): Promise<RouteResult[]> {
    try {
      logger.info("Calculating route with Google Maps API", {
        origin: request.origin,
        destination: request.destination,
        waypoints: request.waypoints,
        departureTime: request.departureTime,
      });

      const url = this.buildDirectionsUrl(request);
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(
          `Google Maps API request failed: ${response.status} ${response.statusText}`
        );
      }

      const data = (await response.json()) as GoogleMapsRouteResponse;

      if (data.status !== "OK") {
        throw new Error(`Google Maps API error: ${data.status}`);
      }

      const routes = data.routes.map((route) => this.transformRoute(route));

      logger.info("Successfully calculated routes", {
        routeCount: routes.length,
        primaryRoute: routes[0]
          ? {
              distance: routes[0].distance,
              duration: routes[0].duration,
              durationInTraffic: routes[0].durationInTraffic,
            }
          : null,
      });

      return routes;
    } catch (error) {
      logger.error("Failed to calculate route", {
        error: error instanceof Error ? error.message : "Unknown error",
        request,
      });
      throw error;
    }
  }

  /**
   * Calculate Dom→Panavision→Location route for StillOnTime workflow
   */
  async calculateStillOnTimeRoute(
    homeAddress: string,
    panavisionAddress: string,
    locationAddress: string,
    departureTime?: Date
  ): Promise<RouteResult[]> {
    return this.calculateRoute({
      origin: homeAddress,
      destination: locationAddress,
      waypoints: [panavisionAddress],
      departureTime,
      trafficModel: "best_guess",
      alternatives: true,
    });
  }

  /**
   * Get alternative routes for the same origin/destination
   */
  async getAlternativeRoutes(
    origin: string,
    destination: string,
    departureTime?: Date
  ): Promise<RouteResult[]> {
    return this.calculateRoute({
      origin,
      destination,
      departureTime,
      trafficModel: "best_guess",
      alternatives: true,
    });
  }

  /**
   * Validate address using Google Maps Geocoding API
   */
  async validateAddress(address: string): Promise<{
    isValid: boolean;
    formattedAddress?: string;
    location?: { lat: number; lng: number };
  }> {
    try {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
        address
      )}&key=${this.apiKey}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Geocoding API request failed: ${response.status}`);
      }

      const data = (await response.json()) as any;

      if (data.status === "OK" && data.results.length > 0) {
        const result = data.results[0];
        return {
          isValid: true,
          formattedAddress: result.formatted_address,
          location: {
            lat: result.geometry.location.lat,
            lng: result.geometry.location.lng,
          },
        };
      }

      return { isValid: false };
    } catch (error) {
      logger.error("Failed to validate address", {
        error: error instanceof Error ? error.message : "Unknown error",
        address,
      });
      return { isValid: false };
    }
  }

  /**
   * Build Google Directions API URL
   */
  private buildDirectionsUrl(request: GoogleMapsRouteRequest): string {
    const baseUrl = "https://maps.googleapis.com/maps/api/directions/json";
    const params = new URLSearchParams({
      origin: request.origin,
      destination: request.destination,
      key: this.apiKey,
      units: "metric",
      language: "pl",
    });

    if (request.waypoints && request.waypoints.length > 0) {
      params.append("waypoints", request.waypoints.join("|"));
    }

    if (request.departureTime) {
      params.append(
        "departure_time",
        Math.floor(request.departureTime.getTime() / 1000).toString()
      );
    }

    if (request.trafficModel) {
      params.append("traffic_model", request.trafficModel);
    }

    if (request.alternatives) {
      params.append("alternatives", "true");
    }

    return `${baseUrl}?${params.toString()}`;
  }

  /**
   * Transform Google Maps route to our RouteResult format
   */
  private transformRoute(route: GoogleMapsRoute): RouteResult {
    const totalDistance = route.legs.reduce(
      (sum, leg) => sum + leg.distance.value,
      0
    );
    const totalDuration = route.legs.reduce(
      (sum, leg) => sum + leg.duration.value,
      0
    );
    const totalDurationInTraffic = route.legs.reduce((sum, leg) => {
      return sum + (leg.duration_in_traffic?.value || leg.duration.value);
    }, 0);

    const steps: RouteStep[] = route.legs.flatMap((leg) =>
      leg.steps.map((step) => ({
        instruction: this.cleanHtmlInstructions(step.html_instructions),
        distance: step.distance.text,
        duration: step.duration.text,
      }))
    );

    return {
      distance: this.formatDistance(totalDistance),
      duration: this.formatDuration(totalDuration),
      durationInTraffic: this.formatDuration(totalDurationInTraffic),
      steps,
    };
  }

  /**
   * Clean HTML instructions from Google Maps
   */
  private cleanHtmlInstructions(html: string): string {
    return html
      .replace(/<[^>]*>/g, "") // Remove HTML tags
      .replace(/&nbsp;/g, " ") // Replace &nbsp; with space
      .replace(/&amp;/g, "&") // Replace &amp; with &
      .trim();
  }

  /**
   * Format distance in meters to human-readable format
   */
  private formatDistance(meters: number): string {
    if (meters >= 1000) {
      return `${(meters / 1000).toFixed(1)} km`;
    }
    return `${meters} m`;
  }

  /**
   * Format duration in seconds to human-readable format
   */
  private formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (hours > 0) {
      return `${hours}h ${minutes}min`;
    }
    return `${minutes}min`;
  }
}
