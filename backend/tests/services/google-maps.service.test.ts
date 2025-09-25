import { GoogleMapsService } from "../../src/services/google-maps.service";
import { logger } from "../../src/utils/logger";

// Mock fetch globally
global.fetch = jest.fn();
const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

// Mock logger
jest.mock("../../src/utils/logger", () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

describe("GoogleMapsService", () => {
  let googleMapsService: GoogleMapsService;
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      GOOGLE_MAPS_API_KEY: "test-api-key",
    };
    googleMapsService = new GoogleMapsService();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("constructor", () => {
    it("should throw error if API key is not provided", () => {
      delete process.env.GOOGLE_MAPS_API_KEY;
      expect(() => new GoogleMapsService()).toThrow(
        "GOOGLE_MAPS_API_KEY environment variable is required"
      );
    });

    it("should initialize with API key", () => {
      expect(() => new GoogleMapsService()).not.toThrow();
    });
  });

  describe("calculateRoute", () => {
    const mockRouteResponse = {
      status: "OK",
      routes: [
        {
          legs: [
            {
              distance: { text: "10.5 km", value: 10500 },
              duration: { text: "25 mins", value: 1500 },
              duration_in_traffic: { text: "30 mins", value: 1800 },
              end_address: "Destination Address",
              end_location: { lat: 52.2297, lng: 21.0122 },
              start_address: "Origin Address",
              start_location: { lat: 52.2297, lng: 21.0122 },
              steps: [
                {
                  distance: { text: "500 m", value: 500 },
                  duration: { text: "2 mins", value: 120 },
                  end_location: { lat: 52.2297, lng: 21.0122 },
                  html_instructions: "Head <b>north</b> on Test Street",
                  polyline: { points: "test_polyline" },
                  start_location: { lat: 52.2297, lng: 21.0122 },
                  travel_mode: "DRIVING",
                },
              ],
            },
          ],
          overview_polyline: { points: "overview_polyline" },
          summary: "Test Route",
          warnings: [],
          waypoint_order: [],
        },
      ],
    };

    it("should calculate route successfully", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockRouteResponse,
      } as Response);

      const request = {
        origin: "Warsaw, Poland",
        destination: "Krakow, Poland",
        departureTime: new Date("2024-01-01T08:00:00Z"),
      };

      const result = await googleMapsService.calculateRoute(request);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        distance: "10.5 km",
        duration: "25min",
        durationInTraffic: "30min",
        steps: [
          {
            instruction: "Head north on Test Street",
            distance: "500 m",
            duration: "2 mins",
          },
        ],
      });

      expect(logger.info).toHaveBeenCalledWith(
        "Calculating route with Google Maps API",
        expect.objectContaining({
          origin: request.origin,
          destination: request.destination,
        })
      );
    });

    it("should handle API error response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: "Bad Request",
      } as Response);

      const request = {
        origin: "Invalid Origin",
        destination: "Invalid Destination",
      };

      await expect(googleMapsService.calculateRoute(request)).rejects.toThrow(
        "Google Maps API request failed: 400 Bad Request"
      );

      expect(logger.error).toHaveBeenCalledWith(
        "Failed to calculate route",
        expect.objectContaining({
          error: "Google Maps API request failed: 400 Bad Request",
        })
      );
    });

    it("should handle API status error", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: "ZERO_RESULTS", routes: [] }),
      } as Response);

      const request = {
        origin: "Nowhere",
        destination: "Nowhere Else",
      };

      await expect(googleMapsService.calculateRoute(request)).rejects.toThrow(
        "Google Maps API error: ZERO_RESULTS"
      );
    });

    it("should handle network errors", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const request = {
        origin: "Warsaw, Poland",
        destination: "Krakow, Poland",
      };

      await expect(googleMapsService.calculateRoute(request)).rejects.toThrow(
        "Network error"
      );
    });
  });

  describe("calculateStillOnTimeRoute", () => {
    it("should calculate Dom→Panavision→Location route", async () => {
      const mockResponse = {
        status: "OK",
        routes: [
          {
            legs: [
              {
                distance: { text: "5.0 km", value: 5000 },
                duration: { text: "15 mins", value: 900 },
                duration_in_traffic: { text: "18 mins", value: 1080 },
                end_address: "Panavision Address",
                end_location: { lat: 52.2297, lng: 21.0122 },
                start_address: "Home Address",
                start_location: { lat: 52.2297, lng: 21.0122 },
                steps: [],
              },
              {
                distance: { text: "8.0 km", value: 8000 },
                duration: { text: "20 mins", value: 1200 },
                duration_in_traffic: { text: "25 mins", value: 1500 },
                end_address: "Location Address",
                end_location: { lat: 52.2297, lng: 21.0122 },
                start_address: "Panavision Address",
                start_location: { lat: 52.2297, lng: 21.0122 },
                steps: [],
              },
            ],
            overview_polyline: { points: "overview_polyline" },
            summary: "StillOnTime Route",
            warnings: [],
            waypoint_order: [0],
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await googleMapsService.calculateStillOnTimeRoute(
        "Home Address",
        "Panavision Address",
        "Location Address",
        new Date("2024-01-01T08:00:00Z")
      );

      expect(result).toHaveLength(1);
      expect(result[0].distance).toBe("13.0 km");
      expect(result[0].duration).toBe("35min");
      expect(result[0].durationInTraffic).toBe("43min");
    });
  });

  describe("validateAddress", () => {
    it("should validate address successfully", async () => {
      const mockGeocodingResponse = {
        status: "OK",
        results: [
          {
            formatted_address: "Warsaw, Poland",
            geometry: {
              location: {
                lat: 52.2297,
                lng: 21.0122,
              },
            },
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockGeocodingResponse,
      } as Response);

      const result = await googleMapsService.validateAddress("Warsaw, Poland");

      expect(result).toEqual({
        isValid: true,
        formattedAddress: "Warsaw, Poland",
        location: {
          lat: 52.2297,
          lng: 21.0122,
        },
      });
    });

    it("should return invalid for non-existent address", async () => {
      const mockGeocodingResponse = {
        status: "ZERO_RESULTS",
        results: [],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockGeocodingResponse,
      } as Response);

      const result = await googleMapsService.validateAddress("Invalid Address");

      expect(result).toEqual({
        isValid: false,
      });
    });

    it("should handle geocoding API errors", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Geocoding API error"));

      const result = await googleMapsService.validateAddress("Test Address");

      expect(result).toEqual({
        isValid: false,
      });

      expect(logger.error).toHaveBeenCalledWith(
        "Failed to validate address",
        expect.objectContaining({
          error: "Geocoding API error",
          address: "Test Address",
        })
      );
    });
  });

  describe("private methods", () => {
    describe("cleanHtmlInstructions", () => {
      it("should clean HTML tags from instructions", () => {
        const service = new GoogleMapsService();
        // Access private method for testing
        const cleanMethod = (service as any).cleanHtmlInstructions.bind(
          service
        );

        const htmlInstruction =
          "Head <b>north</b> on Test Street&nbsp;toward <div>Main St</div>";
        const cleaned = cleanMethod(htmlInstruction);

        expect(cleaned).toBe("Head north on Test Street toward Main St");
      });
    });

    describe("formatDistance", () => {
      it("should format distance in meters", () => {
        const service = new GoogleMapsService();
        const formatMethod = (service as any).formatDistance.bind(service);

        expect(formatMethod(500)).toBe("500 m");
        expect(formatMethod(1500)).toBe("1.5 km");
        expect(formatMethod(10000)).toBe("10.0 km");
      });
    });

    describe("formatDuration", () => {
      it("should format duration in seconds", () => {
        const service = new GoogleMapsService();
        const formatMethod = (service as any).formatDuration.bind(service);

        expect(formatMethod(300)).toBe("5min");
        expect(formatMethod(3600)).toBe("1h 0min");
        expect(formatMethod(3900)).toBe("1h 5min");
        expect(formatMethod(7200)).toBe("2h 0min");
      });
    });
  });

  describe("buildDirectionsUrl", () => {
    it("should build correct URL with all parameters", () => {
      const service = new GoogleMapsService();
      const buildUrlMethod = (service as any).buildDirectionsUrl.bind(service);

      const request = {
        origin: "Warsaw, Poland",
        destination: "Krakow, Poland",
        waypoints: ["Katowice, Poland"],
        departureTime: new Date("2024-01-01T08:00:00Z"),
        trafficModel: "best_guess" as const,
        alternatives: true,
      };

      const url = buildUrlMethod(request);

      expect(url).toContain("origin=Warsaw%2C+Poland");
      expect(url).toContain("destination=Krakow%2C+Poland");
      expect(url).toContain("waypoints=Katowice%2C+Poland");
      expect(url).toContain("departure_time=1704096000");
      expect(url).toContain("traffic_model=best_guess");
      expect(url).toContain("alternatives=true");
      expect(url).toContain("units=metric");
      expect(url).toContain("language=pl");
      expect(url).toContain("key=test-api-key");
    });
  });
});
