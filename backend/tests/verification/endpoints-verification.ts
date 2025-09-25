/**
 * Verification script for Schedule and Calendar Management Endpoints
 * This script verifies that all required endpoints are implemented
 * according to task 9.3 requirements
 */

import { Express } from "express";
import { createTestApp } from "../setup";

interface EndpointTest {
  method: string;
  path: string;
  description: string;
  requiresAuth: boolean;
  requiresBody?: boolean;
}

// Define all required endpoints from task 9.3
const SCHEDULE_ENDPOINTS: EndpointTest[] = [
  // Schedule data CRUD endpoints
  {
    method: "GET",
    path: "/api/schedule",
    description: "Get schedules with filtering and pagination",
    requiresAuth: true,
  },
  {
    method: "GET",
    path: "/api/schedule/:scheduleId",
    description: "Get schedule by ID with all relations",
    requiresAuth: true,
  },
  {
    method: "PUT",
    path: "/api/schedule/:scheduleId",
    description: "Update schedule data",
    requiresAuth: true,
    requiresBody: true,
  },
  {
    method: "DELETE",
    path: "/api/schedule/:scheduleId",
    description: "Delete schedule",
    requiresAuth: true,
  },
  {
    method: "GET",
    path: "/api/schedule/statistics",
    description: "Get schedule statistics",
    requiresAuth: true,
  },

  // Route plan retrieval and modification endpoints
  {
    method: "GET",
    path: "/api/schedule/:scheduleId/route",
    description: "Get route plan for schedule",
    requiresAuth: true,
  },
  {
    method: "PUT",
    path: "/api/schedule/:scheduleId/route",
    description: "Update route plan for schedule",
    requiresAuth: true,
    requiresBody: true,
  },
  {
    method: "POST",
    path: "/api/schedule/:scheduleId/route/recalculate",
    description: "Trigger route recalculation",
    requiresAuth: true,
  },

  // Weather data endpoints
  {
    method: "GET",
    path: "/api/schedule/:scheduleId/weather",
    description: "Get weather data for schedule",
    requiresAuth: true,
  },
  {
    method: "POST",
    path: "/api/schedule/:scheduleId/weather/update",
    description: "Trigger weather update",
    requiresAuth: true,
  },
  {
    method: "GET",
    path: "/api/schedule/weather/warnings",
    description: "Get weather warnings",
    requiresAuth: true,
  },
  {
    method: "GET",
    path: "/api/schedule/weather/forecast",
    description: "Get weather forecast for location and date",
    requiresAuth: true,
  },
];

const CALENDAR_ENDPOINTS: EndpointTest[] = [
  // Calendar event management endpoints
  {
    method: "GET",
    path: "/api/calendar/events",
    description: "Get calendar events",
    requiresAuth: true,
  },
  {
    method: "POST",
    path: "/api/calendar/events",
    description: "Create calendar event for schedule",
    requiresAuth: true,
    requiresBody: true,
  },
  {
    method: "PUT",
    path: "/api/calendar/events/:eventId",
    description: "Update calendar event",
    requiresAuth: true,
    requiresBody: true,
  },
  {
    method: "DELETE",
    path: "/api/calendar/events/:eventId",
    description: "Delete calendar event",
    requiresAuth: true,
  },
  {
    method: "GET",
    path: "/api/calendar/sync/status",
    description: "Get calendar sync status",
    requiresAuth: true,
  },
  {
    method: "POST",
    path: "/api/calendar/sync",
    description: "Sync calendar events for schedules",
    requiresAuth: true,
    requiresBody: true,
  },
  {
    method: "GET",
    path: "/api/calendar/settings",
    description: "Get calendar settings",
    requiresAuth: true,
  },
];

/**
 * Verify that all required endpoints are implemented
 */
export async function verifyEndpointsImplementation(): Promise<{
  success: boolean;
  results: {
    scheduleEndpoints: {
      implemented: number;
      total: number;
      missing: string[];
    };
    calendarEndpoints: {
      implemented: number;
      total: number;
      missing: string[];
    };
  };
  summary: string;
}> {
  console.log(
    "🔍 Verifying Schedule and Calendar Management Endpoints Implementation...\n"
  );

  const app = await createTestApp();
  const results = {
    scheduleEndpoints: {
      implemented: 0,
      total: SCHEDULE_ENDPOINTS.length,
      missing: [] as string[],
    },
    calendarEndpoints: {
      implemented: 0,
      total: CALENDAR_ENDPOINTS.length,
      missing: [] as string[],
    },
  };

  // Check Schedule endpoints
  console.log("📋 Checking Schedule Endpoints:");
  for (const endpoint of SCHEDULE_ENDPOINTS) {
    const routeExists = checkRouteExists(app, endpoint.method, endpoint.path);
    if (routeExists) {
      results.scheduleEndpoints.implemented++;
      console.log(
        `  ✅ ${endpoint.method} ${endpoint.path} - ${endpoint.description}`
      );
    } else {
      results.scheduleEndpoints.missing.push(
        `${endpoint.method} ${endpoint.path}`
      );
      console.log(
        `  ❌ ${endpoint.method} ${endpoint.path} - ${endpoint.description}`
      );
    }
  }

  console.log("\n📅 Checking Calendar Endpoints:");
  for (const endpoint of CALENDAR_ENDPOINTS) {
    const routeExists = checkRouteExists(app, endpoint.method, endpoint.path);
    if (routeExists) {
      results.calendarEndpoints.implemented++;
      console.log(
        `  ✅ ${endpoint.method} ${endpoint.path} - ${endpoint.description}`
      );
    } else {
      results.calendarEndpoints.missing.push(
        `${endpoint.method} ${endpoint.path}`
      );
      console.log(
        `  ❌ ${endpoint.method} ${endpoint.path} - ${endpoint.description}`
      );
    }
  }

  const totalImplemented =
    results.scheduleEndpoints.implemented +
    results.calendarEndpoints.implemented;
  const totalRequired =
    results.scheduleEndpoints.total + results.calendarEndpoints.total;
  const success = totalImplemented === totalRequired;

  const summary = `Implementation Status: ${totalImplemented}/${totalRequired} endpoints implemented (${Math.round(
    (totalImplemented / totalRequired) * 100
  )}%)`;

  console.log(`\n📊 ${summary}`);

  if (success) {
    console.log("🎉 All required endpoints are implemented!");
  } else {
    console.log("⚠️  Some endpoints are missing implementation.");
  }

  return { success, results, summary };
}

/**
 * Check if a route exists in the Express app
 * This is a simplified check that looks at the router stack
 */
function checkRouteExists(app: Express, method: string, path: string): boolean {
  try {
    // Convert path parameters to regex patterns for matching
    const pathPattern = path.replace(/:[\w]+/g, "[^/]+");
    const regex = new RegExp(`^${pathPattern}$`);

    // Check if route exists in the app router
    const router = (app as any)._router;
    if (!router || !router.stack) return false;

    // Look through the router stack for matching routes
    for (const layer of router.stack) {
      if (layer.route) {
        const routePath = layer.route.path;
        const routeMethods = Object.keys(layer.route.methods);

        if (
          routeMethods.includes(method.toLowerCase()) &&
          regex.test(routePath)
        ) {
          return true;
        }
      } else if (layer.name === "router" && layer.regexp) {
        // Check nested routers (like /api/schedule, /api/calendar)
        const nestedPath = path.replace("/api", "");
        if (layer.handle && layer.handle.stack) {
          for (const nestedLayer of layer.handle.stack) {
            if (nestedLayer.route) {
              const fullPath = nestedPath;
              const nestedRoutePath = nestedLayer.route.path;
              const nestedMethods = Object.keys(nestedLayer.route.methods);

              if (
                nestedMethods.includes(method.toLowerCase()) &&
                regex.test(fullPath) &&
                nestedRoutePath === nestedPath
              ) {
                return true;
              }
            }
          }
        }
      }
    }

    return false;
  } catch (error) {
    console.warn(`Error checking route ${method} ${path}:`, error);
    return false;
  }
}

// Run verification if this file is executed directly
if (require.main === module) {
  verifyEndpointsImplementation()
    .then((result) => {
      process.exit(result.success ? 0 : 1);
    })
    .catch((error) => {
      console.error("Verification failed:", error);
      process.exit(1);
    });
}

export { SCHEDULE_ENDPOINTS, CALENDAR_ENDPOINTS };
