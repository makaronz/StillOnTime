#!/usr/bin/env ts-node

/**
 * Database schema test script
 * This script tests basic CRUD operations on all models to verify the schema is working correctly
 */

import { PrismaClient } from "@prisma/client";
import { config } from "../config/config";

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: config.databaseUrl,
    },
  },
});

async function testDatabaseSchema() {
  try {
    console.log("🧪 Starting database schema tests...");

    // Test User creation
    console.log("📝 Testing User model...");
    const testUser = await prisma.user.create({
      data: {
        email: "test@stillontime.com",
        name: "Test User",
        googleId: "test-google-id-123",
        accessToken: "test-access-token",
        refreshToken: "test-refresh-token",
        tokenExpiry: new Date(Date.now() + 3600000), // 1 hour from now
      },
    });
    console.log("✅ User created:", testUser.id);

    // Test UserConfig creation
    console.log("📝 Testing UserConfig model...");
    const testUserConfig = await prisma.userConfig.create({
      data: {
        userId: testUser.id,
        homeAddress: "123 Test Street, Test City",
        panavisionAddress: "456 Panavision Ave, Test City",
        bufferCarChange: 15,
        bufferParking: 10,
        bufferEntry: 10,
        bufferTraffic: 20,
        bufferMorningRoutine: 45,
        notificationEmail: true,
        notificationSMS: false,
        notificationPush: true,
      },
    });
    console.log("✅ UserConfig created:", testUserConfig.id);

    // Test ProcessedEmail creation
    console.log("📝 Testing ProcessedEmail model...");
    const testEmail = await prisma.processedEmail.create({
      data: {
        messageId: "test-message-id-123",
        subject: "Test Schedule Email",
        sender: "test@stillontime.com",
        receivedAt: new Date(),
        threadId: "test-thread-id",
        processed: false,
        processingStatus: "pending",
        pdfHash: "test-pdf-hash-123",
        userId: testUser.id,
      },
    });
    console.log("✅ ProcessedEmail created:", testEmail.id);

    // Test ScheduleData creation
    console.log("📝 Testing ScheduleData model...");
    const testSchedule = await prisma.scheduleData.create({
      data: {
        shootingDate: new Date("2024-01-15"),
        callTime: "08:00",
        location: "Test Location, Test City",
        baseLocation: "Base Location",
        sceneType: "EXT",
        scenes: ["Scene 1", "Scene 2"],
        safetyNotes: "Test safety notes",
        equipment: ["Camera", "Lights"],
        contacts: [{ name: "Test Contact", phone: "123-456-7890" }],
        notes: "Test notes",
        userId: testUser.id,
        emailId: testEmail.id,
      },
    });
    console.log("✅ ScheduleData created:", testSchedule.id);

    // Test RoutePlan creation
    console.log("📝 Testing RoutePlan model...");
    const testRoutePlan = await prisma.routePlan.create({
      data: {
        wakeUpTime: new Date("2024-01-15T06:00:00Z"),
        departureTime: new Date("2024-01-15T07:00:00Z"),
        arrivalTime: new Date("2024-01-15T08:00:00Z"),
        totalTravelMinutes: 60,
        routeSegments: [
          { from: "Home", to: "Panavision", duration: 30 },
          { from: "Panavision", to: "Location", duration: 30 },
        ],
        buffers: {
          carChange: 15,
          parking: 10,
          entry: 10,
          traffic: 20,
          morningRoutine: 45,
        },
        userId: testUser.id,
        scheduleId: testSchedule.id,
      },
    });
    console.log("✅ RoutePlan created:", testRoutePlan.id);

    // Test WeatherData creation
    console.log("📝 Testing WeatherData model...");
    const testWeather = await prisma.weatherData.create({
      data: {
        forecastDate: new Date("2024-01-15"),
        temperature: 15.5,
        description: "Partly cloudy",
        windSpeed: 5.2,
        precipitation: 0.0,
        humidity: 65,
        warnings: ["No warnings"],
        userId: testUser.id,
        scheduleId: testSchedule.id,
      },
    });
    console.log("✅ WeatherData created:", testWeather.id);

    // Test CalendarEvent creation
    console.log("📝 Testing CalendarEvent model...");
    const testCalendarEvent = await prisma.calendarEvent.create({
      data: {
        calendarEventId: "test-calendar-event-id",
        title: "StillOnTime — Dzień zdjęciowy (Test Location)",
        startTime: new Date("2024-01-15T07:00:00Z"),
        endTime: new Date("2024-01-15T18:00:00Z"),
        description: "Test shooting day event",
        location: "Test Location, Test City",
        userId: testUser.id,
        scheduleId: testSchedule.id,
      },
    });
    console.log("✅ CalendarEvent created:", testCalendarEvent.id);

    // Test relationships by fetching user with all related data
    console.log("📝 Testing relationships...");
    const userWithRelations = await prisma.user.findUnique({
      where: { id: testUser.id },
      include: {
        processedEmails: true,
        schedules: {
          include: {
            routePlan: true,
            weatherData: true,
            calendarEvent: true,
          },
        },
        routePlans: true,
        weatherData: true,
        calendarEvents: true,
        userConfig: true,
      },
    });

    console.log("✅ Relationships test passed:");
    console.log(
      `  - User has ${userWithRelations?.processedEmails.length} processed emails`
    );
    console.log(
      `  - User has ${userWithRelations?.schedules.length} schedules`
    );
    console.log(
      `  - User has ${userWithRelations?.routePlans.length} route plans`
    );
    console.log(
      `  - User has ${userWithRelations?.weatherData.length} weather data entries`
    );
    console.log(
      `  - User has ${userWithRelations?.calendarEvents.length} calendar events`
    );
    console.log(
      `  - User has config: ${userWithRelations?.userConfig ? "Yes" : "No"}`
    );

    // Clean up test data
    console.log("🧹 Cleaning up test data...");
    await prisma.user.delete({
      where: { id: testUser.id },
    });
    console.log("✅ Test data cleaned up");

    console.log("🎉 All database schema tests passed successfully!");
  } catch (error) {
    console.error("❌ Database schema test failed:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test if this script is executed directly
if (require.main === module) {
  testDatabaseSchema();
}

export { testDatabaseSchema };
