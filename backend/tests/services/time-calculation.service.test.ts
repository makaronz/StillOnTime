import { TimeCalculationService } from "../../src/services/time-calculation.service";
import { TimeBuffers } from "../../src/types";
import { logger } from "../../src/utils/logger";

// Mock logger
jest.mock("../../src/utils/logger", () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

describe("TimeCalculationService", () => {
  let timeCalculationService: TimeCalculationService;

  const defaultBuffers: TimeBuffers = {
    carChange: 15,
    parking: 10,
    entry: 10,
    traffic: 20,
    morningRoutine: 45,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    timeCalculationService = new TimeCalculationService();
  });

  describe("calculateTimeSchedule", () => {
    it("should calculate time schedule successfully", () => {
      const callTime = new Date("2024-01-15T08:00:00Z");
      const travelTimeMinutes = 45;

      const result = timeCalculationService.calculateTimeSchedule(
        callTime,
        travelTimeMinutes,
        defaultBuffers
      );

      expect(result).toEqual({
        wakeUpTime: new Date("2024-01-15T05:35:00Z"), // 8:00 - 2h 25min
        departureTime: new Date("2024-01-15T07:15:00Z"), // 8:00 - 45min
        arrivalTime: new Date("2024-01-15T08:00:00Z"),
        totalTravelMinutes: 145, // 45 + 100 buffers
        bufferBreakdown: {
          travelTime: 45,
          carChange: 15,
          parking: 10,
          entry: 10,
          traffic: 20,
          morningRoutine: 45,
          total: 145,
        },
        recommendations: expect.any(Array),
        warnings: expect.any(Array),
      });

      expect(logger.info).toHaveBeenCalledWith(
        "Calculating time schedule",
        expect.objectContaining({
          callTime: callTime.toISOString(),
          travelTimeMinutes,
          buffers: defaultBuffers,
        })
      );
    });

    it("should generate recommendations for early wake-up", () => {
      const callTime = new Date("2024-01-15T06:00:00Z"); // Early call time
      const travelTimeMinutes = 90; // Long travel

      const result = timeCalculationService.calculateTimeSchedule(
        callTime,
        travelTimeMinutes,
        defaultBuffers
      );

      expect(result.recommendations).toContainEqual(
        expect.objectContaining({
          type: "preparation",
          priority: "high",
          message: expect.stringContaining("Przygotuj wszystko wieczorem"),
        })
      );

      expect(result.recommendations).toContainEqual(
        expect.objectContaining({
          type: "departure_time",
          priority: "medium",
          message: expect.stringContaining("nocleg w pobliżu"),
        })
      );
    });

    it("should generate traffic buffer recommendations", () => {
      const callTime = new Date("2024-01-15T08:00:00Z");
      const travelTimeMinutes = 90; // Long travel
      const lowTrafficBuffers = { ...defaultBuffers, traffic: 10 }; // Low traffic buffer

      const result = timeCalculationService.calculateTimeSchedule(
        callTime,
        travelTimeMinutes,
        lowTrafficBuffers
      );

      expect(result.recommendations).toContainEqual(
        expect.objectContaining({
          type: "buffer_adjustment",
          priority: "medium",
          message: expect.stringContaining("Zwiększ bufor na korki"),
          suggestedChange: {
            field: "traffic",
            currentValue: 10,
            suggestedValue: 30,
          },
        })
      );
    });

    it("should handle weather conditions in options", () => {
      const callTime = new Date("2024-01-15T08:00:00Z");
      const travelTimeMinutes = 45;

      const result = timeCalculationService.calculateTimeSchedule(
        callTime,
        travelTimeMinutes,
        defaultBuffers,
        {
          weatherConditions: ["rain", "wind"],
          sceneType: "EXT",
        }
      );

      expect(result.recommendations).toContainEqual(
        expect.objectContaining({
          type: "preparation",
          priority: "medium",
          message: expect.stringContaining("prognozę pogody"),
        })
      );
    });

    it("should handle errors gracefully", () => {
      // Mock a method to throw an error
      const originalMethod = (timeCalculationService as any)
        .calculateBufferBreakdown;
      (timeCalculationService as any).calculateBufferBreakdown = jest.fn(() => {
        throw new Error("Test error");
      });

      const callTime = new Date("2024-01-15T08:00:00Z");

      expect(() => {
        timeCalculationService.calculateTimeSchedule(
          callTime,
          45,
          defaultBuffers
        );
      }).toThrow("Test error");

      expect(logger.error).toHaveBeenCalledWith(
        "Failed to calculate time schedule",
        expect.objectContaining({
          error: "Test error",
        })
      );

      // Restore original method
      (timeCalculationService as any).calculateBufferBreakdown = originalMethod;
    });
  });

  describe("validateTimeSchedule", () => {
    it("should validate reasonable time schedule", () => {
      const wakeUpTime = new Date("2024-01-15T06:00:00Z"); // 6:00 AM
      const callTime = new Date("2024-01-15T08:00:00Z");
      const shortMorningBuffers = { ...defaultBuffers, morningRoutine: 25 }; // Short morning routine

      const result = timeCalculationService.validateTimeSchedule(
        wakeUpTime,
        callTime,
        shortMorningBuffers,
        45
      );

      expect(result.isValid).toBe(true);
      expect(result.severity).toBe("info");
      expect(result.issues).toHaveLength(1); // Only morning routine suggestion
      expect(result.issues[0].type).toBe("insufficient_buffer");
      expect(result.issues[0].severity).toBe("info");
    });

    it("should flag extremely early wake-up as error", () => {
      const wakeUpTime = new Date("2024-01-15T02:30:00Z"); // 2:30 AM
      const callTime = new Date("2024-01-15T08:00:00Z");

      const result = timeCalculationService.validateTimeSchedule(
        wakeUpTime,
        callTime,
        defaultBuffers,
        45
      );

      expect(result.isValid).toBe(false);
      expect(result.severity).toBe("error");
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          type: "early_wakeup",
          severity: "error",
          message: expect.stringContaining("ekstremalnie wczesny"),
        })
      );
    });

    it("should flag very early wake-up as warning", () => {
      const wakeUpTime = new Date("2024-01-15T03:30:00Z"); // 3:30 AM
      const callTime = new Date("2024-01-15T08:00:00Z");

      const result = timeCalculationService.validateTimeSchedule(
        wakeUpTime,
        callTime,
        defaultBuffers,
        45
      );

      expect(result.isValid).toBe(true);
      expect(result.severity).toBe("warning");
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          type: "early_wakeup",
          severity: "warning",
          message: expect.stringContaining("bardzo wczesny"),
        })
      );
    });

    it("should flag excessive travel time", () => {
      const wakeUpTime = new Date("2024-01-15T06:00:00Z");
      const callTime = new Date("2024-01-15T08:00:00Z");
      const longTravelBuffers = { ...defaultBuffers, traffic: 120 }; // Make total > 240 min

      const result = timeCalculationService.validateTimeSchedule(
        wakeUpTime,
        callTime,
        longTravelBuffers,
        150 // Long travel time
      );

      expect(result.issues).toContainEqual(
        expect.objectContaining({
          type: "excessive_travel",
          severity: "warning",
          message: expect.stringContaining("bardzo długi"),
        })
      );
    });

    it("should flag insufficient traffic buffer", () => {
      const wakeUpTime = new Date("2024-01-15T06:00:00Z");
      const callTime = new Date("2024-01-15T08:00:00Z");
      const lowTrafficBuffers = { ...defaultBuffers, traffic: 10 };

      const result = timeCalculationService.validateTimeSchedule(
        wakeUpTime,
        callTime,
        lowTrafficBuffers,
        90 // Long enough to trigger warning
      );

      expect(result.issues).toContainEqual(
        expect.objectContaining({
          type: "insufficient_buffer",
          severity: "warning",
          message: expect.stringContaining("niewystarczający"),
        })
      );
    });
  });

  describe("generateOptimizedBuffers", () => {
    it("should optimize buffers for long travel", () => {
      const result = timeCalculationService.generateOptimizedBuffers(
        defaultBuffers,
        {
          travelTimeMinutes: 120, // Long travel
          timeOfDay: "early",
        }
      );

      expect(result.traffic).toBeGreaterThanOrEqual(30);
      expect(result.reasoning).toContain(
        "Zwiększono bufor ruchu ze względu na długą trasę"
      );
      expect(result.reasoning).toContain(
        "Zwiększono bufor ruchu ze względu na poranne godziny szczytu"
      );
    });

    it("should optimize buffers for bad weather", () => {
      const result = timeCalculationService.generateOptimizedBuffers(
        defaultBuffers,
        {
          travelTimeMinutes: 60,
          weatherConditions: ["rain", "wind"],
          sceneType: "EXT",
        }
      );

      expect(result.traffic).toBe(defaultBuffers.traffic + 15);
      expect(result.parking).toBe(defaultBuffers.parking + 5);
      expect(result.morningRoutine).toBe(defaultBuffers.morningRoutine + 10);
      expect(
        result.reasoning.some((r: string) =>
          r.includes("niekorzystne warunki pogodowe")
        )
      ).toBe(true);
      expect(
        result.reasoning.some((r: string) => r.includes("scen zewnętrznych"))
      ).toBe(true);
    });

    it("should optimize buffers for fog conditions", () => {
      const result = timeCalculationService.generateOptimizedBuffers(
        defaultBuffers,
        {
          travelTimeMinutes: 60,
          weatherConditions: ["fog"],
        }
      );

      expect(result.traffic).toBe(defaultBuffers.traffic + 20);
      expect(result.reasoning.some((r: string) => r.includes("mgłę"))).toBe(
        true
      );
    });

    it("should optimize car change buffer for very long distances", () => {
      const result = timeCalculationService.generateOptimizedBuffers(
        defaultBuffers,
        {
          travelTimeMinutes: 150, // Very long travel
        }
      );

      expect(result.carChange).toBe(defaultBuffers.carChange + 5);
      expect(
        result.reasoning.some((r: string) => r.includes("długiej trasy"))
      ).toBe(true);
    });

    it("should provide reasoning for all changes", () => {
      const result = timeCalculationService.generateOptimizedBuffers(
        defaultBuffers,
        {
          travelTimeMinutes: 120,
          weatherConditions: ["rain"],
          sceneType: "EXT",
          timeOfDay: "early",
        }
      );

      expect(result.reasoning.length).toBeGreaterThan(0);
      expect(
        result.reasoning.every((reason) => typeof reason === "string")
      ).toBe(true);
    });
  });

  describe("private methods", () => {
    describe("calculateBufferBreakdown", () => {
      it("should calculate correct buffer breakdown", () => {
        const service = new TimeCalculationService();
        const calculateMethod = (service as any).calculateBufferBreakdown.bind(
          service
        );

        const breakdown = calculateMethod(45, defaultBuffers);

        expect(breakdown).toEqual({
          travelTime: 45,
          carChange: 15,
          parking: 10,
          entry: 10,
          traffic: 20,
          morningRoutine: 45,
          total: 145, // 45 + 15 + 10 + 10 + 20 + 45
        });
      });
    });

    describe("calculateTotalBuffers", () => {
      it("should calculate total buffer time", () => {
        const service = new TimeCalculationService();
        const calculateMethod = (service as any).calculateTotalBuffers.bind(
          service
        );

        const total = calculateMethod(defaultBuffers);

        expect(total).toBe(100); // 15 + 10 + 10 + 20 + 45
      });
    });

    describe("formatTime", () => {
      it("should format time correctly", () => {
        const service = new TimeCalculationService();
        const formatMethod = (service as any).formatTime.bind(service);

        const time = new Date("2024-01-15T08:30:00Z");
        const formatted = formatMethod(time);

        expect(formatted).toBe("08:30");
      });
    });

    describe("generateTimeWarnings", () => {
      it("should generate appropriate warnings", () => {
        const service = new TimeCalculationService();
        const generateMethod = (service as any).generateTimeWarnings.bind(
          service
        );

        const earlyWakeUp = new Date("2024-01-15T03:30:00Z");
        const bufferBreakdown = {
          travelTime: 100, // Long travel time to trigger traffic warning
          carChange: 15,
          parking: 10,
          entry: 10,
          traffic: 15, // Low traffic buffer
          morningRoutine: 45,
          total: 200, // Long total time
        };

        const warnings = generateMethod(earlyWakeUp, bufferBreakdown, {});

        expect(warnings.some((w: string) => w.includes("bardzo wczesny"))).toBe(
          true
        );
        expect(warnings.some((w: string) => w.includes("bardzo długi"))).toBe(
          true
        );
        expect(
          warnings.some((w: string) => w.includes("niewystarczający"))
        ).toBe(true);
      });
    });
  });
});
